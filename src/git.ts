import { ofetch } from 'ofetch';
import dayjs from 'dayjs';
import { execCommand, notNullish } from './shared';
import { VERSION_REG } from './constant';
import type { RawGitCommit, GitCommit, GitCommitAuthor, GithubConfig, Reference, ResolvedAuthor } from './types';

/**
 * get the total git tags
 */
export async function getTotalGitTags() {
  const tagStr = await execCommand('git', ['--no-pager', 'tag', '-l', '--sort=creatordate']);

  const tags = tagStr.split('\n');

  return tags;
}

/**
 * get map of the git tag and date
 */
export async function getTagDateMap() {
  const tagDateStr = await execCommand('git', [
    '--no-pager',
    'log',
    '--tags',
    '--simplify-by-decoration',
    '--pretty=format:%ci %d'
  ]);

  const TAG_MARK = 'tag: ';

  const map = new Map<string, string>();

  const dates = tagDateStr.split('\n').filter(item => item.includes(TAG_MARK));

  dates.forEach(item => {
    const [dateStr, tagStr] = item.split(TAG_MARK);

    const date = dayjs(dateStr).format('YYYY-MM-DD');

    const tag = tagStr.match(VERSION_REG)?.[0];
    if (tag && date) {
      map.set(tag.trim(), date);
    }
  });

  return map;
}

/**
 * get the git tags by formatting from-to style
 * @param tags git tags
 */
export function getFromToTags(tags: string[]) {
  const result: { from: string; to: string }[] = [];

  tags.forEach((tag, index) => {
    if (index < tags.length - 1) {
      result.push({ from: tag, to: tags[index + 1] });
    }
  });

  return result;
}

export async function getLastGitTag(delta = 0) {
  const tags = await getTotalGitTags();

  return tags[tags.length + delta - 1];
}

async function getGitMainBranchName() {
  const main = await execCommand('git', ['rev-parse', '--abbrev-ref', 'HEAD']);

  return main;
}

export async function getCurrentGitBranch() {
  const tag = await execCommand('git', ['tag', '--points-at', 'HEAD']);
  const main = getGitMainBranchName();

  return tag || main;
}

export async function getGitHubRepo() {
  const url = await execCommand('git', ['config', '--get', 'remote.origin.url']);
  const match = url.match(/github\.com[/:]([\w\d._-]+?)\/([\w\d._-]+?)(\.git)?$/i);
  if (!match) {
    throw new Error(`Can not parse GitHub repo from url ${url}`);
  }
  return `${match[1]}/${match[2]}`;
}

export function isPrerelease(version: string) {
  const REG = /^[^.]*[\d.]+$/;

  return !REG.test(version);
}

export function getFirstGitCommit() {
  return execCommand('git', ['rev-list', '--max-parents=0', 'HEAD']);
}

async function getGitDiff(from?: string, to = 'HEAD'): Promise<RawGitCommit[]> {
  // https://git-scm.com/docs/pretty-formats
  const rawGit = await execCommand('git', [
    '--no-pager',
    'log',
    `${from ? `${from}...` : ''}${to}`,
    '--pretty="----%n%s|%h|%an|%ae%n%b"',
    '--name-status'
  ]);

  const rwaGitLines = rawGit.split('----\n').splice(1);

  const gitCommits = rwaGitLines.map(line => {
    const [firstLine, ...body] = line.split('\n');
    const [message, shortHash, authorName, authorEmail] = firstLine.split('|');
    const gitCommit: RawGitCommit = {
      message,
      shortHash,
      author: { name: authorName, email: authorEmail },
      body: body.join('\n')
    };
    return gitCommit;
  });

  return gitCommits;
}

function parseGitCommit(commit: RawGitCommit): GitCommit | null {
  // https://www.conventionalcommits.org/en/v1.0.0/
  // https://regex101.com/r/FSfNvA/1
  const ConventionalCommitRegex = /(?<type>[a-z]+)(\((?<scope>.+)\))?(?<breaking>!)?: (?<description>.+)/i;
  const CoAuthoredByRegex = /co-authored-by:\s*(?<name>.+)(<(?<email>.+)>)/gim;
  const PullRequestRE = /\([a-z]*(#\d+)\s*\)/gm;
  const IssueRE = /(#\d+)/gm;

  const match = commit.message.match(ConventionalCommitRegex);

  if (!match?.groups) {
    return null;
  }

  const type = match.groups.type;

  const scope = match.groups.scope || '';

  const isBreaking = Boolean(match.groups.breaking);
  let description = match.groups.description;

  // Extract references from message
  const references: Reference[] = [];
  for (const m of description.matchAll(PullRequestRE)) {
    references.push({ type: 'pull-request', value: m[1] });
  }
  for (const m of description.matchAll(IssueRE)) {
    if (!references.some(i => i.value === m[1])) {
      references.push({ type: 'issue', value: m[1] });
    }
  }
  references.push({ value: commit.shortHash, type: 'hash' });

  // Remove references and normalize
  description = description.replace(PullRequestRE, '').trim();

  // Find all authors
  const authors: GitCommitAuthor[] = [commit.author];

  const matches = commit.body.matchAll(CoAuthoredByRegex);

  for (const $match of matches) {
    const { name = '', email = '' } = $match.groups || {};

    const author: GitCommitAuthor = {
      name: name.trim(),
      email: email.trim()
    };

    authors.push(author);
  }

  return {
    ...commit,
    authors,
    resolvedAuthors: [],
    description,
    type,
    scope,
    references,
    isBreaking
  };
}

export async function getGitCommits(from?: string, to = 'HEAD') {
  const rwaGitCommits = await getGitDiff(from, to);
  const commits = rwaGitCommits.map(commit => parseGitCommit(commit)).filter(notNullish);

  return commits;
}

function getHeaders(githubToken: string) {
  return {
    accept: 'application/vnd.github.v3+json',
    authorization: `token ${githubToken}`
  };
}

async function getResolvedAuthorLogin(github: GithubConfig, commitHashes: string[], email: string) {
  let login = '';

  try {
    const data = await ofetch(`https://ungh.cc/users/find/${email}`);
    login = data?.user?.username || '';
  } catch (e) {
    console.log('e: ', e);
  }

  if (login) {
    return login;
  }

  const { repo, token } = github;

  // token not provided, skip github resolving
  if (!token) {
    return login;
  }

  if (commitHashes.length) {
    try {
      const data = await ofetch(`https://api.github.com/repos/${repo}/commits/${commitHashes[0]}`, {
        headers: getHeaders(token)
      });
      login = data?.author?.login || '';
    } catch (e) {
      console.log('e: ', e);
    }
  }

  if (login) {
    return login;
  }

  try {
    const data = await ofetch(`https://api.github.com/search/users?q=${encodeURIComponent(email)}`, {
      headers: getHeaders(token)
    });
    login = data.items[0].login;
  } catch (e) {
    console.log('e: ', e);
  }

  return login;
}

export async function getGitCommitsAndResolvedAuthors(
  commits: GitCommit[],
  github: GithubConfig,
  resolvedLogins?: Map<string, string>
) {
  const resultCommits: GitCommit[] = [];

  const map = new Map<string, ResolvedAuthor>();

  for await (const commit of commits) {
    const resolvedAuthors: ResolvedAuthor[] = [];

    for await (const [index, author] of commit.authors.entries()) {
      const { email, name } = author;

      if (email && name) {
        const commitHashes: string[] = [];

        if (index === 0) {
          commitHashes.push(commit.shortHash);
        }

        const resolvedAuthor: ResolvedAuthor = {
          name,
          email,
          commits: commitHashes,
          login: ''
        };

        if (!resolvedLogins?.has(email)) {
          const login = await getResolvedAuthorLogin(github, commitHashes, email);
          resolvedAuthor.login = login;

          resolvedLogins?.set(email, login);
        } else {
          const login = resolvedLogins?.get(email) || '';
          resolvedAuthor.login = login;
        }

        resolvedAuthors.push(resolvedAuthor);

        if (!map.has(email)) {
          map.set(email, resolvedAuthor);
        }
      }
    }

    const resultCommit = { ...commit, resolvedAuthors };

    resultCommits.push(resultCommit);
  }

  return {
    commits: resultCommits,
    contributors: Array.from(map.values())
  };
}
