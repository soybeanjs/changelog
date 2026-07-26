import { vi } from 'vitest';

export type ExecaMock = ReturnType<typeof vi.fn>;

export function setupExecaMock(impl: (cmd: string, args: string[]) => string | Promise<string>): ExecaMock {
  const execa = vi.fn(async (cmd: string, args: string[]) => ({
    stdout: (await impl(cmd, args)) ?? ''
  }));
  return execa;
}

export function createExecaResponder(responses: Record<string, string | (() => string)>) {
  return (cmd: string, args: string[]): string => {
    const key = `${cmd} ${args.join(' ')}`.trim();
    for (const [pattern, value] of Object.entries(responses)) {
      if (key.includes(pattern)) {
        return typeof value === 'function' ? value() : value;
      }
    }
    return '';
  };
}

export function createFetchResponder(responses: Record<string, any>) {
  return async (url: string, _opts?: any): Promise<any> => {
    for (const [pattern, value] of Object.entries(responses)) {
      if (url.includes(pattern)) {
        if (value instanceof Error) throw value;
        return typeof value === 'function' ? await value(url) : value;
      }
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  };
}

export function mockPkgJson(version: string, extra: Record<string, any> = {}) {
  return JSON.stringify({ version, ...extra });
}

export function createMockCommits(count: number, prefix = 'feat') {
  return Array.from({ length: count }, (_, i) => ({
    message: `${prefix}: commit ${i + 1}`,
    shortHash: `abc${i + 1}`,
    author: { name: `User${i + 1}`, email: `user${i + 1}@example.com` },
    body: ''
  }));
}
