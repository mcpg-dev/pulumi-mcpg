# @mcpg/pulumi

Opinionated Pulumi components for running MCPG on Kubernetes: the operator, the
CRDs, cluster trust, gateways, plugin sets, routes, and tenants. Each component
wraps a piece of the platform that is easy to get subtly wrong — CRD lifecycle,
gateway configuration shape, tenant isolation — behind typed TypeScript inputs.
Built on `@mcpg/pulumi-crds` (the generated, typed CRD SDK) and
`@pulumi/kubernetes`.

Reach for it when your MCPG deployment lives in a Pulumi program and you would
rather express "one operator, one gateway, three tenants" than assemble Helm
releases and raw custom resources by hand.

## Prerequisites

- Pulumi with the TypeScript runtime, and a Kubernetes provider configured for
  the target cluster.
- cert-manager in the cluster, unless you turn it off. The operator's admission
  webhook fails closed and needs real TLS, so `Operator` sets
  `certManager.enabled=true` by default.

## Quick start

```ts
import { McpgStack } from "@mcpg/pulumi";

new McpgStack("prod", {
  operator: { chartVersion: "<chart-version>" },
  gateway: {
    image: { repository: "ghcr.io/mcpg-dev/source-code/gateway", tag: "<tag>" },
    governance: { audit: { sinks: [{ kind: "dev.mcpg.builtin.audit.local-file" }] } },
  },
});
```

`McpgStack` composes the common case: an `Operator`, a `TrustBootstrap` seeding
the cluster-default revocation list (set `trust: false` to skip it), and — when
`gateway` is given — one `Gateway` in the operator's namespace. Both of the
latter depend on the operator being installed first.

The package is built from this workspace:

```bash
pnpm --filter ./iac/pulumi/components run build       # tsc → bin/
pnpm --filter ./iac/pulumi/components exec tsc -b --noEmit   # tsc --noEmit
```

## Components

| Component | Creates |
|---|---|
| `Operator` | The operator Helm release plus the CRDs as first-class resources. |
| `Gateway` | An `MCPGGateway`, with `spec.config` assembled by the config builder. |
| `PluginSet` | An `MCPGPluginSet` — plugin entries and optional capability grants. |
| `TrustBootstrap` | The cluster-default `MCPGRevocationList`, and carries the signing-key reference. |
| `Cluster` | An `MCPGCluster` — the coordination backend a gateway's `clusterRef` points at. |
| `Route` | An `MCPGRoute` — a tool subset bound into a shared gateway with identity, policy, and audit chains. |
| `TenantCR` | An `MCPGTenant` — declarative tenant governance. |
| `Tenant` | A namespace with isolation, and optionally a plugin set and a gateway. |
| `McpgStack` | Operator plus trust plus one gateway. |

### Operator and CRD lifecycle

Helm installs the files under a chart's `crds/` directory once and never
upgrades or deletes them. `Operator` sidesteps that by applying the CRDs as a
`ConfigGroup` it owns — server-side applied, upgraded like any other resource —
and telling the chart to stand back with `skipCrds` plus `crd.install=false`.
`crdsDir` points at the CRD YAMLs (default `../../codegen/schemas/v1alpha1/crds`,
resolved from the Pulumi program's directory).

The release defaults to namespace `mcpg-system`, chart `mcpg-operator` from
`ociChartRepo()`, and cert-manager enabled. Set `watchNamespace` to restrict the
operator to a single namespace. Anything in `values` is spread over those
defaults, so a key you supply replaces the corresponding default block.

`ociChartRepo()` composes `oci://<base>/charts` from the registry coordinates in
`src/oci.ts`, whose defaults mirror `tools/release/oci-registry.json`. Override
one chart with `chartRepo`, or a whole stack with `MCPG_OCI_HOST` /
`MCPG_OCI_NAMESPACE` / `MCPG_OCI_PATH` — the same environment contract the shell
and Node publish helpers honour. `ociImageRepo(name)` and `ociPluginRegistry()`
compose image and plugin references off the same base.

### Gateway readiness

`Gateway` annotates the resource with `pulumi.com/waitFor: condition=Ready`, so
`pulumi up` waits on the operator reporting the gateway ready rather than on the
custom resource merely existing. Pass `waitForReady: false` to skip the wait.

### Tenancy: two different things

`Tenant` is an imperative fan-out — it creates the namespace, a default-deny
cross-tenant ingress `NetworkPolicy` (unless `networkPolicy: false`), and
optionally a plugin set and a gateway inside it. Instantiate it in a loop to
build a fleet. It does **not** create an `MCPGTenant`, so it does not engage the
operator's tenant governance.

`TenantCR` creates the `MCPGTenant` custom resource: the plugin allowlist,
per-namespace quotas, replica ceilings, and exclusive namespace ownership the
operator enforces at admission. Use it when tenant boundaries must be enforced
rather than merely arranged, alongside or instead of `Tenant`.

### Cluster credentials

`Cluster` accepts `credentialRefs` naming pre-existing Secrets, and
`credentials`, where an entry carrying `data` makes the component create the
Secret in `operatorNamespace` (default `mcpg-system`) and wire the reference for
you. Both forms surface to the gateway as `cred://cluster/<name>`.
`TrustBootstrap` takes a signing-key Secret reference the same way: only the
reference travels, never the key bytes, so no signing material lands in Pulumi
state.

## Configuration

`Gateway` builds the gateway's `spec.config` from typed sections. The operator
passes that document through untouched, and the gateway parses it strictly —
unknown keys are a boot-time error, which makes the shape worth getting right.

```ts
import { Gateway } from "@mcpg/pulumi";

new Gateway("orders", {
  namespace: "mcpg-system",
  image: { repository: "ghcr.io/mcpg-dev/source-code/gateway", tag: "<tag>" },
  server: { bind_address: "0.0.0.0:8080" },
  governance: { audit: { sinks: [{ kind: "dev.mcpg.builtin.audit.local-file" }] } },
  plugins: [
    { id: "dev.mcpg.backend.sql", source: { oci: "ghcr.io/mcpg-dev/source-code/plugins/backend-sql:protocol-1" } },
  ],
  extraConfig: { mcp: { capabilities: { tools: [] } } },
});
```

| Field | Type | Default | Description |
|---|---|---|---|
| `server` | object | omitted | Emitted at `config.gateway.server`, under the `gateway:` umbrella — a top-level `server` key is rejected by the gateway's parser. |
| `governance` | object | omitted | Emitted at `config.governance`. Audit sinks are a list (`audit.sinks[]`), not a scalar. |
| `observability` | object | omitted | Emitted at `config.observability`. |
| `mcp` | object | omitted | Emitted at `config.mcp`. |
| `plugins` | array | omitted | Emitted at `config.plugins`, and only when non-empty. Each entry carries `id` and a `source` declaring exactly one of `path` or `oci`; the per-entry toggle is `disabled`, not `enabled`. |
| `extraConfig` | object | `{}` | An arbitrary configuration fragment merged last, so its top-level keys win. The escape hatch for anything the typed sections do not cover. |

The same last-wins rule applies one level up: `extraSpec` on `Gateway` is merged
over the assembled `spec`, after the typed passthrough blocks
(`acceptedRouteNamespaces`, `podAnnotations`, `podLabels`, `resources`,
`service`, `ingress`, `autoscaling`, `monitoring`, `networkPolicy`,
`podDisruptionBudget`, `workloadIdentity`, `scheduling`, `probes`,
`imagePullSecrets`).

The config builder's semantics are covered by unit tests that need no
dependencies beyond Node itself:

```bash
pnpm --filter ./iac/pulumi/components run build
node --test iac/pulumi/components/bin/config.test.js
```

## Licence

Apache-2.0.

## See also

- <https://mcpg.dev/docs/self-hosting/pulumi> — deploying MCPG with Pulumi.
- <https://mcpg.dev/docs/reference/operator-crds> — the custom resources these
  components create.
- <https://mcpg.dev/docs/reference/configuration> — the full gateway
  configuration schema behind `spec.config`.
- `iac/pulumi/crds` (the typed CRD SDK) and `iac/pulumi/policy` (the CrossGuard
  policy pack that validates these resources at preview time).
