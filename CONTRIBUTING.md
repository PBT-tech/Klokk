# Contributing to Klokk

Thanks for putting in the work to improve this project. This document covers what a contributor needs before opening a pull request.

## Before you start

- Search open issues and pull requests before starting substantial work, so two people don't build the same thing.
- This repository is connected to AI Studio. Do not force-push or rewrite pushed history.

## Development setup

```bash
git clone https://github.com/PBT-tech/Klokk
cd Klokk
bun install
```

See the [README](README.md#development) for the full local dev setup.

## Branching and commits

- Branch off `main` for every change. Name branches `feat/{short-description}` (e.g. `feat/add-search-filter`).
- Write commit messages in [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) format: `<type>[optional scope]: <description>`. Common types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`.
- Mark breaking changes with `!` before the colon (`feat!: ...`) or a `BREAKING CHANGE:` footer.
- Keep commits focused. If a commit conforms to more than one type, split it.

## Before opening a pull request

Run the full local gate:

```bash
bun run lint
bun run build
```

Both must pass. The pull request template will ask you to confirm this.

## Pull requests

- Fill out every section of the [pull request template](.github/PULL_REQUEST_TEMPLATE.md).
- Keep pull requests small and single-purpose. A PR that does three unrelated things is three PRs.
- Link the issue it closes, if any.
- Expect review comments to land in the blocker / suggestion / nit taxonomy; only blockers must be resolved before merge.

## Code review

- CODEOWNERS are requested automatically for files they own; wait for their approval on those paths.
- Address review feedback with new commits rather than force-pushing over history mid-review, so reviewers can see what changed.

## Reporting bugs and requesting features

Use the [issue templates](.github/ISSUE_TEMPLATE). Do not report security vulnerabilities as public issues: see [SECURITY.md](SECURITY.md).

## Release process

Merged changes to `main` sync to AI Studio. Record user-facing changes in [CHANGELOG.md](CHANGELOG.md) under Unreleased.
