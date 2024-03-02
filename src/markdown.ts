import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import dayjs from 'dayjs';
import { convert } from 'convert-gitmoji';
import { capitalize, groupBy, join, partition } from './shared';
import { VERSION_REG_OF_MARKDOWN, VERSION_WITH_RELEASE } from './constant';
import type { ChangelogOption, GitCommit, Reference, ResolvedAuthor } from './types';

function formatReferences(references: Reference[], githubRepo: string, type: 'issues' | 'hash'): string {
  const refs = references
    .filter(i => {
      if (type === 'issues') return i.type === 'issue' || i.type === 'pull-request';
      return i.type === 'hash';
    })
    .map(ref => {
      if (!githubRepo) return ref.value;
      if (ref.type === 'pull-request' || ref.type === 'issue')
        return `https://github.com/${githubRepo}/issues/${ref.value.slice(1)}`;
      return `[<samp>(${ref.value.slice(0, 5)})</samp>](https://github.com/${githubRepo}/commit/${ref.value})`;
    });

  const referencesString = join(refs).trim();

  if (type === 'issues') return referencesString && `in ${referencesString}`;
  return referencesString;
}

function formatLine(commit: GitCommit, options: ChangelogOption) {
  const prRefs = formatReferences(commit.references, options.github.repo, 'issues');
  const hashRefs = formatReferences(commit.references, options.github.repo, 'hash');

  let authors = join([...new Set(commit.resolvedAuthors.map(i => (i.login ? `@${i.login}` : `**${i.name}**`)))]).trim();

  if (authors) {
    authors = `by ${authors}`;
  }

  let refs = [authors, prRefs, hashRefs].filter(i => i?.trim()).join(' ');

  if (refs) {
    refs = `&nbsp;-&nbsp; ${refs}`;
  }

  const description = options.capitalize ? capitalize(commit.description) : commit.description;

  return [description, refs].filter(i => i?.trim()).join(' ');
}

function formatTitle(name: string, options: ChangelogOption) {
  const emojisRE =
    /([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g;

  let formatName = name.trim();

  if (!options.emoji) {
    formatName = name.replace(emojisRE, '').trim();
  }

  return `### &nbsp;&nbsp;&nbsp;${formatName}`;
}

function formatSection(commits: GitCommit[], sectionName: string, options: ChangelogOption) {
  if (!commits.length) return [];

  const lines: string[] = ['', formatTitle(sectionName, options), ''];

  const scopes = groupBy(commits, 'scope');

  let useScopeGroup = true;

  // group scopes only when one of the scope have multiple commits
  if (!Object.entries(scopes).some(([k, v]) => k && v.length > 1)) {
    useScopeGroup = false;
  }

  Object.keys(scopes)
    .sort()
    .forEach(scope => {
      let padding = '';
      let prefix = '';
      const scopeText = `**${scope}**`;
      if (scope && useScopeGroup) {
        lines.push(`- ${scopeText}:`);
        padding = '  ';
      } else if (scope) {
        prefix = `${scopeText}: `;
      }

      lines.push(...scopes[scope].reverse().map(commit => `${padding}- ${prefix}${formatLine(commit, options)}`));
    });

  return lines;
}

function getUserGithub(userName: string) {
  const githubUrl = `https://github.com/${userName}`;

  return githubUrl;
}

function getGitUserAvatar(userName: string) {
  const githubUrl = getUserGithub(userName);

  const avatarUrl = `${githubUrl}.png?size=48`;

  return avatarUrl;
}

function createContributorLine(contributors: ResolvedAuthor[]) {
  let loginLine = '';
  let unLoginLine = '';

  const contributorMap = new Map<string, ResolvedAuthor>();
  contributors.forEach(contributor => {
    contributorMap.set(contributor.email, contributor);
  });

  const filteredContributors = Array.from(contributorMap.values());

  filteredContributors.forEach((contributor, index) => {
    const { name, email, login } = contributor;

    if (!login) {
      let line = `[${name}](mailto:${email})`;

      if (index < contributors.length - 1) {
        line += ',&nbsp;';
      }

      unLoginLine += line;
    } else {
      const githubUrl = getUserGithub(login);
      const avatar = getGitUserAvatar(login);
      loginLine += `[![${login}](${avatar})](${githubUrl})&nbsp;&nbsp;`;
    }
  });

  return `${loginLine}\n${unLoginLine}`;
}

export function generateMarkdown(params: {
  commits: GitCommit[];
  options: ChangelogOption;
  showTitle: boolean;
  contributors: ResolvedAuthor[];
}) {
  const { options, showTitle, contributors } = params;

  // filter commits means that release version
  const commits = params.commits.filter(commit => commit.description.match(VERSION_WITH_RELEASE) === null);

  const lines: string[] = [];

  const url = `https://github.com/${options.github.repo}/compare/${options.from}...${options.newVersion}`;

  if (showTitle) {
    const date = options.tagDateMap.get(options.newVersion) || dayjs().format('YY-MM-DD');

    let title = `## [${options.newVersion}](${url})`;

    if (date) {
      title += ` (${date})`;
    }

    lines.push(title);
  }

  const [breaking, changes] = partition(commits, c => c.isBreaking);

  const group = groupBy(changes, 'type');

  lines.push(...formatSection(breaking, options.titles.breakingChanges, options));

  for (const type of Object.keys(options.types)) {
    const items = group[type] || [];
    lines.push(...formatSection(items, options.types[type], options));
  }

  if (!lines.length) {
    lines.push('*No significant changes*');
  }

  if (!showTitle) {
    lines.push('', `##### &nbsp;&nbsp;&nbsp;&nbsp;[View changes on GitHub](${url})`);
  }

  if (showTitle) {
    lines.push('', '### &nbsp;&nbsp;&nbsp;❤️ Contributors', '');

    const contributorLine = createContributorLine(contributors);

    lines.push(contributorLine);
  }

  const md = convert(lines.join('\n').trim(), true);

  return md;
}

export async function isVersionInMarkdown(newVersion: string, mdPath: string) {
  let isIn = false;

  let md = '';
  try {
    md = await readFile(mdPath, 'utf8');
  } catch (error) {}

  if (md) {
    const matches = md.match(VERSION_REG_OF_MARKDOWN);

    if (matches?.length) {
      const versionInMarkdown = `## [${newVersion}]`;

      isIn = matches.includes(versionInMarkdown);
    }
  }

  return isIn;
}

export async function writeMarkdown(md: string, mdPath: string, regenerate = false) {
  let changelogMD: string = '';

  const changelogPrefix = '# Changelog';

  if (!existsSync(mdPath)) {
    await writeFile(mdPath, `${changelogPrefix}\n\n`, 'utf8');
  }

  if (!regenerate) {
    changelogMD = await readFile(mdPath, 'utf8');
  }

  if (!changelogMD.startsWith(changelogPrefix)) {
    changelogMD = `${changelogPrefix}\n\n${changelogMD}`;
  }

  const lastEntry = changelogMD.match(/^###?\s+.*$/m);

  if (lastEntry) {
    changelogMD = `${changelogMD.slice(0, lastEntry.index) + md}\n\n${changelogMD.slice(lastEntry.index)}`;
  } else {
    changelogMD += `\n${md}\n\n`;
  }

  await writeFile(mdPath, changelogMD);
}
