import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('execa');

import { execa } from 'execa';
import {
  getCurrentGitBranch,
  getCurrentGitTag,
  getFirstGitCommit,
  getFromToTags,
  getGitHubRepo,
  getGitMainBranchName,
  getTagDateMap,
  getTotalGitTags,
  isPrerelease
} from '../src/git';

describe('git operations', () => {
  beforeEach(() => {
    vi.mocked(execa).mockReset();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getGitMainBranchName', () => {
    it('should return current branch name', async () => {
      vi.mocked(execa).mockResolvedValue({ stdout: 'main' } as any);
      const branch = await getGitMainBranchName();
      expect(branch).toBe('main');
      expect(execa).toHaveBeenCalledWith('git', ['rev-parse', '--abbrev-ref', 'HEAD'], undefined);
    });

    it('should return HEAD in detached state', async () => {
      vi.mocked(execa).mockResolvedValue({ stdout: 'HEAD' } as any);
      const branch = await getGitMainBranchName();
      expect(branch).toBe('HEAD');
    });
  });

  describe('getCurrentGitTag', () => {
    it('should return tag when HEAD is tagged', async () => {
      vi.mocked(execa).mockResolvedValue({ stdout: 'v1.0.0' } as any);
      const tag = await getCurrentGitTag();
      expect(tag).toBe('v1.0.0');
      expect(execa).toHaveBeenCalledWith('git', ['tag', '--points-at', 'HEAD'], undefined);
    });

    it('should return empty string when HEAD is not tagged', async () => {
      vi.mocked(execa).mockResolvedValue({ stdout: '' } as any);
      const tag = await getCurrentGitTag();
      expect(tag).toBe('');
    });
  });

  describe('getCurrentGitBranch', () => {
    it('should return tag when HEAD is tagged', async () => {
      vi.mocked(execa)
        .mockResolvedValueOnce({ stdout: 'v1.0.0' } as any)
        .mockResolvedValueOnce({ stdout: 'main' } as any);
      const result = await getCurrentGitBranch();
      expect(result).toBe('v1.0.0');
    });

    it('should return branch name when HEAD is not tagged', async () => {
      vi.mocked(execa)
        .mockResolvedValueOnce({ stdout: '' } as any)
        .mockResolvedValueOnce({ stdout: 'main' } as any);
      const result = await getCurrentGitBranch();
      expect(result).toBe('main');
    });

    it('should await getGitMainBranchName (not return a Promise)', async () => {
      vi.mocked(execa)
        .mockResolvedValueOnce({ stdout: '' } as any)
        .mockResolvedValueOnce({ stdout: 'develop' } as any);
      const result = await getCurrentGitBranch();
      expect(typeof result).toBe('string');
      expect(result).toBe('develop');
    });
  });

  describe('getTotalGitTags', () => {
    it('should return sorted version tags', async () => {
      vi.mocked(execa).mockResolvedValue({
        stdout: 'v1.2.0\nv1.0.0\nv1.1.0\nv1.3.0-beta.1'
      } as any);
      const tags = await getTotalGitTags();
      expect(tags).toEqual(['v1.0.0', 'v1.1.0', 'v1.2.0', 'v1.3.0-beta.1']);
    });

    it('should filter out non-version tags', async () => {
      vi.mocked(execa).mockResolvedValue({
        stdout: 'v1.0.0\nlatest\nstable\nv2.0.0\nsome-other-tag'
      } as any);
      const tags = await getTotalGitTags();
      expect(tags).toEqual(['v1.0.0', 'v2.0.0']);
    });

    it('should return empty array when no tags exist', async () => {
      vi.mocked(execa).mockResolvedValue({ stdout: '' } as any);
      const tags = await getTotalGitTags();
      expect(tags).toEqual([]);
    });

    it('should handle alpha and beta prerelease tags', async () => {
      vi.mocked(execa).mockResolvedValue({
        stdout: 'v1.0.0-alpha.1\nv1.0.0-beta.2\nv1.0.0'
      } as any);
      const tags = await getTotalGitTags();
      expect(tags).toEqual(['v1.0.0-alpha.1', 'v1.0.0-beta.2', 'v1.0.0']);
    });
  });

  describe('getTagDateMap', () => {
    it('should parse tag dates correctly', async () => {
      const logOutput = [
        '2024-01-15 10:00:00 +0800  (HEAD -> main, tag: v1.0.0, origin/main)',
        '2024-01-10 09:00:00 +0800  (tag: v0.1.1)',
        '2024-01-05 08:00:00 +0800  (tag: v0.1.0)'
      ].join('\n');
      vi.mocked(execa).mockResolvedValue({ stdout: logOutput } as any);

      const map = await getTagDateMap();
      expect(map.get('v1.0.0')).toBe('2024-01-15');
      expect(map.get('v0.1.1')).toBe('2024-01-10');
      expect(map.get('v0.1.0')).toBe('2024-01-05');
    });

    it('should return empty map for no tags', async () => {
      vi.mocked(execa).mockResolvedValue({ stdout: '' } as any);
      const map = await getTagDateMap();
      expect(map.size).toBe(0);
    });
  });

  describe('getFromToTags', () => {
    it('should return empty when fewer than 2 tags', () => {
      expect(getFromToTags([])).toEqual([]);
      expect(getFromToTags(['v1.0.0'])).toEqual([]);
    });

    it('should create from-to pairs for release tags', () => {
      const tags = ['v0.1.0', 'v0.2.0', 'v1.0.0'];
      const pairs = getFromToTags(tags);
      expect(pairs).toHaveLength(2);
      expect(pairs[0]).toEqual({ from: 'v0.1.0', to: 'v0.2.0' });
      expect(pairs[1]).toEqual({ from: 'v0.2.0', to: 'v1.0.0' });
    });

    it('should handle prerelease tags', () => {
      const tags = ['v1.0.0', 'v1.1.0-beta.1', 'v1.1.0'];
      const pairs = getFromToTags(tags);
      expect(pairs).toHaveLength(2);
      expect(pairs[0]).toEqual({ from: 'v1.0.0', to: 'v1.1.0-beta.1' });
      expect(pairs[1]).toEqual({ from: 'v1.0.0', to: 'v1.1.0' });
    });

    it('should return pairs in correct order (oldest to newest)', () => {
      const tags = ['v0.1.0', 'v0.2.0', 'v0.3.0'];
      const pairs = getFromToTags(tags);
      expect(pairs[0].from).toBe('v0.1.0');
      expect(pairs[pairs.length - 1].to).toBe('v0.3.0');
    });
  });

  describe('isPrerelease', () => {
    it('should return false for stable versions', () => {
      expect(isPrerelease('v0.1.0')).toBe(false);
      expect(isPrerelease('v1.0.0')).toBe(false);
      expect(isPrerelease('v10.20.30')).toBe(false);
    });

    it('should return true for prerelease versions', () => {
      expect(isPrerelease('v1.0.0-beta.1')).toBe(true);
      expect(isPrerelease('v1.0.0-alpha.1')).toBe(true);
      expect(isPrerelease('v1.0.0-rc.1')).toBe(true);
    });

    it('should return true for non-version strings', () => {
      expect(isPrerelease('main')).toBe(true);
      expect(isPrerelease('HEAD')).toBe(true);
      expect(isPrerelease('')).toBe(true);
      expect(isPrerelease('v')).toBe(true);
    });
  });

  describe('getGitHubRepo', () => {
    it('should parse HTTPS remote URL', async () => {
      vi.mocked(execa).mockResolvedValue({
        stdout: 'https://github.com/soybeanjs/changelog.git'
      } as any);
      const repo = await getGitHubRepo();
      expect(repo).toBe('soybeanjs/changelog');
    });

    it('should parse SSH remote URL', async () => {
      vi.mocked(execa).mockResolvedValue({
        stdout: 'git@github.com:soybeanjs/ubean.git'
      } as any);
      const repo = await getGitHubRepo();
      expect(repo).toBe('soybeanjs/ubean');
    });

    it('should parse URL without .git suffix', async () => {
      vi.mocked(execa).mockResolvedValue({
        stdout: 'https://github.com/owner/repo'
      } as any);
      const repo = await getGitHubRepo();
      expect(repo).toBe('owner/repo');
    });

    it('should throw for non-GitHub URLs', async () => {
      vi.mocked(execa).mockResolvedValue({
        stdout: 'https://gitlab.com/owner/repo.git'
      } as any);
      await expect(getGitHubRepo()).rejects.toThrow('Can not parse GitHub repo');
    });
  });

  describe('getFirstGitCommit', () => {
    it('should return the first commit hash', async () => {
      vi.mocked(execa).mockResolvedValue({ stdout: 'abc123def456' } as any);
      const hash = await getFirstGitCommit();
      expect(hash).toBe('abc123def456');
      expect(execa).toHaveBeenCalledWith('git', ['rev-list', '--max-parents=0', 'HEAD'], undefined);
    });
  });
});
