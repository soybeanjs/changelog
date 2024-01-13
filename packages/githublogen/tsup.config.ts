import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts'],
  clean: true,
  dts: true,
  format: ['esm'],
  shims: true,
  cjsInterop: true,
  target: 'node14'
  // minify: true
});
