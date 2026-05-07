---
name: gemigo-cli
description: Use when someone needs to install, log in to, configure, or operate the GemiGo CLI (`gemigo`), especially for its current static-site publishing workflow, or when an agent must create or validate `gemigo.app.json` and run real CLI commands.
---

# GemiGo CLI

## Overview

Use this skill when the task involves the `gemigo` CLI.

Current product scope:

- log in with `gemigo login`
- inspect login state with `gemigo whoami`
- clear login state with `gemigo logout`
- publish a prebuilt static site with `gemigo deploy` or `gemigo publish`

Current deployment scope is still intentionally narrow: this CLI only deploys already-built static output. It does not install dependencies, run `npm run build`, or infer metadata from the repo. Build first, then deploy the generated directory.

Treat this skill as the canonical entry point for the CLI. As the CLI grows, extend this skill instead of creating a new narrowly named skill unless a future capability truly becomes a separate product surface.

## Current Workflow

1. Confirm the target is a static output directory, not the source repository root.
2. Ensure the directory contains `index.html` at its root.
3. Ensure the directory does not contain a top-level `package.json`.
4. Create or validate `gemigo.app.json`.
5. Log in with `gemigo login`.
6. Deploy with `gemigo deploy` or `gemigo publish`.

## Command Reference

```bash
gemigo login [--origin https://gemigo.io] [--no-browser]
gemigo whoami [--origin https://gemigo.io]
gemigo logout
gemigo deploy <dir> [--config ./gemigo.app.json] [--origin https://gemigo.io]
gemigo publish <dir> [--config ./gemigo.app.json] [--origin https://gemigo.io]
```

Rules:

- `publish` is only an alias for `deploy`.
- Default origin is `https://gemigo.io`.
- `--origin` can be replaced by `GEMIGO_ORIGIN`.
- Saved login sessions are origin-specific. If origin changes, run `gemigo login` again.
- `gemigo login --no-browser` prints the login URL instead of opening the browser automatically.
- If future CLI commands are added, keep this section updated so the skill remains the single source of truth.

## Install

Use Node.js `>=18`.

Published package:

```bash
npm install -g gemigo
```

Inside this repository:

```bash
pnpm build:cli
node packages/gemigo-cli/dist/bin.js --help
```

## Manifest Rules

Create `gemigo.app.json` in the project root or pass a custom path with `--config`.

Required fields:

- `visibility`: `public` or `private`
- `category`
- `tags`: 1 to 5 strings
- `defaultLocale`
- `locales`
- `locales[defaultLocale].name`
- `locales[defaultLocale].description`

Optional fields:

- `sourceDir`
- `slug`
- extra locale entries such as `zh-CN`

Example:

```json
{
  "$schema": "https://gemigo.io/schema/gemigo.app.schema.json",
  "sourceDir": "./dist",
  "slug": "my-static-app",
  "visibility": "public",
  "category": "Tools",
  "tags": ["static", "demo"],
  "defaultLocale": "en",
  "locales": {
    "en": {
      "name": "My Static App",
      "description": "A static app published to GemiGo."
    }
  }
}
```

For portable manifests, prefer the hosted schema URL above. When working inside this repository, the same schema file also exists at `packages/gemigo-cli/schema/gemigo.app.schema.json`.

## Recommended Execution Pattern

If the user gives you source code only:

1. Detect the framework and build command.
2. Run the project build first.
3. Find the generated static directory, usually `dist` or `build`.
4. Create or fix `gemigo.app.json`.
5. Run `gemigo login` if there is no valid session.
6. Run `gemigo deploy <dir> --config <path>`.

If the user already gives you a built directory:

1. Validate the directory shape.
2. Create or fix `gemigo.app.json`.
3. Run `gemigo whoami` if login status is unclear.
4. Run `gemigo deploy`.

## Common Failure Modes

`No saved session found. Run "gemigo login" first.`

- No local session exists yet.

`Stored session is for ... Re-run "gemigo login" for ...`

- The current session was created against a different origin.

`Saved session is no longer valid. Run "gemigo login" again.`

- The server rejected the stored session cookie.

`Static directory must contain index.html at its root`

- The wrong directory was passed.

`Static directory must not contain a top-level package.json`

- The source repository root was passed instead of the built output directory.

## Current Limits

Do not claim that `gemigo` can do any of the following unless the CLI is extended in code first:

- install project dependencies
- build React, Vue, or Next.js projects automatically
- create projects from a git repository URL
- deploy server-side code
- infer missing manifest metadata

Stay inside the current command surface and make the build step explicit.

## Maintenance Rule

When new CLI commands or workflows are added:

1. Update this skill first.
2. Keep the overview split into current capabilities versus current limits.
3. Preserve backward-compatible guidance for existing commands unless the CLI behavior actually changed.
