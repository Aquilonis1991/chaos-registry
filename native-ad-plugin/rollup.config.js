const fs = require("fs");
const path = require("path");
const commonjs = require("@rollup/plugin-commonjs");
const nodeResolve = require("@rollup/plugin-node-resolve");
const replace = require("@rollup/plugin-replace");
const typescript = require("@rollup/plugin-typescript");

const pkg = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "package.json"), "utf-8")
);

const banner = `/*!
 * ${pkg.name} v${pkg.version}
 * (c) ${new Date().getFullYear()}
 * Released under the ${pkg.license} License.
 */
`;

module.exports = {
  input: "src/index.ts",
  output: [
    {
      dir: "dist/esm",
      format: "es",
      sourcemap: true,
      banner,
    },
    {
      dir: "dist",
      entryFileNames: "plugin.cjs.js",
      format: "cjs",
      exports: "auto",
      sourcemap: true,
      banner,
    },
  ],
  plugins: [
    nodeResolve({
      preferBuiltins: true,
    }),
    commonjs(),
    typescript({
      tsconfig: "./tsconfig.json",
    }),
    replace({
      preventAssignment: true,
      __CAP_PLUGIN_ID__: "@votechaos/native-ad-plugin",
    }),
  ],
  external: ["@capacitor/core"],
};

