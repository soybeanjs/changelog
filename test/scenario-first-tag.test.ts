import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('execa');
vi.mock('node:fs/promises');
vi.mock('@soybeanjs/fetch', () => ({
  $fetch: vi.fn()
}));

import { readFile } from 'node:fs/promises';
import { $fetch } from '@soybeanjs/fetch';
import { execa } from 'execa';
import { getChangelogMarkdown } from '../src/index';

describe('Special scenario: first repo execution with only one tag', () => {
  const mockCwd = '/fake/first-release-repo';
  let originalCwd: () => string;
  let execaCallIndex = 0;
  let execaResponses: { stdout: string }[] = [];

  function setupExecaResponses(responses: { stdout: string }[]) {
    execaResponses = responses;
    execaCallIndex = 0;
    vi.mocked(execa).mockImplementation(async () => {
      const resp = execaResponses[execaCallIndex] || { stdout: '' };
      execaCallIndex++;
      return { stdout: resp.stdout } as any;
    });
  }

  beforeEach(() => {
    originalCwd = process.cwd;
    process.cwd = () => mockCwd;
    vi.mocked(execa).mockReset();
    vi.mocked(readFile).mockReset();
    vi.mocked($fetch).mockReset();
    delete process.env.GITHUB_TOKEN;
  });

  afterEach(() => {
    process.cwd = originalCwd;
    vi.resetAllMocks();
  });

  it('should generate changelog when repo has exactly one tag and package.json has matching version', async () => {
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({ version: '0.1.0' }) as any);
    vi.mocked($fetch).mockResolvedValue({ items: [] } as any);

    setupExecaResponses([
      { stdout: 'https://github.com/test/first-repo.git' },
      { stdout: 'v0.1.0' },
      { stdout: 'a1b2c3d4e5f6' },
      { stdout: '2024-01-01 12:00:00 +0800  (tag: v0.1.0)' },
      { stdout: 'v0.1.0' },
      { stdout: 'main' },
      {
        stdout: [
          '----',
          'feat: initial feature|abc123|Dev One|dev1@example.com',
          '',
          '----',
          'fix: fix initial bug|def456|Dev One|dev1@example.com',
          ''
        ].join('\n')
      }
    ]);

    const result = await getChangelogMarkdown({ cwd: mockCwd });

    expect(result.options.to).toBe('v0.1.0');
    expect(result.options.from).toBe('a1b2c3d4e5f6');
    expect(result.options.tags).toEqual(['v0.1.0']);
    expect(result.options.prerelease).toBe(false);
    expect(result.commits.length).toBe(2);
    expect(result.commits[0].type).toBe('feat');
    expect(result.commits[0].description).toBe('initial feature');
    expect(result.commits[1].type).toBe('fix');
    expect(result.commits[1].description).toBe('fix initial bug');
    expect(result.markdown).toContain('v0.1.0');
    expect(result.markdown).toContain('a1b2c3d4e5f6...v0.1.0');
    expect(result.markdown).toContain('initial feature');
    expect(result.markdown).not.toContain('Current ref');
  });

  it('should generate changelog with one tag when package.json has no version (monorepo root)', async () => {
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({ private: true, name: 'monorepo-root' }) as any);
    vi.mocked($fetch).mockResolvedValue({ items: [] } as any);

    setupExecaResponses([
      { stdout: 'https://github.com/org/monorepo.git' },
      { stdout: 'v0.1.0' },
      { stdout: '' },
      { stdout: 'v0.1.0' },
      { stdout: 'HEAD' },
      {
        stdout:
          '----\nchore: release v0.1.0|aaa|Bot|bot@example.com\n\n----\nfeat: the feature|bbb|Dev|dev@example.com\n\n'
      }
    ]);

    const result = await getChangelogMarkdown({ cwd: mockCwd });

    expect(result.options.to).toBe('v0.1.0');
    expect(result.markdown).toContain('the feature');
    expect(result.markdown).not.toContain('release v0.1.0');
  });

  it('should handle one tag with only release commit (no feature commits)', async () => {
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({ version: '0.1.0' }) as any);
    vi.mocked($fetch).mockResolvedValue({ items: [] } as any);

    setupExecaResponses([
      { stdout: 'https://github.com/test/repo.git' },
      { stdout: 'v0.1.0' },
      { stdout: 'firstcommit' },
      { stdout: '2024-01-01 00:00:00 +0000  (tag: v0.1.0)' },
      { stdout: 'v0.1.0' },
      { stdout: 'main' },
      { stdout: '----\nchore: release v0.1.0|abc|Bot|bot@example.com\n\n' }
    ]);

    const result = await getChangelogMarkdown({ cwd: mockCwd });

    expect(result.options.to).toBe('v0.1.0');
    expect(result.options.from).toBe('firstcommit');
    expect(result.markdown).toContain('v0.1.0');
  });

  it('should handle one prerelease tag', async () => {
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({ version: '1.0.0-beta.1' }) as any);
    vi.mocked($fetch).mockResolvedValue({ items: [] } as any);

    setupExecaResponses([
      { stdout: 'https://github.com/test/repo.git' },
      { stdout: 'v1.0.0-beta.1' },
      { stdout: 'firsthash' },
      { stdout: '2024-02-01 10:00:00 +0800  (tag: v1.0.0-beta.1)' },
      { stdout: 'v1.0.0-beta.1' },
      { stdout: 'develop' },
      { stdout: '----\nfeat: beta feature|abc|Dev|dev@example.com\n\n' }
    ]);

    const result = await getChangelogMarkdown({ cwd: mockCwd });

    expect(result.options.to).toBe('v1.0.0-beta.1');
    expect(result.options.prerelease).toBe(true);
    expect(result.markdown).toContain('beta feature');
  });

  it('should use current branch/tag when opts.to is not a valid version', async () => {
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({}) as any);
    vi.mocked($fetch).mockResolvedValue({ items: [] } as any);

    setupExecaResponses([
      { stdout: 'https://github.com/test/repo.git' },
      { stdout: '' },
      { stdout: '' },
      { stdout: '' },
      { stdout: 'main' },
      { stdout: '----\nfeat: some work|abc|Dev|dev@example.com\n\n' }
    ]);

    const result = await getChangelogMarkdown({ cwd: mockCwd });

    expect(result.options.to).toBe('main');
  });

  it('should NOT set opts.to to "v" when package.json version is empty', async () => {
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({ name: 'test' }) as any);
    vi.mocked($fetch).mockResolvedValue({ items: [] } as any);

    setupExecaResponses([
      { stdout: 'https://github.com/test/repo.git' },
      { stdout: 'v0.1.0' },
      { stdout: '' },
      { stdout: 'v0.1.0' },
      { stdout: 'main' },
      { stdout: '' }
    ]);

    const result = await getChangelogMarkdown({ cwd: mockCwd });

    expect(result.options.to).not.toBe('v');
    expect(result.options.to).toBe('v0.1.0');
  });

  it('should generate correct compare URL with first commit hash for single tag', async () => {
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({ version: '0.1.0' }) as any);
    vi.mocked($fetch).mockResolvedValue({ items: [] } as any);

    setupExecaResponses([
      { stdout: 'https://github.com/test/repo.git' },
      { stdout: 'v0.1.0' },
      { stdout: 'deadbeef1234' },
      { stdout: '2024-01-01 00:00:00 +0000  (tag: v0.1.0)' },
      { stdout: 'v0.1.0' },
      { stdout: 'main' },
      { stdout: '----\nfeat: init|abc|Dev|dev@test.com\n\n' }
    ]);

    const result = await getChangelogMarkdown({ cwd: mockCwd });

    expect(result.markdown).toContain('compare/deadbeef1234...v0.1.0');
    expect(result.options.from).toBe('deadbeef1234');
  });
});
