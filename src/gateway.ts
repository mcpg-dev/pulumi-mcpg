import * as pulumi from "@pulumi/pulumi";
import { mcpg } from "@mcpg-dev/pulumi-crds";
import { buildConfig, GatewayConfigInput } from "./config";

export interface GatewayArgs extends GatewayConfigInput {
    namespace: pulumi.Input<string>;
    /** Gateway image (CRD spec.image — e.g. { repository, tag }). Required. */
    image: any;
    replicas?: number;
    pluginSetRef?: pulumi.Input<string>;
    revocationListRef?: pulumi.Input<string>;
    /** MCPGCluster coordination backend (spec.clusterRef.name) for HA gateways. */
    clusterRef?: pulumi.Input<string>;
    /** Soft-tenancy: namespaces whose MCPGRoutes this gateway accepts. */
    acceptedRouteNamespaces?: string[];
    podAnnotations?: { [key: string]: string };
    podLabels?: { [key: string]: string };
    // Passthrough spec blocks (CRD spec.* — same surface as the TF module).
    resources?: any;
    service?: any;
    ingress?: any;
    autoscaling?: any;
    monitoring?: any;
    networkPolicy?: any;
    podDisruptionBudget?: any;
    workloadIdentity?: any;
    scheduling?: any;
    probes?: any;
    imagePullSecrets?: any;
    /** Arbitrary spec-level fields merged LAST (for spec keys not yet typed). */
    extraSpec?: { [key: string]: any };
    labels?: { [key: string]: string };
    /** Default true → annotate `pulumi.com/waitFor: condition=Ready`. */
    waitForReady?: boolean;
    /** MCPGGateway metadata.name (defaults to the component name). */
    resourceName?: string;
}

/**
 * An MCPGGateway built from typed inputs + the config builder. Readiness is the
 * provider's built-in await via the `pulumi.com/waitFor` annotation.
 */
export class Gateway extends pulumi.ComponentResource {
    public readonly gateway: mcpg.v1alpha1.MCPGGateway;
    public readonly name: pulumi.Output<string>;

    constructor(name: string, args: GatewayArgs, opts?: pulumi.ComponentResourceOptions) {
        super("mcpg:index:Gateway", name, {}, opts);

        const gwName = args.resourceName ?? name;
        const spec: { [key: string]: any } = {
            image: args.image,
            config: buildConfig(args),
        };
        if (args.replicas !== undefined) spec.replicas = args.replicas;
        if (args.pluginSetRef) spec.pluginSetRef = { name: args.pluginSetRef };
        if (args.revocationListRef) spec.revocationListRef = { name: args.revocationListRef };
        if (args.clusterRef) spec.clusterRef = { name: args.clusterRef };

        // Typed passthrough blocks (same spec surface as the TF gateway module).
        const optional: { [key: string]: any } = {
            acceptedRouteNamespaces: args.acceptedRouteNamespaces,
            podAnnotations: args.podAnnotations,
            podLabels: args.podLabels,
            resources: args.resources,
            service: args.service,
            ingress: args.ingress,
            autoscaling: args.autoscaling,
            monitoring: args.monitoring,
            networkPolicy: args.networkPolicy,
            podDisruptionBudget: args.podDisruptionBudget,
            workloadIdentity: args.workloadIdentity,
            scheduling: args.scheduling,
            probes: args.probes,
            imagePullSecrets: args.imagePullSecrets,
        };
        for (const [k, v] of Object.entries(optional)) if (v !== undefined) spec[k] = v;
        Object.assign(spec, args.extraSpec ?? {}); // escape hatch wins (matches TF extra_spec)

        const annotations: { [key: string]: string } =
            args.waitForReady === false ? {} : { "pulumi.com/waitFor": "condition=Ready" };

        this.gateway = new mcpg.v1alpha1.MCPGGateway(gwName, {
            metadata: { name: gwName, namespace: args.namespace, labels: args.labels, annotations },
            spec: spec as any,
        }, { parent: this });

        this.name = pulumi.output(gwName);
        this.registerOutputs({ name: this.name });
    }
}
