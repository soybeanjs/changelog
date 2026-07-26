import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('execa');
vi.mock('node:fs/promises');

import { readFile } from 'node:fs/promises';
import { execa } from 'execa';
import { createOptions } from '../src/options';

describe('createOptions', () => {
  const mockCwd = '/fake/repo';
  let originalCwd: () => string;

  function mockExecaSequence(responses: { stdout: string }[]) {
    let callIndex = 0;
    vi.mocked(execa).mockImplementation(async () => {
      const expected = responses[callIndex];
      callIndex++;
      return { stdout: expected?.stdout ?? '' } as any;
    });
  }

  beforeEach(() => {
    originalCwd = process.cwd;
    process.cwd = () => mockCwd;
    vi.mocked(execa).mockReset();
    vi.mocked(readFile).mockReset();
    delete process.env.GITHUB_TOKEN;
  });

  afterEach(() => {
    process.cwd = originalCwd;
    vi.resetAllMocks();
  });

  it('should create default options with package.json version', async () => {
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({ version: '1.2.3' }) as any);
    mockExecaSequence([
      { stdout: 'https://github.com/test/repo.git' },
      { stdout: 'v1.0.0\nv1.1.0\nv1.2.2' },
      { stdout: '' }
    ]);

    const opts = await createOptions({ cwd: mockCwd });

    expect(opts.cwd).toBe(mockCwd);
    expect(opts.to).toBe('v1.2.3');
    expect(opts.from).toBe('v1.2.2');
    expect(opts.github.repo).toBe('test/repo');
    expect(opts.tags).toEqual(['v1.0.0', 'v1.1.0', 'v1.2.2']);
    expect(opts.prerelease).toBe(false);
  });

  it('should handle package.json without version field (monorepo root case)', async () => {
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({ private: true }) as any);
    mockExecaSequence([
      { stdout: 'https://github.com/soybeanjs/ubean.git' },
      { stdout: 'v0.1.0\nv0.1.1' },
      { stdout: '' }
    ]);

    const opts = await createOptions({ cwd: mockCwd });

    expect(opts.to).toBe('');
    expect(opts.from).toBe('v0.1.1');
    expect(opts.github.repo).toBe('soybeanjs/ubean');
  });

  it('should handle missing package.json gracefully', async () => {
    vi.mocked(readFile).mockRejectedValue(new Error('ENOENT') as any);
    mockExecaSequence([{ stdout: 'https://github.com/test/repo.git' }, { stdout: 'v1.0.0' }, { stdout: '' }]);

    const opts = await createOptions({ cwd: mockCwd });

    expect(opts.to).toBe('');
    expect(opts.from).toBe('v1.0.0');
  });

  it('should set from to first commit when to equals from and no previous tag', async () => {
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({ version: '1.0.0' }) as any);
    mockExecaSequence([
      { stdout: 'https://github.com/test/repo.git' },
      { stdout: 'v1.0.0' },
      { stdout: 'abc123' },
      { stdout: '' }
    ]);

    const opts = await createOptions({ cwd: mockCwd });

    expect(opts.to).toBe('v1.0.0');
    expect(opts.from).toBe('abc123');
  });

  it('should detect prerelease versions', async () => {
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({ version: '1.0.0-beta.1' }) as any);
    mockExecaSequence([
      { stdout: 'https://github.com/test/repo.git' },
      { stdout: 'v0.9.0\nv1.0.0-beta.0' },
      { stdout: '' }
    ]);

    const opts = await createOptions({ cwd: mockCwd });

    expect(opts.to).toBe('v1.0.0-beta.1');
    expect(opts.prerelease).toBe(true);
  });

  it('should handle empty tags (new repo)', async () => {
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({ version: '0.1.0' }) as any);
    mockExecaSequence([{ stdout: 'https://github.com/test/repo.git' }, { stdout: '' }, { stdout: '' }]);

    const opts = await createOptions({ cwd: mockCwd });

    expect(opts.to).toBe('v0.1.0');
    expect(opts.from).toBe('');
    expect(opts.tags).toEqual([]);
  });

  it('should allow overriding options via parameter', async () => {
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({ version: '1.0.0' }) as any);
    mockExecaSequence([{ stdout: 'v0.9.0\nv1.0.0' }, { stdout: '' }]);

    const opts = await createOptions({
      cwd: mockCwd,
      from: 'v0.8.0',
      to: 'v1.0.0',
      github: { repo: 'custom/repo', token: 'ghp_test' }
    });

    expect(opts.from).toBe('v0.8.0');
    expect(opts.to).toBe('v1.0.0');
    expect(opts.github.repo).toBe('custom/repo');
    expect(opts.github.token).toBe('ghp_test');
  });

  it('should read GITHUB_TOKEN from environment', async () => {
    process.env.GITHUB_TOKEN = 'ghp_envtoken';
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({ version: '1.0.0' }) as any);
    mockExecaSequence([
      { stdout: 'https://github.com/test/repo.git' },
      { stdout: 'v1.0.0' },
      { stdout: 'abc123' },
      { stdout: '' }
    ]);

    const opts = await createOptions({ cwd: mockCwd });

    expect(opts.github.token).toBe('ghp_envtoken');
  });

  it('should populate tagDateMap', async () => {
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({ version: '1.0.0' }) as any);
    const logOutput = '2024-01-15 10:00:00 +0800  (tag: v1.0.0)\n2024-01-01 09:00:00 +0800  (tag: v0.9.0)';
    mockExecaSequence([
      { stdout: 'https://github.com/test/repo.git' },
      { stdout: 'v0.9.0\nv1.0.0' },
      { stdout: 'abc123' },
      { stdout: logOutput }
    ]);

    const opts = await createOptions({ cwd: mockCwd });

    expect(opts.tagDateMap.get('v1.0.0')).toBe('2024-01-15');
    expect(opts.tagDateMap.get('v0.9.0')).toBe('2024-01-01');
  });

  it('should not set opts.to to "v" when package.json has no version', async () => {
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({ name: 'test', private: true }) as any);
    mockExecaSequence([{ stdout: 'https://github.com/test/repo.git' }, { stdout: '' }, { stdout: '' }]);

    const opts = await createOptions({ cwd: mockCwd });

    expect(opts.to).not.toBe('v');
    expect(opts.to).toBe('');
  });

  it('should handle prerelease to stable transition', async () => {
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({ version: '1.0.0' }) as any);
    mockExecaSequence([
      { stdout: 'https://github.com/test/repo.git' },
      { stdout: 'v0.9.0\nv1.0.0-beta.1\nv1.0.0' },
      { stdout: 'abc123' },
      { stdout: '' }
    ]);

    const opts = await createOptions({ cwd: mockCwd });

    expect(opts.to).toBe('v1.0.0');
    expect(opts.from).toBe('v0.9.0');
    expect(opts.prerelease).toBe(false);
  });
});
