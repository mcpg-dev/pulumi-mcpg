// Registry coordinates every MCPG artefact hangs off. The defaults mirror the
// `internal` channel of tools/release/oci-registry.json — the manifest the
// publish steps read — and tools/ci/selftest-oci-registry.sh asserts the two
// still agree.
//
// A Pulumi program overrides per component (`chartRepo`, an explicit image
// repository) or, for a whole stack, through the same environment contract the
// shell and Node publish helpers honour:
//
//   MCPG_OCI_HOST       registry host       (default: ghcr.io)
//   MCPG_OCI_NAMESPACE  org / user segment  (default: mcpg-dev)
//   MCPG_OCI_PATH       repository path segment (default: source-code)
//
// MCPG_OCI_PATH set-but-empty means "no path segment" — the shape the public
// channel takes — so it is read by presence, not by truthiness.

const trim = (s: string): string => s.replace(/^\/+|\/+$/g, "");

/** The resolved `<host>/<namespace>[/<path>]` base. */
export function ociBase(env: NodeJS.ProcessEnv = process.env): string {
    const host = trim(env.MCPG_OCI_HOST ?? "ghcr.io");
    const namespace = trim(env.MCPG_OCI_NAMESPACE ?? "mcpg-dev");
    const path = trim("MCPG_OCI_PATH" in env ? (env.MCPG_OCI_PATH ?? "") : "source-code");
    return [host, namespace, path].filter(Boolean).join("/");
}

/** Helm OCI repository the charts publish to (`repositoryOpts.repo`). */
export function ociChartRepo(env: NodeJS.ProcessEnv = process.env): string {
    return `oci://${ociBase(env)}/charts`;
}

/** Container image repository for a project's `release.docker.imageName`. */
export function ociImageRepo(imageName: string, env: NodeJS.ProcessEnv = process.env): string {
    return `${ociBase(env)}/${trim(imageName)}`;
}

/** Registry a bare `oci:` plugin reference resolves against. */
export function ociPluginRegistry(env: NodeJS.ProcessEnv = process.env): string {
    return `${ociBase(env)}/plugins`;
}
