/**
 * the commit author
 */
export interface GitCommitAuthor {
  /**
   * the author name
   */
  name: string;
  /**
   * the author email
   */
  email: string;
}

/**
 * the raw git commit
 */
export interface RawGitCommit {
  /**
   * the commit message
   */
  message: string;
  /**
   * the commit body
   */
  body: string;
  /**
   * the commit hash
   */
  shortHash: string;
  /**
   * the commit author
   */
  author: GitCommitAuthor;
}

/**
 * the reference of the commit
 */
export interface Reference {
  /**
   * the reference type
   */
  type: 'hash' | 'issue' | 'pull-request';
  /**
   * the reference value
   */
  value: string;
}

/**
 * the resolved githhub author
 */
export interface ResolvedAuthor extends GitCommitAuthor {
  /**
   * the git commit of the author
   */
  commits: string[];
  /**
   * the github logined username of the author
   */
  login: string;
}

/**
 * git commit config
 */
export interface GitCommit extends RawGitCommit {
  /**
   * the commit description
   */
  description: string;
  /**
   * the commit scope type
   */
  type: string;
  /**
   * the commit scope
   */
  scope: string;
  /**
   * the commit references
   */
  references: Reference[];
  /**
   * the commit authors
   */
  authors: GitCommitAuthor[];
  /**
   * the resolved authors
   */
  resolvedAuthors: ResolvedAuthor[];
  /**
   * the commit breaking changes
   */
  isBreaking: boolean;
}

/**
 * github config
 */
export interface GithubConfig {
  /**
   * the github repository name
   * @example soybeanjs/changelog
   */
  repo: string;
  /**
   * the github token
   */
  token: string;
}

export interface ChangelogOption {
  /**
   * the directory of the project
   * @default process.cwd()
   */
  cwd: string;
  /**
   * the commit scope types
   */
  types: Record<string, string>;
  /**
   * github config
   */
  github: GithubConfig;
  /**
   * the commit hash or tag
   */
  from: string;
  /**
   * the commit hash or tag
   */
  to: string;
  /**
   * the whole commit tags
   */
  tags: string[];
  /**
   * the commit tag and date map
   */
  tagDateMap: Map<string, string>;
  /**
   * Whether to capitalize the first letter of the commit type
   */
  capitalize: boolean;
  /**
   * Use emojis in section titles
   * @default true
   */
  emoji: boolean;
  /**
   * the section titles
   */
  titles: {
    /**
     * the title of breaking changes section
     */
    breakingChanges: string;
  };
  /**
   * the output file path of the changelog
   */
  output: string;
  /**
   * Whether to regenerate the changelog if it already exists
   * @example the changelog already exists the content of v0.0.1, but you want to regenerate it
   */
  regenerate: boolean;
  /**
   * version from package.json, with preffix "v"
   * @description if the options "to" is not specified, the version will be used
   */
  newVersion: string;
}
