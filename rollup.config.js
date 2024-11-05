
import commonjs from "@rollup/plugin-commonjs";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import dts from "rollup-plugin-dts";

const commonConfiguration = (packEntire = false) => ([
  {
    input: "dist/index.js",
    output: {
      format: "es",
      name: "workerbee",
      file: `dist/bundle/${packEntire ? "web-full" : "index"}.js`
    },
    plugins: [
      nodeResolve({
        preferBuiltins: false,
        browser: true,
        resolveOnly: packEntire ? [] : () => false
      }),
      commonjs()
    ]
  }, {
    input: "dist/index.d.ts",
    output: [
      { file: `dist/bundle/${packEntire ? "web-full" : "index"}.d.ts`, format: "es" }
    ],
    plugins: [
      dts()
    ]
  }
]);

export default [
  ...commonConfiguration(),
  ...commonConfiguration(true)
];
