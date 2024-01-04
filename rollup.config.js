import typescript from 'rollup-plugin-typescript2';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

const commonConfiguration = (env, merge = {}) => ({
  input: `dist/${env}.js`,
  output: {
    format: 'es',
    name: 'workerbee',
    ...(merge.output || {})
  },
  plugins: [
    nodeResolve({ preferBuiltins: env !== "web", browser: env === "web" }),
    commonjs(),
    ...(merge.plugins || [])
  ]
});

export default [
  commonConfiguration('node', { output: { file: 'dist/bundle/node.js' } }),
  commonConfiguration('web',  { output: { dir: 'dist/bundle' }, plugins: [
    typescript({
      rollupCommonJSResolveHack: false,
      clean: true
    })
  ] })
];
