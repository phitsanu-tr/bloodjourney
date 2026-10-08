// Loads the app's exported helpers into Node for the unit tests: bundles blood-donation-tracker.jsx with esbuild (already a
// dependency of vite) into unit/.build/, stubbing the few browser globals the module touches when it is imported.
// No new dependency; tests run in milliseconds: from web/tests run `node --test "unit/*.test.mjs"`.
import { build } from "../../node_modules/esbuild/lib/main.js";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
export const APP_SOURCE = path.resolve(here, "../../../blood-donation-tracker.jsx");
const out = path.join(here, ".build", "app.mjs");

globalThis.window ??= globalThis;
globalThis.localStorage ??= { getItem() { return null; }, setItem() {}, removeItem() {} };
globalThis.document ??= { addEventListener() {}, documentElement: { style: {}, classList: { add() {}, remove() {} } } };

await build({
  entryPoints: [APP_SOURCE], outfile: out, bundle: true, platform: "node", format: "esm", packages: "external",
  loader: { ".jsx": "jsx" }, jsx: "automatic", logLevel: "error",
});
export const app = await import(pathToFileURL(out).href);
