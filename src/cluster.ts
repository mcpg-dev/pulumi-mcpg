import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { mcpg } from "@mcpg-dev/pulumi-crds";

export interface ClusterCredential {
    /** cred://cluster/<name>. */
    name: string;
    secretName: string;
    key?: string;
    /** When set, the component CREATES the Secret in operatorNamespace; else it is assumed to pre-exist. */
    data?: { [key: string]: string };
}

export interface ClusterArgs {
    /** single_node (default) | redis | nats | consul | etcd. */
    backend?: string;
    /** Per-backend connection config. MUST be empty for single_node, non-empty otherwise. */
    config?: { [key: string]: any };
    /** Optional { name } of the cluster-scoped MCPGPlugin supplying the cdylib. */
    pluginRef?: { name: string };
    /** Optional [{ name, secretName, key? }] referencing PRE-EXISTING Secrets, surfaced as cred://cluster/<name>. */
    credentialRefs?: any[];
    /** Backend credentials this component manages — creates the Secret (when `data` is set) in operatorNamespace + wires the ref. */
    credentials?: ClusterCredential[];
    /** Namespace the operator runs in — where credential Secrets must live. */
    operatorNamespace?: pulumi.Input<string>;
    labels?: { [key: string]: string };
    resourceName?: string;
}

/**
 * An MCPGCluster (cluster-scoped): the coordination backend a gateway's
 * `clusterRef` points at. `single_node` takes no config; external backends
 * require a non-empty connection block.
 */
export class Cluster extends pulumi.ComponentResource {
    public readonly cluster: mcpg.v1alpha1.MCPGCluster;
    public readonly name: pulumi.Output<string>;

    constructor(name: string, args: ClusterArgs = {}, opts?: pulumi.ComponentResourceOptions) {
        super("mcpg:index:Cluster", name, {}, opts);

        const cName = args.resourceName ?? name;
        const ns = args.operatorNamespace ?? "mcpg-system";

        // Managed credential Secrets (operator namespace) + their refs.
        const managedRefs: any[] = [];
        const secretDeps: pulumi.Resource[] = [];
        for (const c of args.credentials ?? []) {
            if (c.data) {
                const sec = new k8s.core.v1.Secret(`${cName}-cred-${c.name}`, {
                    metadata: { name: c.secretName, namespace: ns },
                    stringData: c.data,
                    type: "Opaque",
                }, { parent: this });
                secretDeps.push(sec);
            }
            managedRefs.push(c.key ? { name: c.name, secretName: c.secretName, key: c.key } : { name: c.name, secretName: c.secretName });
        }
        const credentialRefs = [...(args.credentialRefs ?? []), ...managedRefs];

        const spec: { [key: string]: any } = { backend: args.backend ?? "single_node" };
        if (args.config && Object.keys(args.config).length > 0) spec.config = args.config;
        if (args.pluginRef) spec.pluginRef = args.pluginRef;
        if (credentialRefs.length > 0) spec.credentialRefs = credentialRefs;

        this.cluster = new mcpg.v1alpha1.MCPGCluster(cName, {
            metadata: { name: cName, labels: args.labels },
            spec: spec as any,
        }, { parent: this, dependsOn: secretDeps });

        this.name = pulumi.output(cName);
        this.registerOutputs({ name: this.name });
    }
}
