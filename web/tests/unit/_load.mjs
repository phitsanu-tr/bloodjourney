// Loads the app's exported helpers into Node for the unit tests: bundles blood-donation-tracker.jsx with esbuild (already a
// dependency of vite) into unit/.build/, stubbing the few browser globals the module touches when it is imported.
// (the app sources are the root file plus web/src/lib and web/src/components). No new dependency; tests run in milliseconds: from web/tests run `node --test "unit/*.test.mjs"`.
import { build } from "../../node_modules/esbuild/lib/main.js";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));
export const APP_SOURCE = path.resolve(here, "../../../blood-donation-tracker.jsx");
// The root file imports ./lib and ./components, which live next to web/src/App.jsx (the build copies the root file there).
const APP_COPY = path.resolve(here, `../../src/.unit-app-${process.pid}.jsx`);
export const SOURCE_FILES = (() => {
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(dir, e.name)) : /\.jsx?$/.test(e.name) ? [path.join(dir, e.name)] : []);
  return [APP_SOURCE, ...walk(path.resolve(here, "../../src/lib")), ...walk(path.resolve(here, "../../src/components"))];
})();
// One bundle and one entry copy per test process: node --test runs the files in parallel, and a shared file was rewritten
// while another process read it ("app.encodeShareToken is not a function" at random).
const out = path.join(here, ".build", `app-${process.pid}.mjs`);

globalThis.window ??= globalThis;
globalThis.localStorage ??= { getItem() { return null; }, setItem() {}, removeItem() {} };
globalThis.document ??= { addEventListener() {}, documentElement: { style: {}, classList: { add() {}, remove() {} } } };

fs.copyFileSync(APP_SOURCE, APP_COPY);
await build({
  entryPoints: [APP_COPY], outfile: out, bundle: true, platform: "node", format: "esm", packages: "external",
  loader: { ".jsx": "jsx" }, jsx: "automatic", logLevel: "error",
});
export const app = await import(pathToFileURL(out).href);
for (const f of [APP_COPY, out]) { try { fs.unlinkSync(f); } catch (e) {} }
