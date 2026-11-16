import * as esbuild from "esbuild";
import * as fs from "fs";
import * as path from "path";

const outDir = "out";
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

await esbuild.build({
  entryPoints: ["src/extension.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: path.join(outDir, "extension.js"),
  external: ["vscode"],
  sourcemap: true,
  logLevel: "info",
});

const testEntries = fs
  .readdirSync("src/cards")
  .filter((f) => f.endsWith(".test.ts"))
  .map((f) => path.join("src/cards", f));

if (testEntries.length) {
  await esbuild.build({
    entryPoints: testEntries,
    bundle: true,
    platform: "node",
    format: "cjs",
    outdir: path.join(outDir, "cards"),
    sourcemap: true,
    logLevel: "info",
  });
}
