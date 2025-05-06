
import commonjs from "@rollup/plugin-commonjs";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";
import dts from "rollup-plugin-dts";

export default [
  {
    input: "dist/index.js",
    output: {
      format: "es",
      name: "workerbee",
      file: "dist/bundle/index.js"
    },
    plugins: [
      nodeResolve({
        preferBuiltins: false,
        browser: false,
        resolveOnly: () => false
      }),
      replace({
        values: {
          // Hardcode package version for later use in the code:
          "process.env.npm_package_version": `"${process.env.npm_package_version}"`
        },
        preventAssignment: true
      }),
      commonjs()
    ]
  }, {
    input: "dist/index.d.ts",
    output: [
      { file: "dist/bundle/index.d.ts", format: "es" }
    ],
    plugins: [
      dts()
    ]
  }
];
