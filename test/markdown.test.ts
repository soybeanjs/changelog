import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('execa');
vi.mock('node:fs');
vi.mock('node:fs/promises');

import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { execa } from 'execa';
import { generateMarkdown, isVersionInMarkdown, writeMarkdown } from '../src/markdown';
import type { ChangelogOption, GitCommit, ResolvedAuthor } from '../src/types';

function createDefaultOptions(overrides?: Partial<ChangelogOption>): ChangelogOption {
  return {
    cwd: '/fake',
    types: {
      feat: '🚀 Features',
      fix: '🐞 Bug Fixes',
      chore: '🏡 Chore'
    },
    github: { repo: 'test/repo', token: '' },
    from: 'v1.0.0',
    to: 'v1.1.0',
    tags: ['v1.0.0', 'v1.1.0'],
    tagDateMap: new Map([['v1.1.0', '2024-01-15']]),
    capitalize: false,
    emoji: true,
    titles: { breakingChanges: '🚨 Breaking Changes' },
    output: 'CHANGELOG.md',
    regenerate: false,
    ...overrides
  };
}

function createCommit(overrides?: Partial<GitCommit>): GitCommit {
  return {
    message: '',
    shortHash: 'abc123',
    author: { name: 'Test', email: 'test@example.com' },
    body: '',
    authors: [{ name: 'Test', email: 'test@example.com' }],
    resolvedAuthors: [],
    description: 'test commit',
    type: 'feat',
    scope: '',
    references: [{ type: 'hash', value: 'abc123' }],
    isBreaking: false,
    ...overrides
  };
}

describe('markdown generation', () => {
  beforeEach(() => {
    vi.mocked(execa).mockReset();
    vi.mocked(existsSync).mockReset();
    vi.mocked(readFile).mockReset();
    vi.mocked(writeFile).mockReset();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('generateMarkdown', () => {
    it('should generate markdown with title', async () => {
      const commits = [createCommit({ type: 'feat', description: 'add feature' })];
      const contributors: ResolvedAuthor[] = [];
      const options = createDefaultOptions();

      const md = await generateMarkdown({ commits, options, showTitle: true, contributors });

      expect(md).toContain('## [v1.1.0]');
      expect(md).toContain('2024-01-15');
      expect(md).toContain('add feature');
      expect(md).toContain('🚀 Features');
      expect(md).toContain('compare/v1.0.0...v1.1.0');
    });

    it('should generate markdown without title', async () => {
      const commits = [createCommit({ type: 'fix', description: 'fix bug' })];
      const options = createDefaultOptions();

      const md = await generateMarkdown({ commits, options, showTitle: false, contributors: [] });

      expect(md).not.toContain('## [v1.1.0]');
      expect(md).toContain('fix bug');
      expect(md).toContain('🐞 Bug Fixes');
      expect(md).toContain('View changes on GitHub');
    });

    it('should group commits by type', async () => {
      const commits = [
        createCommit({ type: 'feat', description: 'feature A', shortHash: 'aaa' }),
        createCommit({ type: 'fix', description: 'bug fix B', shortHash: 'bbb' }),
        createCommit({ type: 'feat', description: 'feature C', shortHash: 'ccc' })
      ];
      const options = createDefaultOptions();

      const md = await generateMarkdown({ commits, options, showTitle: true, contributors: [] });

      expect(md).toContain('🚀 Features');
      expect(md).toContain('🐞 Bug Fixes');
      expect(md).toContain('feature A');
      expect(md).toContain('bug fix B');
      expect(md).toContain('feature C');
    });

    it('should handle breaking changes', async () => {
      const commits = [createCommit({ type: 'feat', description: 'breaking change', isBreaking: true })];
      const options = createDefaultOptions();

      const md = await generateMarkdown({ commits, options, showTitle: true, contributors: [] });

      expect(md).toContain('🚨 Breaking Changes');
      expect(md).toContain('breaking change');
    });

    it('should show "No significant changes" when no commits (no title)', async () => {
      const options = createDefaultOptions();

      const md = await generateMarkdown({ commits: [], options, showTitle: false, contributors: [] });

      expect(md).toContain('No significant changes');
    });

    it('should filter out release version commits', async () => {
      const commits = [
        createCommit({ type: 'chore', description: 'release v1.1.0', message: 'chore: release v1.1.0' }),
        createCommit({ type: 'feat', description: 'actual feature' })
      ];
      const options = createDefaultOptions();

      const md = await generateMarkdown({ commits, options, showTitle: true, contributors: [] });

      expect(md).not.toContain('release v1.1.0');
      expect(md).toContain('actual feature');
    });

    it('should handle scoped commits', async () => {
      const commits = [
        createCommit({ type: 'feat', scope: 'core', description: 'core feature', shortHash: 'aaa' }),
        createCommit({ type: 'feat', scope: 'core', description: 'another core feature', shortHash: 'bbb' }),
        createCommit({ type: 'feat', scope: 'ui', description: 'ui feature', shortHash: 'ccc' })
      ];
      const options = createDefaultOptions();

      const md = await generateMarkdown({ commits, options, showTitle: true, contributors: [] });

      expect(md).toContain('**core**');
      expect(md).toContain('core feature');
      expect(md).toContain('ui feature');
    });

    it('should include contributor avatars when showTitle is true', async () => {
      const commits = [createCommit()];
      const contributors: ResolvedAuthor[] = [
        { name: 'John', email: 'john@test.com', login: 'johndoe', commits: ['abc123'] }
      ];
      const options = createDefaultOptions();

      const md = await generateMarkdown({ commits, options, showTitle: true, contributors });

      expect(md).toContain('❤️ Contributors');
      expect(md).toContain('johndoe');
      expect(md).toContain('github.com/johndoe');
    });

    it('should include mailto links for contributors without login', async () => {
      const commits = [createCommit()];
      const contributors: ResolvedAuthor[] = [{ name: 'John', email: 'john@test.com', login: '', commits: ['abc123'] }];
      const options = createDefaultOptions();

      const md = await generateMarkdown({ commits, options, showTitle: true, contributors });

      expect(md).toContain('mailto:john@test.com');
      expect(md).toContain('John');
    });

    it('should strip emojis when emoji option is false', async () => {
      const commits = [createCommit({ type: 'feat', description: 'feature' })];
      const options = createDefaultOptions({ emoji: false });

      const md = await generateMarkdown({ commits, options, showTitle: true, contributors: [] });

      expect(md).not.toContain('🚀');
      expect(md).toContain('Features');
    });

    it('should use current date when tag date not found', async () => {
      const commits = [createCommit()];
      const options = createDefaultOptions({ tagDateMap: new Map() });

      const md = await generateMarkdown({ commits, options, showTitle: true, contributors: [] });

      expect(md).toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    it('should handle empty from (first release) by comparing against main branch', async () => {
      vi.mocked(execa).mockResolvedValue({ stdout: 'main' } as any);
      const commits = [createCommit({ type: 'feat', description: 'initial feature' })];
      const options = createDefaultOptions({ from: '' });

      const md = await generateMarkdown({ commits, options, showTitle: true, contributors: [] });

      expect(execa).toHaveBeenCalledWith('git', ['rev-parse', '--abbrev-ref', 'HEAD'], undefined);
      expect(md).toContain('compare/v1.1.0...main');
    });

    it('should use HEAD when main branch detection fails in first release', async () => {
      vi.mocked(execa).mockResolvedValue({ stdout: '' } as any);
      const commits = [createCommit()];
      const options = createDefaultOptions({ from: '' });

      const md = await generateMarkdown({ commits, options, showTitle: true, contributors: [] });

      expect(md).toContain('compare/v1.1.0...HEAD');
    });

    it('should generate GitHub links for references when repo is set', async () => {
      const commits = [
        createCommit({
          type: 'fix',
          description: 'fix issue',
          references: [
            { type: 'pull-request', value: '#42' },
            { type: 'hash', value: 'abc1234567890' }
          ]
        })
      ];
      const options = createDefaultOptions();

      const md = await generateMarkdown({ commits, options, showTitle: false, contributors: [] });

      expect(md).toContain('github.com/test/repo/issues/42');
      expect(md).toContain('github.com/test/repo/commit/abc1234567890');
    });

    it('should not generate reference links when github repo is empty', async () => {
      const commits = [
        createCommit({
          type: 'fix',
          description: 'fix issue',
          references: [
            { type: 'pull-request', value: '#42' },
            { type: 'hash', value: 'abc1234567890' }
          ]
        })
      ];
      const options = createDefaultOptions({ github: { repo: '', token: '' } });

      const md = await generateMarkdown({ commits, options, showTitle: false, contributors: [] });

      expect(md).toContain('#42');
      expect(md).toContain('abc123');
      expect(md).not.toContain('github.com/test/repo/issues');
      expect(md).not.toContain('github.com/test/repo/commit');
    });
  });

  describe('isVersionInMarkdown', () => {
    it('should return true when version exists in markdown', async () => {
      vi.mocked(readFile).mockResolvedValue('# Changelog\n\n## [v1.0.0]\n\n- feat: something\n' as any);

      const result = await isVersionInMarkdown('v1.0.0', '/fake/CHANGELOG.md');

      expect(result).toBe(true);
    });

    it('should return false when version does not exist', async () => {
      vi.mocked(readFile).mockResolvedValue('# Changelog\n\n## [v0.9.0]\n\n- feat: old\n' as any);

      const result = await isVersionInMarkdown('v1.0.0', '/fake/CHANGELOG.md');

      expect(result).toBe(false);
    });

    it('should return false when file does not exist', async () => {
      vi.mocked(readFile).mockRejectedValue(new Error('ENOENT') as any);

      const result = await isVersionInMarkdown('v1.0.0', '/fake/CHANGELOG.md');

      expect(result).toBe(false);
    });

    it('should return false for empty file', async () => {
      vi.mocked(readFile).mockResolvedValue('' as any);

      const result = await isVersionInMarkdown('v1.0.0', '/fake/CHANGELOG.md');

      expect(result).toBe(false);
    });

    it('should detect prerelease versions', async () => {
      vi.mocked(readFile).mockResolvedValue('# Changelog\n\n## [v1.0.0-beta.1]\n\n- feat: beta\n' as any);

      const result = await isVersionInMarkdown('v1.0.0-beta.1', '/fake/CHANGELOG.md');

      expect(result).toBe(true);
    });
  });

  describe('writeMarkdown', () => {
    it('should create changelog file if it does not exist', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(writeFile).mockResolvedValue(undefined as any);
      vi.mocked(readFile).mockResolvedValue('# Changelog\n\n' as any);

      await writeMarkdown('## [v1.0.0]\n\n- feat: test', '/fake/CHANGELOG.md');

      expect(writeFile).toHaveBeenCalledWith('/fake/CHANGELOG.md', '# Changelog\n\n', 'utf8');
    });

    it('should prepend # Changelog prefix if missing', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue('old content' as any);
      vi.mocked(writeFile).mockResolvedValue(undefined as any);

      await writeMarkdown('## [v1.0.0]\n\n- feat: new', '/fake/CHANGELOG.md');

      const writtenContent = vi.mocked(writeFile).mock.calls[0][1];
      expect(writtenContent).toContain('# Changelog');
      expect(writtenContent).toContain('## [v1.0.0]');
    });

    it('should insert new entry before old entries', async () => {
      const existingContent = '# Changelog\n\n## [v1.0.0]\n\n- feat: old\n';
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue(existingContent as any);
      vi.mocked(writeFile).mockResolvedValue(undefined as any);

      await writeMarkdown('## [v1.1.0]\n\n- feat: new', '/fake/CHANGELOG.md');

      const writtenContent = vi
        .mocked(writeFile)
        .mock.calls.find(
          call =>
            call[0] === '/fake/CHANGELOG.md' && typeof call[1] === 'string' && (call[1] as string).includes('v1.1.0')
        )?.[1] as string;
      expect(writtenContent).toContain('## [v1.1.0]');
      expect(writtenContent).toContain('## [v1.0.0]');
      expect(writtenContent.indexOf('v1.1.0')).toBeLessThan(writtenContent.indexOf('v1.0.0'));
    });

    it('should regenerate entire file when regenerate is true', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(writeFile).mockResolvedValue(undefined as any);

      await writeMarkdown('# Changelog\n\n## [v1.0.0]\n\n- feat: regenerated', '/fake/CHANGELOG.md', true);

      expect(readFile).not.toHaveBeenCalled();
      const writtenContent = vi.mocked(writeFile).mock.calls[0][1];
      expect(writtenContent).toContain('# Changelog');
      expect(writtenContent).toContain('## [v1.0.0]');
    });
  });
});
