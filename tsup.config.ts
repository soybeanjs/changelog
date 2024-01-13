import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  clean: true,
  dts: true,
  format: ['cjs', 'esm'],
  shims: true,
  cjsInterop: true,
  target: 'node14'
  // minify: true
});
