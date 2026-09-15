# Remaining launch actions

Pick up here. Verification evidence is in [docs/validation.md](docs/validation.md);
finding-by-finding audit disposition is in
[CAUSEVAL_AUDIT_RESOLUTION.md](CAUSEVAL_AUDIT_RESOLUTION.md).

## Where things stand

`causeval@0.1.1` is live on npm. The site, docs, media and CI are current and
green. Two things gate the launch post: a live-provider smoke test, and the
GitHub release and tags.

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

## 2. Tags and GitHub release

- [ ] Create an immutable `v0.1.1` tag on the released commit.
- [ ] Move the floating `v0` tag to the same commit.
- [ ] Publish the 0.1.1 release from that tag.

`v0` currently points at `c9c0124`, the initial commit, so anyone using
`aravinda-1402/causeval/packages/action@v0` gets the original code rather than
0.1.1. A floating major tag is the GitHub Actions convention —
`actions/checkout@v4` moves with every 4.x release and users pinning it expect
fixes. Moving `v0` forward is the normal release action; `v0.1.1` stays fixed
for anyone who wants an exact pin.

```bash
git tag -a v0.1.1 -m "CausEval 0.1.1"
git push origin v0.1.1
git tag -f v0 && git push --force origin v0
```

Also confirm whether the pre-existing release is visible in the account; the
public API previously listed none.

## 3. Optional: Zenodo DOI

- [ ] Connect the repository to Zenodo and archive the chosen stable release.
      `CITATION.cff`, author metadata, Apache-2.0 and version are prepared. Add
      the DOI to citation metadata and any badge only after it is issued.

## 4. Launch post

- [ ] Publish after items 1 and 2 are done.

Draft text and the recording sequence are in
[docs/launch-demo.md](docs/launch-demo.md). The walkthrough video is
`docs/images/causeval-launch.mp4`; regenerate it with
`node scripts/capture-media.mjs`.

## Done

- [x] Publish `causeval@0.1.1` to npm. `npx --yes causeval@0.1.1 demo` verified
      in an empty directory outside the repository. Pending-publication notices
      removed; the npm quick start now leads, with the source checkout below it.
- [x] Upload the repository social preview.
- [x] Push the final changes, including the immutable audit and its resolution.
- [x] Deploy and verify the website routes. The temporary hosted preview passed
      all five routes and desktop/mobile tests, then was made private at the
      owner's request.
- [x] Prepare the captioned demo walkthrough with actual fixture numbers and its
      visible limitation notice.

Still worth setting if you have not: the repository website URL, the private
vulnerability reporting contact path, and topics — `llm-evaluation`,
`system-prompts`, `ai-testing`, `behavioral-testing`, `mutation-testing`,
`developer-tools`, `typescript`, `github-actions`.
