import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@soybeanjs/fetch', () => ({
  $fetch: vi.fn()
}));
vi.mock('execa');
vi.mock('consola', () => ({
  consola: {
    log: vi.fn(),
    error: vi.fn()
  }
}));

import { $fetch } from '@soybeanjs/fetch';
import { execa } from 'execa';
import { hasTagOnGitHub, isRepoShallow, sendRelease } from '../../packages/githublogen/src/github';
import type { ChangelogOption } from '../../src/types';

describe('githublogen github', () => {
  beforeEach(() => {
    vi.mocked($fetch).mockReset();
    vi.mocked(execa).mockReset();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('hasTagOnGitHub', () => {
    it('should return true when tag exists on GitHub', async () => {
      vi.mocked($fetch).mockResolvedValue({ ref: 'refs/tags/v1.0.0' } as any);

      const result = await hasTagOnGitHub('v1.0.0', 'test/repo', 'ghp_token');

      expect(result).toBe(true);
      expect($fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/test/repo/git/ref/tags/v1.0.0',
        expect.objectContaining({
          headers: expect.objectContaining({
            authorization: 'token ghp_token'
          })
        })
      );
    });

    it('should return false when tag does not exist (fetch fails)', async () => {
      vi.mocked($fetch).mockRejectedValue(new Error('404 Not Found') as any);

      const result = await hasTagOnGitHub('v999.0.0', 'test/repo', 'ghp_token');

      expect(result).toBe(false);
    });
  });

  describe('isRepoShallow', () => {
    it('should return true when repo is shallow clone', async () => {
      vi.mocked(execa).mockResolvedValue({ stdout: 'true' } as any);

      const result = await isRepoShallow();

      expect(result).toBe(true);
      expect(execa).toHaveBeenCalledWith('git', ['rev-parse', '--is-shallow-repository']);
    });

    it('should return false when repo is not shallow', async () => {
      vi.mocked(execa).mockResolvedValue({ stdout: 'false' } as any);

      const result = await isRepoShallow();

      expect(result).toBe(false);
    });
  });

  describe('sendRelease', () => {
    const createOptions = (overrides?: Partial<ChangelogOption>): ChangelogOption => ({
      cwd: '/fake',
      types: { feat: 'Features', fix: 'Bug Fixes' },
      github: { repo: 'test/repo', token: 'ghp_token' },
      from: 'v1.0.0',
      to: 'v1.1.0',
      tags: ['v1.0.0', 'v1.1.0'],
      tagDateMap: new Map(),
      capitalize: false,
      emoji: true,
      titles: { breakingChanges: 'Breaking Changes' },
      output: 'CHANGELOG.md',
      regenerate: false,
      prerelease: false,
      ...overrides
    });

    it('should create a new release when it does not exist', async () => {
      vi.mocked($fetch)
        .mockRejectedValueOnce(new Error('404') as any)
        .mockResolvedValueOnce({ html_url: 'https://github.com/test/repo/releases/tag/v1.1.0' } as any);

      const options = createOptions();
      await sendRelease(options, '## Release notes');

      expect($fetch).toHaveBeenCalledTimes(2);
      expect($fetch).toHaveBeenNthCalledWith(
        2,
        'https://api.github.com/repos/test/repo/releases',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            body: '## Release notes',
            draft: false,
            name: 'v1.1.0',
            prerelease: false,
            tag_name: 'v1.1.0'
          })
        })
      );
    });

    it('should update existing release when it exists', async () => {
      vi.mocked($fetch)
        .mockResolvedValueOnce({ url: 'https://api.github.com/repos/test/repo/releases/123' } as any)
        .mockResolvedValueOnce({ html_url: 'https://github.com/test/repo/releases/tag/v1.1.0' } as any);

      const options = createOptions();
      await sendRelease(options, '## Updated notes');

      expect($fetch).toHaveBeenCalledTimes(2);
      expect($fetch).toHaveBeenNthCalledWith(
        2,
        'https://api.github.com/repos/test/repo/releases/123',
        expect.objectContaining({
          method: 'PATCH'
        })
      );
    });

    it('should mark prerelease correctly', async () => {
      vi.mocked($fetch)
        .mockRejectedValueOnce(new Error('404') as any)
        .mockResolvedValueOnce({ html_url: 'https://github.com/test/repo/releases/tag/v1.1.0-beta.1' } as any);

      const options = createOptions({ to: 'v1.1.0-beta.1', prerelease: true });
      await sendRelease(options, '## Beta release');

      const secondCallBody = JSON.parse((vi.mocked($fetch).mock.calls[1][1] as any).body);
      expect(secondCallBody.prerelease).toBe(true);
      expect(secondCallBody.tag_name).toBe('v1.1.0-beta.1');
    });

    it('should throw when release creation fails', async () => {
      vi.mocked($fetch)
        .mockRejectedValueOnce(new Error('404') as any)
        .mockRejectedValueOnce(new Error('401 Unauthorized') as any);

      const options = createOptions();

      await expect(sendRelease(options, '## Notes')).rejects.toThrow('401 Unauthorized');
    });
  });
});
