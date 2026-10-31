# npm releases

The public npm package name is **ludic-canvas**. Changesets manages its version,
changelog and version pull request. Source changes do not publish immediately.

1. Add a changeset with `npm run changeset` when changing published behavior.
2. Merge the implementation into the default branch, `main`.
3. The release workflow runs checks on Linux, macOS and Windows, then opens or
   updates the **Release Ludic Canvas** PR.
4. Review and merge that version PR. After checks pass again, the workflow
   publishes the new npm version, creates its tag and GitHub release.

Documentation-only merges do not need a changeset. Already-published versions
are skipped. The reusable check workflow also runs for ordinary pull requests.
GitHub does not trigger ordinary PR workflows for PRs created with GITHUB_TOKEN;
the release workflow checks the versioned commit on main before publishing it.

## Verify a publication and its independent consumer

Refresh the intended npm dist-tag and release tag first. These commands use 0.6.0
as an example; substitute the exact requested version:

```sh
git fetch origin tag v0.6.0
npm view ludic-canvas dist-tags --json
npm view ludic-canvas@0.6.0 version gitHead dist.integrity dist.attestations
```

After the version actually exists on npm, update the standalone example's exact
dependency and lockfile. Keep this follow-up separate from the version PR so its
lock does not depend on an unpublished registry artifact:

```sh
npm --prefix examples/kestrel-survey install ludic-canvas@0.6.0 --save-exact --package-lock-only --ignore-scripts
npm run verify:release -- --version 0.6.0
```

The source-only verifier resolves local `vX.Y.Z` to its commit, checks the registry
package's version and `gitHead`, downloads the actual tarball and compares its
SHA-512 integrity. The committed example must pin that exact version and integrity.
It copies the example outside the checkout without dependency/build outputs or
font cache manifests, runs normal `npm ci`, imports the published API/assets,
generates both font atlases from source and builds the game. Package
manifests/locks must remain unchanged; the temporary project is removed afterward.
It does not replace the registry dependency with a local tarball or publish anything.

For a historical version, use an appropriate committed consumer revision whose
manifest and lock select that artifact. A mismatch remains a failed consumer check.

Reports default to unique files under `build/verification/<version>/`. Use
`--output path/to/report.json` to choose a report path. Started runs record passed,
failed and incomplete stages with the checkout/source identity. Network requests
have 60-second deadlines and each consumer command has a five-minute limit.
Inspect the failing stage before retrying; a failed run is not completed evidence.

Provenance metadata is required by this release contract and recorded in the
report. Its presence is not cryptographic signature/attestation validation;
[npm audit signatures](https://docs.npmjs.com/cli/commands/npm-audit) provides that
separate operation.

## Verify the documentation deployment

Use the existing Vercel project and canonical domain. Verify the deployment's
`READY` state, Git source SHA and canonical alias through the provider, then check
the public pages rather than relying only on a successful build:

```sh
npm run verify:release -- --version 0.6.0 --site https://libraries.ludic-canvas.victorqueiroz.dev
```

`--site` checks HTTP success and the version badge on the overview, guide, API,
Play, performance and 3D pages. It accepts a public base URL, including a path
prefix, without authentication parameters. It does not establish Vercel state or
deployment source identity; the report marks that distinction explicitly. Omit it
when verifying an older package against a newer website.

Record the npm release commit and deployment commit separately. A documentation
or example-pin follow-up can legitimately deploy a later commit. Compare relevant
SDK source before extending an earlier benchmark claim to that release. When
publishing performance evidence, fetch its deployed original files and verify
their committed checksums as described in [PERFORMANCE.md](PERFORMANCE.md).

The [PR wrapper](../.github/workflows/check.yml),
[reusable CI workflow](../.github/workflows/ci.yml) and
[release workflow](../.github/workflows/release.yml) are authoritative for gates,
runtime versions and permissions. Release checks explicitly request the full
matrix; the prose-only PR exclusions never apply to publication. A qualifying source/CI pass, a merged PR, an npm
publication and a READY deployment establish separate states. Retain retry and
platform limits in [QUALIFICATION_RESULTS.md](QUALIFICATION_RESULTS.md), and update
the dated [session handoff](SESSION_HANDOFF.md) with verified results.

## Historical one-time owner setup

npm requires a package to exist before a trusted publisher can be registered.
The first npm publication therefore needs an authenticated package owner.

```sh
npm login
npm run release:bootstrap
```

The bootstrap verifies and publishes the existing GitHub **v0.1.0** tarball,
then registers GitHub Actions as an npm trusted publisher. It never publishes
the unversioned working tree. The pinned SHA-256 is checked before publishing.
The original 0.1 release predates the font CLI. This bootstrap is a historical
first-publication path; the existing package already uses the trusted release
workflow. Routine releases do not need to repeat npm login or bootstrap.

Browser sign-in and two-factor authentication must be completed by the account
owner. No long-lived npm token is needed in GitHub secrets. The npm CLI must be
11.15.0+ for the trust command; the publish job pins npm 11.21.1 and Node 24.

The equivalent trusted-publisher settings are:

| Setting           | Value              |
| ----------------- | ------------------ |
| Provider          | GitHub Actions     |
| GitHub owner      | VictorQueiroz      |
| Repository        | ludic-canvas       |
| Workflow filename | release.yml        |
| Environment       | Unset              |
| Permission        | Direct npm publish |

Consult npm's current activation requirements when repairing or configuring a
publisher. If an identical publisher already exists, inspect it with
`npm trust list ludic-canvas` instead of replacing it.

GitHub's repository setting **Allow GitHub Actions to create and approve pull
requests** must be enabled so Changesets can create the version PR. Version jobs
have repository and PR write access; only the publish job receives OIDC access.
The workflow does not approve or merge the version PR.

References: [Changesets Action](https://github.com/changesets/action),
[npm trusted publishing](https://docs.npmjs.com/trusted-publishers/),
[npm trust prerequisites](https://docs.npmjs.com/cli/v11/commands/npm-trust/).
