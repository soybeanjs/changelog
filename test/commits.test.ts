import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('execa');

import { execa } from 'execa';
import { getGitCommits } from '../src/git';

describe('getGitCommits - commit parsing', () => {
  beforeEach(() => {
    vi.mocked(execa).mockReset();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  function mockGitLog(rawOutput: string) {
    vi.mocked(execa).mockResolvedValue({ stdout: rawOutput } as any);
  }

  it('should parse feat commits', async () => {
    const raw = `----
feat: add new feature|abc123|John Doe|john@example.com

----
fix: resolve bug|def456|Jane Doe|jane@example.com
`;
    mockGitLog(raw);

    const commits = await getGitCommits('v1.0.0', 'v1.1.0');
    expect(commits).toHaveLength(2);
    expect(commits[0].type).toBe('feat');
    expect(commits[0].description).toBe('add new feature');
    expect(commits[0].scope).toBe('');
    expect(commits[0].isBreaking).toBe(false);
    expect(commits[1].type).toBe('fix');
    expect(commits[1].description).toBe('resolve bug');
  });

  it('should parse scoped commits', async () => {
    const raw = `----
feat(core): add core feature|abc123|John|john@test.com

`;
    mockGitLog(raw);

    const commits = await getGitCommits('v1.0.0');
    expect(commits).toHaveLength(1);
    expect(commits[0].type).toBe('feat');
    expect(commits[0].scope).toBe('core');
    expect(commits[0].description).toBe('add core feature');
  });

  it('should parse breaking changes with !', async () => {
    const raw = `----
feat!: breaking change|abc123|John|john@test.com

`;
    mockGitLog(raw);

    const commits = await getGitCommits('v1.0.0');
    expect(commits).toHaveLength(1);
    expect(commits[0].type).toBe('feat');
    expect(commits[0].isBreaking).toBe(true);
    expect(commits[0].description).toBe('breaking change');
  });

  it('should parse breaking changes with scope', async () => {
    const raw = `----
feat(api)!: breaking api change|abc123|John|john@test.com

`;
    mockGitLog(raw);

    const commits = await getGitCommits();
    expect(commits).toHaveLength(1);
    expect(commits[0].type).toBe('feat');
    expect(commits[0].scope).toBe('api');
    expect(commits[0].isBreaking).toBe(true);
  });

  it('should extract PR references from description', async () => {
    const raw = `----
fix: resolve issue (#123)|abc123|John|john@test.com

`;
    mockGitLog(raw);

    const commits = await getGitCommits();
    expect(commits).toHaveLength(1);
    expect(commits[0].description).toBe('resolve issue');
    const prRef = commits[0].references.find(r => r.type === 'pull-request');
    expect(prRef?.value).toBe('#123');
    const hashRef = commits[0].references.find(r => r.type === 'hash');
    expect(hashRef?.value).toBe('abc123');
  });

  it('should extract co-authors from commit body', async () => {
    const raw = `----
feat: add feature|abc123|John|john@test.com

Co-authored-by: Jane Doe <jane@example.com>
`;
    mockGitLog(raw);

    const commits = await getGitCommits();
    expect(commits).toHaveLength(1);
    expect(commits[0].authors).toHaveLength(2);
    expect(commits[0].authors[0].name).toBe('John');
    expect(commits[0].authors[1].name).toBe('Jane Doe');
    expect(commits[0].authors[1].email).toBe('jane@example.com');
  });

  it('should skip non-conventional commits', async () => {
    const raw = `----
just a random commit message|abc123|John|john@test.com

----
feat: valid commit|def456|Jane|jane@test.com
`;
    mockGitLog(raw);

    const commits = await getGitCommits();
    expect(commits).toHaveLength(1);
    expect(commits[0].type).toBe('feat');
  });

  it('should parse multiple commit types', async () => {
    const raw = `----
docs: update readme|abc123|John|john@test.com

----
chore: update deps|def456|Jane|jane@test.com

----
refactor: clean up code|ghi789|Bob|bob@test.com
`;
    mockGitLog(raw);

    const commits = await getGitCommits();
    expect(commits).toHaveLength(3);
    expect(commits.map(c => c.type)).toEqual(['docs', 'chore', 'refactor']);
  });

  it('should return empty array for no commits', async () => {
    mockGitLog('');
    const commits = await getGitCommits();
    expect(commits).toHaveLength(0);
  });

  it('should use HEAD as default to ref', async () => {
    mockGitLog('');
    await getGitCommits('v1.0.0');
    expect(execa).toHaveBeenCalledWith('git', expect.arrayContaining(['v1.0.0...HEAD']), undefined);
  });

  it('should not use "from..." prefix when from is empty', async () => {
    mockGitLog('');
    await getGitCommits('', 'v1.0.0');
    expect(execa).toHaveBeenCalledWith('git', expect.arrayContaining(['v1.0.0']), undefined);
  });
});
