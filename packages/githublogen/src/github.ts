import type { ChangelogOption } from '@soybeanjs/changelog';
import { ofetch } from 'ofetch';
import { consola } from 'consola';
import { cyan, green, red, yellow } from 'kolorist';

function getHeaders(githubToken: string) {
  return {
    accept: 'application/vnd.github.v3+json',
    authorization: `token ${githubToken}`
  };
}

export async function hasTagOnGitHub(tag: string, repo: string, githubToken: string) {
  try {
    await ofetch(`https://api.github.com/repos/${repo}/git/ref/tags/${tag}`, {
      headers: getHeaders(githubToken)
    });
    return true;
  } catch {
    return false;
  }
}

export async function sendRelease(options: ChangelogOption, content: string) {
  const headers = getHeaders(options.github.token!);

  const github = options.github.repo;

  let url = `https://api.github.com/repos/${github}/releases`;
  let method = 'POST';

  try {
    const exists = await ofetch(`https://api.github.com/repos/${github}/releases/tags/${options.to}`, {
      headers
    });
    if (exists.url) {
      url = exists.url;
      method = 'PATCH';
    }
  } catch {}

  const body = {
    body: content,
    draft: false,
    name: options.to,
    prerelease: options.prerelease,
    tag_name: options.to
  };

  const webUrl = `https://github.com/${github}/releases/new?title=${encodeURIComponent(
    String(body.name)
  )}&body=${encodeURIComponent(String(body.body))}&tag=${encodeURIComponent(String(options.to))}&prerelease=${
    options.prerelease
  }`;

  try {
    consola.log(cyan(method === 'POST' ? 'Creating release notes...' : 'Updating release notes...'));
    const res = await ofetch(url, {
      method,
      body: JSON.stringify(body),
      headers
    });
    consola.log(green(`Released on ${res.html_url}`));
  } catch (e) {
    consola.error(red('Failed to create the release. Using the following link to create it manually:'));
    consola.error(yellow(webUrl));

    throw e;
  }
}

async function execCommand(cmd: string, args: string[]) {
  const { execa } = await import('execa');
  const res = await execa(cmd, args);
  return res.stdout.trim();
}

export async function isRepoShallow() {
  return (await execCommand('git', ['rev-parse', '--is-shallow-repository'])).trim() === 'true';
}
