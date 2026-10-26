# Release changes

Run `npm run changeset` for changes that should appear in the next npm release.
Choose the appropriate semantic-version bump and describe the resulting user behavior.

Merging changes into `main` opens or updates the **Release Ludic Canvas** version PR.
Merging that PR publishes the new package version through the `release.yml` workflow
using npm trusted publishing. The first npm publication and trusted-publisher setup
must be completed by a package owner before automated publishing can succeed.

Documentation-only changes do not require a changeset. The workflow is idempotent
for versions already present on the registry.
