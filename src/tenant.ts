import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { Gateway, GatewayArgs } from "./gateway";
import { PluginSet } from "./pluginSet";

export interface TenantArgs {
    tenantName: string;
    namespace?: string;
    labels?: { [key: string]: string };
    /** Default true → default-deny cross-tenant ingress NetworkPolicy. */
    networkPolicy?: boolean;
    pluginSet?: { entries: any[]; capabilityGrants?: any[] };
    gateway?: Omit<GatewayArgs, "namespace">;
}

/**
 * One tenant as an imperative fan-out: namespace + NetworkPolicy isolation +
 * (optional) plugin-set + gateway. Instantiate in a loop to fan out a fleet.
 *
 * NB: this does NOT create an MCPGTenant CR, so it does NOT engage the
 * operator's tenant GOVERNANCE (plugin allowlist, ResourceQuota, replica caps,
 * exclusive namespace ownership). For declarative governance use {@link TenantCR}
 * (the MCPGTenant CR) — alongside or instead of this helper.
 */
export class Tenant extends pulumi.ComponentResource {
    public readonly namespace: pulumi.Output<string>;
    public readonly gateway?: Gateway;
    public readonly pluginSet?: PluginSet;

    constructor(name: string, args: TenantArgs, opts?: pulumi.ComponentResourceOptions) {
        super("mcpg:index:Tenant", name, {}, opts);

        const nsName = args.namespace ?? args.tenantName;

        const ns = new k8s.core.v1.Namespace(`${name}-ns`, {
            metadata: {
                name: nsName,
                labels: {
                    "app.kubernetes.io/managed-by": "pulumi-mcpg",
                    "mcpg.dev/tenant": args.tenantName,
                    ...(args.labels ?? {}),
                },
            },
        }, { parent: this });

        if (args.networkPolicy !== false) {
            new k8s.networking.v1.NetworkPolicy(`${name}-isolation`, {
                metadata: { name: "mcpg-tenant-isolation", namespace: nsName },
                spec: {
                    podSelector: {},
                    policyTypes: ["Ingress"],
                    ingress: [{ from: [{ namespaceSelector: { matchLabels: { "mcpg.dev/tenant": args.tenantName } } }] }],
                },
            }, { parent: this, dependsOn: ns });
        }

        const setName = `${args.tenantName}-set`;
        if (args.pluginSet) {
            this.pluginSet = new PluginSet(`${name}-set`, {
                namespace: nsName,
                entries: args.pluginSet.entries,
                capabilityGrants: args.pluginSet.capabilityGrants,
                resourceName: setName,
            }, { parent: this, dependsOn: ns });
        }

        if (args.gateway) {
            this.gateway = new Gateway(`${name}-gw`, {
                ...args.gateway,
                namespace: nsName,
                pluginSetRef: args.pluginSet ? setName : args.gateway.pluginSetRef,
                resourceName: args.gateway.resourceName ?? args.tenantName,
            }, { parent: this, dependsOn: ns });
        }

        this.namespace = pulumi.output(nsName);
        this.registerOutputs({ namespace: this.namespace });
    }
}
