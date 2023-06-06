import cliProgress from 'cli-progress';
import type { SingleBar } from 'cli-progress';
import { createOptions } from './options';
import { getFromToTags, getGitCommits, getGitCommitsAndResolvedAuthors } from './git';
import { isVersionInMarkdown, generateMarkdown, writeMarkdown } from './markdown';
import type { ChangelogOption } from './types';

/**
 * get the changelog markdown by two git tags
 * @param options the changelog options
 */
export async function getChangelogMarkdown(options?: Partial<ChangelogOption>) {
  const opts = await createOptions(options);

  const gitCommits = await getGitCommits(opts.from, opts.to);
  const { commits, contributors } = await getGitCommitsAndResolvedAuthors(gitCommits, opts.github);

  const markdown = generateMarkdown({ commits, options: opts, showTitle: true, contributors });

  return markdown;
}

/**
 * get the changelog markdown by the total git tags
 * @param options the changelog options
 * @param showProgress whither show the progress bar
 */
export async function getTotalChangelogMarkdown(options?: Partial<ChangelogOption>, showProgress = true) {
  const opts = await createOptions(options);

  let bar: SingleBar | null = null;
  if (showProgress) {
    bar = new cliProgress.SingleBar(
      { format: 'generate total changelog: [{bar}] {percentage}% | ETA: {eta}s | {value}/{total}' },
      cliProgress.Presets.shades_classic
    );
  }

  const tags = getFromToTags(opts.tags);

  if (tags.length === 0) {
    return getChangelogMarkdown(opts);
  }

  bar?.start(tags.length, 0);

  let markdown = '';
  const resolvedLogins = new Map<string, string>();

  for await (const [index, tag] of tags.entries()) {
    const { from, to } = tag;
    const gitCommits = await getGitCommits(from, to);
    const { commits, contributors } = await getGitCommitsAndResolvedAuthors(gitCommits, opts.github, resolvedLogins);

    const nextMd = generateMarkdown({ commits, options: { ...opts, from, to }, showTitle: true, contributors });

    markdown = `${nextMd}\n\n${markdown}`;

    bar?.update(index + 1);
  }

  bar?.stop();

  return markdown;
}

/**
 * generate the changelog markdown by two git tags
 * @param options the changelog options
 */
export async function generateChangelog(options?: Partial<ChangelogOption>) {
  const opts = await createOptions(options);

  const existContent = await isVersionInMarkdown(opts.to, opts.output);

  if (!opts.regenerate && existContent) return;

  const markdown = await getChangelogMarkdown(opts);

  await writeMarkdown(markdown, opts.output, opts.regenerate);
}

/**
 * generate the changelog markdown by the total git tags
 * @param options the changelog options
 * @param showProgress whither show the progress bar
 */
export async function generateTotalChangelog(options?: Partial<ChangelogOption>, showProgress = true) {
  const opts = await createOptions(options);

  const markdown = await getTotalChangelogMarkdown(opts, showProgress);

  await writeMarkdown(markdown, opts.output, true);
}

export type { ChangelogOption };
