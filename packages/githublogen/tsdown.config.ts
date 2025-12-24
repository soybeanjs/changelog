import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/cli.ts'],
  platform: 'node',
  clean: true,
  dts: false,
  sourcemap: false,
  minify: false,
  external: ['consola'],
  fixedExtension: false
});
