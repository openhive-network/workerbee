import dts from 'rollup-plugin-dts';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import alias from '@rollup/plugin-alias';

const commonConfiguration = env => ([
  {
    input: `dist/${env}.js`,
    output: {
      format: 'es',
      name: 'workerbee',
      file: `dist/bundle/${env}.js`
    },
    plugins: [
      alias({
        entries: [
          { find: '@hive/beekeeper', replacement: `@hive/beekeeper/${env}` },
          { find: '@hive/wax', replacement: `@hive/wax/${env}` }
        ]
      }),
      nodeResolve({ preferBuiltins: env !== "web", browser: env === "web" }),
      commonjs()
    ]
  }, {
    input: `dist/${env}.d.ts`,
    output: [
      { file: `dist/bundle/${env}.d.ts`, format: "es" }
    ],
    plugins: [
      dts()
    ]
  }
]);

export default [
  ...commonConfiguration('node'),
  ...commonConfiguration('web')
];
