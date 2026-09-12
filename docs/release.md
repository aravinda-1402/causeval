# Release checklist

## 1. Quality gate

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm format:check
pnpm typecheck
pnpm build
pnpm test
pnpm exec playwright install chromium
pnpm test:web
pnpm demo:generate && git diff --exit-code
pnpm release:check
```

`pnpm release:check` packs the CLI, installs it into a clean temporary project
outside the workspace, and runs `init`, `scan`, `verify`, `generate`, `review`
and `demo` against the installed binary, then exercises the GitHub Action
against it.

## 2. Placeholder guard

`release:check` fails if the string `OWNER` or `REPLACE-BEFORE-RELEASE` reappears
in `packages/cli/package.json`, `packages/core/package.json`, `CITATION.cff`,
`.github/ISSUE_TEMPLATE/config.yml`, `packages/cli/README.md`, `README.md` or
`docs/github-action.md`. It exists so a published package can never carry a
broken repository link.

The repository is currently set to `https://github.com/aravinda-1402/causeval`.
If the repository name changes, update it in those files and in the website's
GitHub link.

## 3. Confirm the package name

```bash
npm view causeval
```

A 404 suggests the name is free; an authentication or network error proves
nothing. If it is taken, change `name` in `packages/cli/package.json`, keep
`bin.causeval`, and update every install example.

## 4. Inspect the tarball

```bash
pnpm --filter causeval pack --pack-destination /tmp
tar -tzf /tmp/causeval-0.1.0.tgz
```

It should contain `dist/`, `LICENSE`, `NOTICE`, `README.md` and `package.json`
and nothing else. The CLI bundles core, so it has no unpublished runtime
dependency.

## 5. Publish

Publish only with the owner's explicit authorisation. Tag the GitHub Action only
after its workflow has been exercised on GitHub, not just locally. Do not
advertise an action tag or an npm version before it exists.

## 6. Website

Deploy the static export following [deployment](deployment.md).

## Standing caveat

Provider protocol tests use mocked HTTP. Model-specific extraction and judging
quality have not been measured against a live endpoint; run a budgeted smoke
test with the provider you intend to recommend before publishing claims about
quality.
