# Remaining launch actions

Only actions that remain are listed here. Local verification evidence is in
[docs/validation.md](docs/validation.md); finding-by-finding disposition is in
[CAUSEVAL_AUDIT_RESOLUTION.md](CAUSEVAL_AUDIT_RESOLUTION.md).

## Engineering / research

- [ ] Run one budgeted live smoke test with your intended provider/model and
      record extraction/mapping mistakes, counts and cost in `docs/validation.md`.
      No provider credentials or local endpoint were available in this pass.
      Use [the support project](examples/support-agent/README.md) after changing
      its provider, or [the sandbox tool example](examples/tool-agent/README.md).
      Keep the fixture disclaimer and do not publish quality claims from one run.

## GitHub

- [x] Review and push the final changes, including the immutable audit and its
      resolution; hosted CI passed for commit `28e13af`.
- [ ] Upload `docs/images/social-preview.png` as repository social preview,
      set the website URL after deployment, and confirm the private vulnerability
      reporting contact path. Repository settings were not modified.

Suggested topics, if useful: `llm-evaluation`, `system-prompts`, `ai-testing`,
`behavioral-testing`, `mutation-testing`, `developer-tools`, `typescript`,
`github-actions`. Current description is already accurate; no branding change
is needed.

## Package

- [x] Publish the reviewed **0.1.1** CLI. `causeval@0.1.1` is live on npm;
      `npx --yes causeval@0.1.1 demo` was verified in an empty directory outside
      the repository. The CLI bundles core; a separate core publication is
      optional. Pending-publication notices have been removed and the npm
      quick-start now leads, with source-checkout instructions kept below it.

## Website

- [x] Set `NEXT_PUBLIC_SITE_URL` to the chosen HTTPS origin and deploy
      `apps/web/out` using [the deployment guide](docs/deployment.md). Build with
      `pnpm build` after setting that variable. Verify `/`, `/demo/`, `/docs/`,
      `/report.html` and `/social-preview.png` on the public domain.

The temporary hosted preview passed all five routes and desktop/mobile tests, then was made private at the owner's request.

## Release / Zenodo

- [ ] Confirm the existing release's visibility in your GitHub account. Its
      existence was supplied by you; the public API listed no visible releases.
      The existing `v0` tag was verified and must not be moved or recreated.
- [ ] If distributing these fixes through a GitHub release, publish a **new
      0.1.1 patch** from the reviewed commit. Preserve all existing releases/tags.
- [ ] If a DOI is desired, connect the repository to Zenodo and archive the
      chosen stable release. CITATION.cff, author metadata, Apache-2.0 and version
      are prepared. Add the real DOI to citation metadata/badge only after issuance.

## Demo / LinkedIn

- [x] Prepare the [demo walkthrough](docs/launch-demo.md) with actual fixture
      numbers and its visible limitation notice. A captioned 43-second MP4
      recording is available at `docs/images/causeval-launch.mp4`; regenerate it
      with `node scripts/capture-media.mjs`.
- [ ] Publish the launch post after npm publication and the live-provider smoke
      test are complete.
