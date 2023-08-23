import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
  entries: ['src/cli'],
  clean: true,
  declaration: false,
  rollup: {
    inlineDependencies: true
  }
});
