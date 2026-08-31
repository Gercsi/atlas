import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("vite"))("esbuild");
const moduleUrl = new URL("../work/api-under-test.mjs", import.meta.url);
await build({
  entryPoints: ["frontend/api.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: fileURLToPath(moduleUrl),
});
let serial = 0;
async function client(
  replies,
  href = "http://localhost/atlas/public/#/servers/record-1",
) {
  const calls = [],
    redirects = [],
    events = [];
  globalThis.window = {
    location: {
      href,
      replace: (url) => {
        redirects.push(url);
        events.push("replace");
      },
    },
    dispatchEvent: (event) => events.push(event.type),
  };
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options });
    const reply = replies.shift();
    assert.ok(reply, "unexpected extra/replayed request");
    if (reply instanceof Error) throw reply;
    return new Response(reply.raw ?? JSON.stringify(reply.body ?? {}), {
      status: reply.status ?? 200,
    });
  };
  const api = await import(moduleUrl.href + "?test=" + ++serial);
  api.setCsrf("old-token");
  return { ...api, calls, redirects, events };
}
await test("expired read redirects once, preserves Apache path and closes UI before navigation", async () => {
  const c = await client([{ status: 401 }, { status: 401 }]);
  await Promise.allSettled([c.api("servers"), c.api("dashboard")]);
  assert.deepEqual(c.redirects, [
    "http://localhost/atlas/public/?_login=1#/login?reason=expired",
  ]);
  assert.deepEqual(c.events, ["cmdb:login-redirect", "replace"]);
});
await test("expired write redirects without replaying the mutation", async () => {
  const c = await client([{ status: 419 }]);
  await assert.rejects(c.api("servers", "POST", { name: "Do not replay" }));
  assert.equal(c.calls.length, 1);
  assert.equal(c.redirects.length, 1);
  await assert.rejects(c.api("servers", "POST", { name: "Also blocked" }));
  assert.equal(c.calls.length, 1);
});
await test("wrong password is a login error, not a redirect loop", async () => {
  const c = await client([
    { status: 401, body: { message: "Wrong password" } },
  ]);
  await assert.rejects(c.api("login", "POST", {}), {
    status: 401,
    message: "Wrong password",
  });
  assert.equal(c.redirects.length, 0);
});
await test("permission and validation failures keep their field errors without logout", async () => {
  const c = await client([
    { status: 403 },
    {
      status: 422,
      body: { message: "Invalid", field_errors: { name: "Required" } },
    },
  ]);
  await assert.rejects(c.api("admin/users"), { status: 403 });
  await assert.rejects(c.api("servers", "POST", {}), {
    fields: { name: "Required" },
  });
  assert.equal(c.redirects.length, 0);
});
await test("expired export download redirects instead of opening JSON as a page", async () => {
  const c = await client([{ status: 401 }]);
  await assert.rejects(c.apiDownload("exports/test/download"), { status: 401 });
  assert.equal(c.redirects.length, 1);
});
await test("successful download remains binary", async () => {
  const c = await client([{ raw: "PK\u0003\u0004binary" }]);
  assert.equal(
    await (await c.apiDownload("exports/test/download")).text(),
    "PK\u0003\u0004binary",
  );
  assert.equal(c.redirects.length, 0);
});
await test("logout refreshes a stale CSRF once and really calls logout before redirecting", async () => {
  const c = await client([
    { status: 419 },
    { body: { csrf: "fresh-token", user: null } },
    { body: { success: true } },
  ]);
  await c.logoutSession();
  assert.deepEqual(
    c.calls.map((x) => [x.url, x.method]),
    [
      ["api.php?r=logout", "POST"],
      ["api.php?r=session", "GET"],
      ["api.php?r=logout", "POST"],
    ],
  );
  assert.equal(c.calls[2].headers["X-CSRF-Token"], "fresh-token");
  assert.deepEqual(c.redirects, [
    "http://localhost/atlas/public/?_login=1#/login?reason=signed-out",
  ]);
});
await test("normal and already-expired logout can finish with one POST", async () => {
  const c = await client(
    [{ body: { success: true } }],
    "http://127.0.0.1:8088/#/diagram",
  );
  await c.logoutSession();
  assert.equal(c.calls.length, 1);
  assert.equal(
    c.redirects[0],
    "http://127.0.0.1:8088/?_login=1#/login?reason=signed-out",
  );
});
await test("network failure does not pretend that server logout succeeded", async () => {
  const c = await client([new TypeError("Network offline")]);
  await assert.rejects(c.logoutSession(), /Network offline/);
  assert.equal(c.redirects.length, 0);
});
await test("repeated CSRF rejection stops after a single logout retry", async () => {
  const c = await client([
    { status: 419 },
    { body: { csrf: "fresh-token" } },
    { status: 419 },
  ]);
  await assert.rejects(c.logoutSession(), { status: 419 });
  assert.equal(c.calls.length, 3);
  assert.equal(c.redirects.length, 0);
});
