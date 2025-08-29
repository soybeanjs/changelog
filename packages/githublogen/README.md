# githublogen

Generate changelog for GitHub releases from [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/), powered by [changelogithub](https://github.com/antfu/changelogithub).

Auto Generate CHANGELOG.md from [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/), powered by [changelogen](https://github.com/unjs/changelogen).

## Usage

In GitHub Actions:

```yml
# .github/workflows/release.yml

name: Release

permissions:
  contents: write

on:
  push:
    tags:
      - "v*"

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v3
        with:
          node-version: 16.x

      - run: npx githublogen
        env:
          GITHUB_TOKEN: ${{secrets.GITHUB_TOKEN}}
```

It will be triggered whenever you push a tag to GitHub that starts with `v`.

## Configuration

You can put a configuration file in the project root, named as `githublogen.config.{json,ts,js,mjs,cjs}`, `.githublogenrc` or use the `githublogen` field in `package.json`.

## Preview Locally

```bash
npx githublogen --dry
```
