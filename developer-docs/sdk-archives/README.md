# Immutable SDK releases

0.3.0 was distributed by the documentation site before registry publication. Its original release tarball is kept here so rebuilding the site preserves existing `/sdk/0.3.0/*` bytes. The current SDK is built from `packages/app-sdk`; `scripts/build-developer-docs.mjs` reads its version and restores archived distributions before copying the current release. Archive only previously shipped packages, never substitute new bytes for an existing version.
