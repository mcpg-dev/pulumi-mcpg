import * as pulumi from "@pulumi/pulumi";
import { mcpg } from "@mcpg-dev/pulumi-crds";

export interface TenantCRArgs {
    /** Namespaces this tenant owns (non-empty, unique). */
    namespaces: string[];
    /** Plugin allowlist: [{ name? , registryPrefix? }] (each sets ≥1 matcher; [] = deny-all). */
    allowedPlugins?: any[];
    /** { maxGateways?, maxPluginSets?, maxRoutes?, maxReplicasPerGateway? } — each ≥ 0. */
    quotas?: { [key: string]: number };
    /** { key, ... } — key non-empty when set. */
    identityAttribute?: { [key: string]: any };
    labels?: { [key: string]: string };
    resourceName?: string;
}

/**
 * An MCPGTenant (cluster-scoped): the DECLARATIVE tenant governance boundary
 * — plugin allowlist, per-namespace ResourceQuota, replica caps, and
 * exclusive namespace ownership. Distinct from the {@link Tenant} component,
 * which is an imperative namespace+RBAC+NetworkPolicy fan-out that does NOT
 * engage tenant governance.
 */
export class TenantCR extends pulumi.ComponentResource {
    public readonly tenant: mcpg.v1alpha1.MCPGTenant;
    public readonly name: pulumi.Output<string>;

    constructor(name: string, args: TenantCRArgs, opts?: pulumi.ComponentResourceOptions) {
        super("mcpg:index:TenantCR", name, {}, opts);

        const tName = args.resourceName ?? name;
        const spec: { [key: string]: any } = { namespaces: args.namespaces };
        if (args.allowedPlugins && args.allowedPlugins.length > 0) spec.allowedPlugins = args.allowedPlugins;
        if (args.quotas) spec.quotas = args.quotas;
        if (args.identityAttribute) spec.identityAttribute = args.identityAttribute;

        this.tenant = new mcpg.v1alpha1.MCPGTenant(tName, {
            metadata: { name: tName, labels: args.labels },
            spec: spec as any,
        }, { parent: this });

        this.name = pulumi.output(tName);
        this.registerOutputs({ name: this.name });
    }
}
