import dts from 'rollup-plugin-dts';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import alias from '@rollup/plugin-alias';

const commonConfiguration = (env, packEntire = false) => ([
  {
    input: `dist/${env}.js`,
    output: {
      format: 'es',
      name: 'workerbee',
      file: `dist/bundle/${env}${packEntire ? '-full' : ''}.js`
    },
    plugins: [
      alias({
        entries: [
          { find: '@hiveio/beekeeper', replacement: `@hiveio/beekeeper/${env}` },
          { find: '@hiveio/wax', replacement: `@hiveio/wax/${env}` }
        ]
      }),
      nodeResolve({
        preferBuiltins: env !== "web",
        browser: env === "web",
        resolveOnly: packEntire ? [] : () => false
      }),
      commonjs()
    ]
  }, {
    input: `dist/${env}.d.ts`,
    output: [
      { file: `dist/bundle/${env}${packEntire ? '-full' : ''}.d.ts`, format: "es" }
    ],
    plugins: [
      dts()
    ]
  }
]);

export default [
  ...commonConfiguration('node'),
  ...commonConfiguration('web'),
  ...commonConfiguration('web', true)
];
