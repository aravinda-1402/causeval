# Remaining launch actions

Pick up here. Verification evidence is in [docs/validation.md](docs/validation.md);
finding-by-finding audit disposition is in
[CAUSEVAL_AUDIT_RESOLUTION.md](CAUSEVAL_AUDIT_RESOLUTION.md).

## Where things stand

`causeval@0.1.1` is live on npm and the website is live at
<https://aravinda-1402.github.io/causeval/>. Tags are cut, docs and media are
current, and CI is green.

**One thing gates the launch post: the live-provider smoke test.** Everything
else below is optional or cosmetic.

Working branch is `launch-completion-public`, pushed to `origin/main`. Build
with pnpm 10 and Node 22 (`pnpm install --frozen-lockfile && pnpm build`). The
full gate is `pnpm lint`, `format:check`, `typecheck`, `test`, `test:web`,
`release:check` and `pnpm audit`.

## 1. Live-provider smoke test — the last real blocker

- [ ] Run one budgeted smoke test against your intended provider and model, and
      record it in `docs/validation.md`.

Everything verified so far is deterministic fixture work. It proves the method
and the interface; it has never measured extraction or judging quality against a
real model. Until this runs, that quality is an unmeasured claim.

```bash
npx causeval init --dir ./my-agent
# point my-agent/causeval.config.ts at a real provider, then:
npx causeval scan   --config ./my-agent/causeval.config.ts --verbose
npx causeval verify --config ./my-agent/causeval.config.ts --runs 3 --verbose
```

Run `scan` first and read the extracted rules before spending anything on
`verify` — everything downstream depends on extraction being right. `verify`
re-runs every mapped eval repeatedly per rule; `--verbose` prints the provider
request count so the spend stays visible.

Record: model and date, rules extracted versus rules correct, bad mappings,
request count and rough cost, and the resulting Trace and Causal coverage.
Negative results are the useful ones. Keep the fixture disclaimer and do not
publish quality claims from a single run. Alternatives: the
[support project](examples/support-agent/README.md) with its provider changed,
or the [sandbox tool example](examples/tool-agent/README.md).

## 2. GitHub release and the floating tag

- [ ] Publish the 0.1.1 release from the `v0.1.1` tag.
- [ ] Optional: move `v0` forward to the tip of `main`.

Both tags exist and are pushed. `v0` and `v0.1.1` point at `20970ad`, which is
behind `main` by the two GitHub Pages commits. Those touch only
`.github/workflows/`, `apps/web` and docs — not `packages/action` or
`packages/cli` — so consumers of `packages/action@v0` and `causeval@0.1.1` get
identical behaviour either way.

If you want `v0` tracking latest, which is the GitHub Actions convention
(`actions/checkout@v4` moves with every 4.x release):

```bash
git tag -f v0 main && git push --force origin v0
```

Leave `v0.1.1` where it is. Moving an immutable tag after publishing it is the
thing worth avoiding.

Also confirm whether the pre-existing release is visible in the account; the
public API previously listed none.

## 3. Optional: Zenodo DOI

- [ ] Connect the repository to Zenodo and archive the chosen stable release.
      `CITATION.cff`, author metadata, Apache-2.0 and version are prepared. Add
      the DOI to citation metadata and any badge only after it is issued.

## 4. Repository metadata

- [ ] Put <https://aravinda-1402.github.io/causeval/> in the repository website
      field (the gear beside "About") and near the top of the README. The site
      is live but nothing links to it yet, so visitors still have no clickable
      demo.
- [ ] Set the private vulnerability reporting contact path.
- [ ] Topics, if not already set: `llm-evaluation`, `system-prompts`,
      `ai-testing`, `behavioral-testing`, `mutation-testing`, `developer-tools`,
      `typescript`, `github-actions`.

## 5. Launch post

- [ ] Publish after item 1 is done.

Draft text and the recording sequence are in
[docs/launch-demo.md](docs/launch-demo.md). The walkthrough video is
`docs/images/causeval-launch.mp4`; regenerate it with
`node scripts/capture-media.mjs`.

## Done

- [x] Publish `causeval@0.1.1` to npm. `npx --yes causeval@0.1.1 demo` verified
      in an empty directory outside the repository. Pending-publication notices
      removed; the npm quick start now leads, with the source checkout below it.
- [x] Upload the repository social preview.
- [x] Deploy the website to GitHub Pages. `.github/workflows/pages.yml` builds
      and publishes on every push to `main` and enables Pages on first run. The
      export is built with a matching `basePath`, since a project site is served
      from `/<repo>`; all five routes and the CSS were verified live.
- [x] Create `v0.1.1` and move `v0` off the initial commit.
- [x] Push the final changes, including the immutable audit and its resolution.
- [x] Prepare the captioned demo walkthrough with actual fixture numbers and its
      visible limitation notice.
