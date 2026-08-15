import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { ociChartRepo } from "./oci";

export interface OperatorArgs {
    namespace?: pulumi.Input<string>;
    chartVersion: pulumi.Input<string>;
    chartName?: pulumi.Input<string>;
    /** Helm repository. Unset composes `oci://<ociBase()>/charts`. */
    chartRepo?: pulumi.Input<string>;
    /** Path to the split-by-kind CRD YAMLs (the generated schema snapshot). */
    crdsDir?: string;
    /** Restrict the operator to a single namespace (operator.watchNamespace → --watch-namespace). */
    watchNamespace?: pulumi.Input<string>;
    /** Extra chart values deep-merged last. */
    values?: { [key: string]: any };
}

/**
 * Installs the MCPG operator via Helm with the CRDs managed as first-class
 * resources (chart `crd.install=false`) so they upgrade independently — closing
 * the Helm-doesn't-upgrade-CRDs hazard. Pulumi's K8s provider does SSA by
 * default and awaits readiness.
 */
export class Operator extends pulumi.ComponentResource {
    public readonly namespace: pulumi.Output<string>;
    public readonly chart: k8s.helm.v4.Chart;

    constructor(name: string, args: OperatorArgs, opts?: pulumi.ComponentResourceOptions) {
        super("mcpg:index:Operator", name, {}, opts);

        const ns = pulumi.output(args.namespace ?? "mcpg-system");
        const crdsDir = args.crdsDir ?? "../../codegen/schemas/v1alpha1/crds";

        const crds = new k8s.yaml.v2.ConfigGroup(`${name}-crds`, {
            files: [`${crdsDir}/*.yaml`],
        }, { parent: this });

        this.chart = new k8s.helm.v4.Chart(name, {
            chart: args.chartName ?? "mcpg-operator",
            version: args.chartVersion,
            namespace: ns,
            repositoryOpts: {
                repo: args.chartRepo ?? ociChartRepo(),
            },
            // The chart ships CRDs under crds/ (Helm install-only, value-ungated);
            // the ConfigGroup above owns them as first-class resources, so skip the
            // chart's copy to avoid two Pulumi resources managing the same CRDs.
            skipCrds: true,
            // Secure default: the admission webhook fails closed, so it needs real
            // TLS. cert-manager templates a self-signed Issuer + Certificate and
            // injects the caBundle. Requires cert-manager in the cluster; override
            // via values.certManager (e.g. { enabled: false } for BYO TLS Secret).
            values: {
                crd: { install: false },
                certManager: { enabled: true },
                ...(args.watchNamespace ? { operator: { watchNamespace: args.watchNamespace } } : {}),
                ...(args.values ?? {}),
            },
        }, { parent: this, dependsOn: crds });

        this.namespace = ns;
        this.registerOutputs({ namespace: this.namespace });
    }
}
