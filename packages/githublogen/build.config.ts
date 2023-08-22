import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
  entries: ['src/cli'],
  clean: true,
  declaration: false,
  rollup: {
    emitCJS: true,
    inlineDependencies: true,
    esbuild: {
      minify: true
    }
  }
});
