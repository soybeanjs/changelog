import { defineConfig } from 'vite-plus';

export default defineConfig({
  pack: {
    entry: ['src/cli.ts'],
    platform: 'node',
    clean: true,
    dts: false,
    sourcemap: false,
    minify: false,
    fixedExtension: false
  }
});
