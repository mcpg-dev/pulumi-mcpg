import * as pulumi from "@pulumi/pulumi";
import { mcpg } from "@mcpg-dev/pulumi-crds";

export interface SecretRef {
    name: string;
    key: string;
}

export interface TrustBootstrapArgs {
    revocationListName?: string;
    revocations?: any[];
    issuedAt?: string;
    /** Signing-key Secret reference, passed through to plugin trust. Bytes are
     * never read into state (the no-secret-in-state invariant). */
    signingKeySecretRef?: SecretRef;
}

/** Seeds the cluster-default MCPGRevocationList and carries the signing-key ref. */
export class TrustBootstrap extends pulumi.ComponentResource {
    public readonly revocationList: mcpg.v1alpha1.MCPGRevocationList;
    public readonly revocationListName: pulumi.Output<string>;
    public readonly signingKeySecretRef?: SecretRef;

    constructor(name: string, args: TrustBootstrapArgs = {}, opts?: pulumi.ComponentResourceOptions) {
        super("mcpg:index:TrustBootstrap", name, {}, opts);

        const rlName = args.revocationListName ?? "cluster-default";
        const spec: { [key: string]: any } = { version: 1, revocations: args.revocations ?? [] };
        if (args.issuedAt) spec.issuedAt = args.issuedAt;

        this.revocationList = new mcpg.v1alpha1.MCPGRevocationList(rlName, {
            metadata: { name: rlName },
            spec: spec as any,
        }, { parent: this });

        this.revocationListName = pulumi.output(rlName);
        this.signingKeySecretRef = args.signingKeySecretRef;
        this.registerOutputs({ revocationListName: this.revocationListName });
    }
}
