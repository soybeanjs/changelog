import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { getFirstGitCommit, getGitHubRepo, getTagDateMap, getTotalGitTags, isPrerelease } from './git';
import type { ChangelogOption } from './types';

function createDefaultOptions() {
  const cwd = process.cwd();

  const options: ChangelogOption = {
    cwd,
    types: {
      feat: '🚀 Features',
      fix: '🐞 Bug Fixes',
      perf: '🔥 Performance',
      optimize: '🛠 Optimizations',
      refactor: '💅 Refactors',
      docs: '📖 Documentation',
      build: '📦 Build',
      types: '🌊 Types',
      chore: '🏡 Chore',
      examples: '🏀 Examples',
      test: '✅ Tests',
      style: '🎨 Styles',
      ci: '🤖 CI'
    },
    github: {
      repo: '',
      token: process.env.GITHUB_TOKEN || ''
    },
    from: '',
    to: '',
    tags: [],
    tagDateMap: new Map(),
    capitalize: false,
    emoji: true,
    titles: {
      breakingChanges: '🚨 Breaking Changes'
    },
    output: 'CHANGELOG.md',
    regenerate: false
  };

  return options;
}

async function getVersionFromPkgJson(cwd: string) {
  let newVersion = '';

  try {
    const pkgJson = await readFile(`${cwd}/package.json`, 'utf-8');
    const pkg = JSON.parse(pkgJson);
    newVersion = pkg?.version || '';
  } catch {}

  return {
    newVersion
  };
}

export async function createOptions(options?: Partial<ChangelogOption>) {
  const opts = createDefaultOptions();

  Object.assign(opts, options);

  const { newVersion } = await getVersionFromPkgJson(opts.cwd);

  opts.github.repo ||= await getGitHubRepo();

  const tags = await getTotalGitTags();
  opts.tags = tags;

  opts.from ||= tags[tags.length - 1] || '';
  if (newVersion) {
    opts.to ||= `v${newVersion}`;
  }

  if (opts.to && opts.to === opts.from) {
    const lastTag = tags[tags.length - 2];
    const firstCommit = await getFirstGitCommit();
    opts.from = lastTag || firstCommit;
  }

  opts.tagDateMap = await getTagDateMap();

  opts.prerelease ||= isPrerelease(opts.to);

  const isFromPrerelease = isPrerelease(opts.from);

  if (opts.from && !isPrerelease(newVersion) && isFromPrerelease) {
    const allReleaseTags = opts.tags.filter(tag => !isPrerelease(tag) && tag !== opts.to);

    opts.from = allReleaseTags[allReleaseTags.length - 1] || opts.from;
  }

  return opts;
}
