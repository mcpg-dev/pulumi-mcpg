import * as pulumi from "@pulumi/pulumi";
import { Operator, OperatorArgs } from "./operator";
import { Gateway, GatewayArgs } from "./gateway";
import { TrustBootstrap } from "./trustBootstrap";

export interface McpgStackArgs {
    operator: OperatorArgs;
    /** Optional single gateway for the common case. */
    gateway?: Omit<GatewayArgs, "namespace"> & { namespace?: pulumi.Input<string> };
    /** Seed the cluster-default revocation list (default true). */
    trust?: boolean;
}

/** Convenience composition: operator + cluster trust + one gateway. */
export class McpgStack extends pulumi.ComponentResource {
    public readonly operator: Operator;
    public readonly gateway?: Gateway;

    constructor(name: string, args: McpgStackArgs, opts?: pulumi.ComponentResourceOptions) {
        super("mcpg:index:McpgStack", name, {}, opts);

        this.operator = new Operator(`${name}-operator`, args.operator, { parent: this });

        if (args.trust !== false) {
            new TrustBootstrap(`${name}-trust`, {}, { parent: this, dependsOn: this.operator });
        }

        if (args.gateway) {
            this.gateway = new Gateway(`${name}-gateway`, {
                ...args.gateway,
                namespace: args.gateway.namespace ?? this.operator.namespace,
            }, { parent: this, dependsOn: this.operator });
        }

        this.registerOutputs({});
    }
}
