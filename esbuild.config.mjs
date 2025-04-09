import * as esbuild from "esbuild";
import { exec } from "child_process";

const isServe = process.argv.includes("--serve");

// Function to pack the ZIP file
function packZip() {
  exec("node .vscode/pack-zip.js", (err, stdout, stderr) => {
    if (err) {
      console.error("Error packing zip:", err);
      return;
    }
    console.log(stdout.trim());
  });
}

// Function to copy the WASM file
function saveWasm() {
  exec(
    'cp ./node_modules/web-tree-sitter/tree-sitter.wasm ./dist/tree-sitter.wasm',
    (err, stdout, stderr) => {
      if (err) {
        console.error('Error copying WASM file:', err);
        return;
      }
    }
  );
}


// Custom plugin to pack ZIP after build or rebuild
const zipPlugin = {
  name: "zip-plugin",
  setup(build) {
    build.onEnd(() => {
      saveWasm();
      packZip();
    });
  },
};

// Base build configuration
let buildConfig = {
  entryPoints: ["src/main.js"],
  bundle: true,
  minify: true,
  logLevel: "info",
  color: true,
  outdir: "dist",
  external: ['module'],
  plugins: [zipPlugin],
};

// Main function to handle both serve and production builds
(async function () {
  if (isServe) {
    console.log("Starting development server...");

    // Watch and Serve Mode
    const ctx = await esbuild.context(buildConfig);

    await ctx.watch();
    const { host, port } = await ctx.serve({
      servedir: ".",
      port: 3000,
    });

  } else {
    console.log("Building for production...");
    await esbuild.build(buildConfig);
    console.log("Production build complete.");
  }
})();
