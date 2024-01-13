import process from 'node:process';
import { readFile } from 'node:fs/promises';
import {
  getCurrentGitBranch,
  getFirstGitCommit,
  getGitHubRepo,
  getLastGitTag,
  getTagDateMap,
  getTotalGitTags,
  isPrerelease
} from './git';
import type { ChangelogOption } from './types';

function createDefaultOptions() {
  const cwd = process.cwd();

  const options: ChangelogOption = {
    cwd,
    types: {
      feat: '🚀 Features',
      fix: '🐞 Bug Fixes',
      perf: '🔥 Performance',
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
    regenerate: false,
    newVersion: ''
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

  opts.newVersion ||= `v${newVersion}`;
  opts.from ||= await getLastGitTag();
  opts.to ||= await getCurrentGitBranch();

  if (opts.to === opts.from) {
    const lastTag = await getLastGitTag(-1);
    const firstCommit = await getFirstGitCommit();
    opts.from = lastTag || firstCommit;
  }

  opts.tags = await getTotalGitTags();

  opts.tagDateMap = await getTagDateMap();

  opts.prerelease ||= isPrerelease(opts.to);

  const isFromPrerelease = isPrerelease(opts.from);
  if (!opts.prerelease && isFromPrerelease) {
    const allReleaseTags = opts.tags.filter(tag => !isPrerelease(tag));

    opts.from = allReleaseTags[allReleaseTags.length - 2];
  }

  return opts;
}
