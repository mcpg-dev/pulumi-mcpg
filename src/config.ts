// The gateway config builder: assemble spec.config (the preserve-unknown
// AppConfig) from typed convenience sections plus an `extraConfig` escape hatch
// deep-merged LAST so it wins. Mirrors the Terraform module's config builder.

export interface GatewayConfigInput {
    /**
     * Gateway server/listener config. Emitted at config.gateway.server (the
     * `gateway:` AppConfig umbrella holds server/admin/control_plane), NOT a
     * top-level `server` key — that trips AppConfig's deny_unknown_fields.
     */
    server?: any;
    /**
     * config.governance section (access / policy / approvals / audit). Audit
     * sinks are a LIST, not a scalar:
     * { audit: { sinks: [{ kind: "dev.mcpg.builtin.audit.local-file" }] } }.
     * `dev.mcpg.builtin.audit.local-file` is the canonical built-in audit sink.
     */
    governance?: any;
    /** config.observability section. */
    observability?: any;
    /** config.mcp section (capabilities, etc.). */
    mcp?: any;
    /**
     * Ordered config.plugins list (AppConfig PluginEntryConfig). Each entry:
     * { id, source: { path | oci }, class?, kind?, config?, enforce?, disabled? }.
     * The toggle is `disabled` (bool, default false) — there is no `enabled`.
     * A `source` declaring exactly one of path/oci is required.
     */
    plugins?: any[];
    /** Arbitrary AppConfig fragment merged LAST into spec.config (wins). */
    extraConfig?: Record<string, any>;
}

/** Assemble spec.config from typed sections + extraConfig (extraConfig wins). */
export function buildConfig(input: GatewayConfigInput): Record<string, any> {
    const cfg: Record<string, any> = {};
    // `server` lives under the `gateway:` umbrella, not at the top level.
    if (input.server) cfg.gateway = { server: input.server };
    if (input.governance) cfg.governance = input.governance;
    if (input.observability) cfg.observability = input.observability;
    if (input.mcp) cfg.mcp = input.mcp;
    if (input.plugins && input.plugins.length > 0) cfg.plugins = input.plugins;
    return { ...cfg, ...(input.extraConfig ?? {}) };
}
