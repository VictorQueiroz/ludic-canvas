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

## One-time owner setup

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

The configuration must make its first successful OIDC publication within npm's
current activation window (two days). Merge the version PR after setup, rather
than configuring an unused publisher indefinitely. If an identical publisher
already exists, inspect it with `npm trust list ludic-canvas` instead of replacing it.

GitHub's repository setting **Allow GitHub Actions to create and approve pull
requests** must be enabled so Changesets can create the version PR. Version jobs
have repository and PR write access; only the publish job receives OIDC access.
The workflow does not approve or merge the version PR.

## Verify a publication

```sh
npm view ludic-canvas version dist.integrity dist.attestations
npm install ludic-canvas react@19.3.1
npx ludic-canvas --version
```

Check the version and registry tarball, install it in an independent project,
generate a font atlas, and verify the documentation deployment for the same
commit. GitHub Actions publishes with npm provenance through OIDC.

References: [Changesets Action](https://github.com/changesets/action),
[npm trusted publishing](https://docs.npmjs.com/trusted-publishers/),
[npm trust prerequisites](https://docs.npmjs.com/cli/v11/commands/npm-trust/).
