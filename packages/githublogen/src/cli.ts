#!/usr/bin/env node
import cac from 'cac';
import { consola } from 'consola';
import { blue, bold, cyan, dim, red, yellow } from 'kolorist';
import { getChangelogMarkdown } from '@soybeanjs/changelog';
import { version } from '../package.json';
import { hasTagOnGitHub, isRepoShallow, sendRelease } from './github';

function setupCli() {
  const cli = cac('githublogen');

  cli.version(version).option('-t, --token <path>', 'GitHub Token').help();

  cli.command('').action(async (args: any) => {
    try {
      const cwd = process.cwd();

      const { options, commits, markdown } = await getChangelogMarkdown(
        {
          cwd,
          ...args
        },
        false
      );

      consola.log(cyan(options.from) + dim(' -> ') + blue(options.to) + dim(` (${commits.length} commits)`));

      if (!(await hasTagOnGitHub(options.to, options.github.repo, options.github.token))) {
        consola.error(yellow(`Current ref "${bold(options.to)}" is not available as tags on GitHub. Release skipped.`));

        if (process.exitCode) {
          process.exitCode = 1;
        }
      }

      if (!commits.length && (await isRepoShallow())) {
        consola.error(
          yellow(
            'The repo seems to be clone shallowly, which make changelog failed to generate. You might want to specify `fetch-depth: 0` in your CI config.'
          )
        );
        if (process.exitCode) {
          process.exitCode = 1;
        }
        return;
      }

      await sendRelease(options, markdown);
    } catch (e: any) {
      consola.error(red(String(e)));
      if (e?.stack) {
        consola.error(dim(e.stack?.split('\n').slice(1).join('\n')));
      }

      process.exit(1);
    }
  });

  cli.parse();
}

setupCli();
