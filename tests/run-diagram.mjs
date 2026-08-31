import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("vite"))("esbuild");
import { spawnSync } from "node:child_process";
await build({
  entryPoints: ["tests/diagram.test.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "work/diagram-test.mjs",
});
const result = spawnSync(process.execPath, ["work/diagram-test.mjs"], {
  stdio: "inherit",
});
process.exitCode = result.status || 0;
