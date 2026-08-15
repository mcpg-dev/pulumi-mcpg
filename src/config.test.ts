// Unit tests for the config builder. Uses node's built-in test runner +
// assert (no extra deps). Run: `tsc && node --test bin/config.test.js`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildConfig } from "./config";

test("typed sections are included; absent ones omitted", () => {
    const c = buildConfig({ governance: { audit: { sinks: [{ kind: "dev.mcpg.builtin.audit.local-file" }] } } });
    assert.equal(c.governance.audit.sinks[0].kind, "dev.mcpg.builtin.audit.local-file");
    assert.equal("gateway" in c, false);
    assert.equal("observability" in c, false);
});

test("server nests under config.gateway.server (not a top-level server key)", () => {
    const c = buildConfig({ server: { listen_addr: "0.0.0.0:8080" } });
    assert.equal("server" in c, false);
    assert.deepEqual(c.gateway.server, { listen_addr: "0.0.0.0:8080" });
});

test("plugins included only when non-empty", () => {
    assert.equal("plugins" in buildConfig({ plugins: [] }), false);
    assert.deepEqual(buildConfig({ plugins: [{ id: "db.read" }] }).plugins, [{ id: "db.read" }]);
});

test("extraConfig is merged LAST and wins", () => {
    const c = buildConfig({
        governance: { a: 1 },
        extraConfig: { governance: { b: 2 }, extra: true },
    });
    assert.deepEqual(c.governance, { b: 2 }); // extraConfig wins
    assert.equal(c.extra, true);
});

test("empty input yields empty config", () => {
    assert.deepEqual(buildConfig({}), {});
});
