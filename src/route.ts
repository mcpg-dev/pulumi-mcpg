import * as pulumi from "@pulumi/pulumi";
import { mcpg } from "@mcpg-dev/pulumi-crds";

export interface RouteArgs {
    namespace: pulumi.Input<string>;
    /** Shared gateway this route binds into: { name } (non-empty). */
    gatewayRef: { name: string };
    /** Tool matcher: { tools: [{ id }] } — at least one unique, non-empty id. */
    match: { tools: { id: string }[] };
    identityChain?: string[];
    policyChain?: string[];
    auditChain?: string[];
    /** e.g. { tenant: "team-a" }. Omit only for a single-tenant gateway (else reachable by any caller). */
    attributes?: { [key: string]: any };
    labels?: { [key: string]: string };
    resourceName?: string;
}

/**
 * An MCPGRoute (namespaced): binds a tenant's tool subset into a SHARED gateway
 * with identity/policy/audit chains — the soft-multi-tenancy primitive.
 */
export class Route extends pulumi.ComponentResource {
    public readonly route: mcpg.v1alpha1.MCPGRoute;
    public readonly name: pulumi.Output<string>;

    constructor(name: string, args: RouteArgs, opts?: pulumi.ComponentResourceOptions) {
        super("mcpg:index:Route", name, {}, opts);

        const rName = args.resourceName ?? name;
        const spec: { [key: string]: any } = { gatewayRef: args.gatewayRef, match: args.match };
        if (args.identityChain && args.identityChain.length > 0) spec.identityChain = args.identityChain;
        if (args.policyChain && args.policyChain.length > 0) spec.policyChain = args.policyChain;
        if (args.auditChain && args.auditChain.length > 0) spec.auditChain = args.auditChain;
        if (args.attributes) spec.attributes = args.attributes;

        this.route = new mcpg.v1alpha1.MCPGRoute(rName, {
            metadata: { name: rName, namespace: args.namespace, labels: args.labels },
            spec: spec as any,
        }, { parent: this });

        this.name = pulumi.output(rName);
        this.registerOutputs({ name: this.name });
    }
}
