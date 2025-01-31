
import commonjs from "@rollup/plugin-commonjs";
import { nodeResolve } from "@rollup/plugin-node-resolve";
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
