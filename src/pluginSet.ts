import * as pulumi from "@pulumi/pulumi";
import { mcpg } from "@mcpg-dev/pulumi-crds";

export interface PluginSetArgs {
    namespace: pulumi.Input<string>;
    entries: any[];
    capabilityGrants?: any[];
    labels?: { [key: string]: string };
    resourceName?: string;
}

export class PluginSet extends pulumi.ComponentResource {
    public readonly pluginSet: mcpg.v1alpha1.MCPGPluginSet;
    public readonly name: pulumi.Output<string>;

    constructor(name: string, args: PluginSetArgs, opts?: pulumi.ComponentResourceOptions) {
        super("mcpg:index:PluginSet", name, {}, opts);

        const psName = args.resourceName ?? name;
        const spec: { [key: string]: any } = { entries: args.entries };
        if (args.capabilityGrants && args.capabilityGrants.length > 0) {
            spec.capabilityGrants = args.capabilityGrants;
        }

        this.pluginSet = new mcpg.v1alpha1.MCPGPluginSet(psName, {
            metadata: { name: psName, namespace: args.namespace, labels: args.labels },
            spec: spec as any,
        }, { parent: this });

        this.name = pulumi.output(psName);
        this.registerOutputs({ name: this.name });
    }
}
