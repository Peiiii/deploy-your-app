# GemiGo Static CLI Design

Date: 2026-04-16

## Overview

This document defines a new `GemiGo CLI` focused on one thing: publish an already-built static directory as a new GemiGo App.

The CLI is not a generic frontend deployment tool. It is a first-class platform entrypoint for GemiGo:

- The user logs into GemiGo
- The CLI creates a new project owned by that user
- The CLI uploads a static asset directory without running a build
- The deployment results in a real GemiGo App with metadata, slug, visibility, and final domain

If I were making the product decision alone, I would make the following choices:

- Scope v1 to pure static assets only
- Require login
- Prefer config-first automation for AI workflows
- Keep category and tags shared across locales in v1
- Make localized `name` and `description` extensible to any BCP-47 locale from day one
- Reuse the existing project/deploy backend instead of creating a parallel deployment system

## Goals

- Support `gemigo login` with browser-based OAuth
- Support `gemigo deploy <dir>` and `gemigo publish <dir>` as equivalent commands
- Create a new GemiGo project and immediately deploy it
- Validate that the input directory is static and does not trigger a build
- Persist extensible localized metadata on the project model
- Publish the CLI as an npm package and deploy the API changes needed for login and metadata support

## Non-goals

- No SSR, server functions, or dynamic backends
- No dependency install or build execution
- No full frontend UI redesign for localized metadata editing in this iteration
- No localization of category or tags in v1

## User Experience

### Login

Primary flow:

```bash
gemigo login
```

The CLI starts a localhost callback server, opens the browser to a GemiGo OAuth URL, receives a one-time token on the loopback callback, exchanges that token for a GemiGo session, and stores the session locally.

This reuses the same device-style token handoff pattern already used by desktop login, but extends it to loopback redirects.

### Deploy

Primary flow:

```bash
gemigo deploy ./dist --config ./gemigo.app.json
```

Alias:

```bash
gemigo publish ./dist --config ./gemigo.app.json
```

The command:

1. Loads and validates the manifest
2. Validates the target directory
3. Creates a project via the existing authenticated project API
4. Zips the static directory locally
5. Triggers a ZIP-based deploy using the existing deploy API
6. Streams logs until success or failure
7. Prints the final app URL and slug

## Manifest Design

The CLI is AI-first. The primary contract is a manifest file that AI can generate deterministically.

Recommended file name:

- `gemigo.app.json`

Example:

```json
{
  "$schema": "./packages/gemigo-cli/schema/gemigo.app.schema.json",
  "sourceDir": "./dist",
  "slug": "my-static-app",
  "visibility": "public",
  "category": "Tools",
  "tags": ["static", "tool", "ai-generated"],
  "defaultLocale": "en",
  "locales": {
    "en": {
      "name": "My Static App",
      "description": "A polished static app published to GemiGo."
    },
    "zh-CN": {
      "name": "我的静态应用",
      "description": "一个发布到 GemiGo 的精致静态应用。"
    }
  }
}
```

## Localization Model

### Why not hard-code zh/en fields

Hard-coded `nameZh` / `nameEn` fields lock the platform to a bilingual model and guarantee churn when a third locale arrives. That is the wrong long-term shape.

### External references

The design is inspired by the same principles used by VS Code extensions and Chrome extensions:

- Chrome extensions define a `default_locale` and resolve localized strings from locale-keyed resources
- VS Code extension manifests localize manifest-facing strings via `package.nls.json` and locale-specific variants

We will not copy their file layout directly because GemiGo stores app metadata in the platform database, not in extension package files. But we should copy the important ideas:

- stable default locale
- locale-keyed entries
- fallback to default locale
- extensibility to arbitrary locales

### Chosen structure

Project-level localized metadata:

```ts
type ProjectLocalization = {
  defaultLocale: string;
  locales: Record<string, {
    name: string;
    description?: string;
  }>;
};
```

Rules:

- `defaultLocale` is required when `locales` is provided
- locale keys should be valid BCP-47 strings when possible
- `locales[defaultLocale].name` is required
- `locales[defaultLocale].description` is strongly recommended and required by the CLI manifest
- flat `name` and `description` remain in the project record as compatibility fields derived from the default locale entry

## Data Model Changes

Add new optional project fields in the API worker persistence model:

- `default_locale TEXT`
- `localized_metadata TEXT` as JSON

Stored JSON shape:

```json
{
  "defaultLocale": "en",
  "locales": {
    "en": {
      "name": "My Static App",
      "description": "A polished static app published to GemiGo."
    },
    "zh-CN": {
      "name": "我的静态应用",
      "description": "一个发布到 GemiGo 的精致静态应用。"
    }
  }
}
```

Compatibility strategy:

- existing `name` and `description` stay in place
- reads return both flat fields and localized metadata when present
- writes with localized metadata derive flat fields from the default locale
- legacy flows without localized metadata continue to work

## API Changes

### Auth

Reuse the existing one-time desktop login token pattern for CLI login.

Change:

- OAuth callback should treat loopback redirects such as `http://127.0.0.1:<port>/callback` and `http://localhost:<port>/callback` as device-style redirects
- For those redirects, create a one-time login token and append `?token=...` to the loopback URL
- The CLI then calls the existing `/api/v1/auth/desktop/login?token=...` endpoint to exchange that token for a normal session cookie

This avoids inventing a second auth system.

### Project create/update

Extend project create and update payloads to accept:

```json
{
  "metadata": {
    "name": "...",
    "slug": "...",
    "description": "...",
    "category": "...",
    "tags": ["..."],
    "localization": {
      "defaultLocale": "en",
      "locales": {
        "en": { "name": "...", "description": "..." }
      }
    }
  }
}
```

## CLI Package Architecture

New package:

- `packages/gemigo-cli`

Key modules:

- `src/bin.ts`: CLI entrypoint and command parsing
- `src/config.ts`: manifest loading and validation
- `src/session-store.ts`: local session persistence
- `src/api.ts`: authenticated API client
- `src/login.ts`: browser login and loopback callback handling
- `src/static-site.ts`: static directory validation and ZIP creation
- `src/deploy.ts`: create project, deploy ZIP, and stream logs

## Static Validation Rules

The CLI must enforce static-only behavior. In v1:

- the directory must exist
- the directory must contain `index.html`
- the directory must not contain a top-level `package.json`

This is a deliberate product decision. If the user points at an app source root instead of a built static directory, the CLI should fail fast and tell them to provide the generated static output.

## Testing Strategy

Automated checks in this iteration:

- manifest parser and localization validation tests
- static directory validation tests
- CLI API integration smoke test with a mock HTTP server covering:
  - authenticated project creation
  - ZIP deploy request
  - SSE status handling
- root lint
- root typecheck
- dedicated worker typecheck

## Release Plan

1. Land the worker/API changes and CLI package
2. Run lint and typecheck
3. Run CLI tests
4. Publish the CLI package to npm
5. Deploy the API worker so loopback OAuth works in production
6. Verify `gemigo login` and `gemigo deploy` with a real static directory

## Risks

- OAuth loopback redirect handling must be strict enough to avoid open redirect abuse
- ZIP-over-JSON payload size may become a bottleneck for large static apps
- existing frontend surfaces remain flat-field-first and will not yet expose locale switching in this iteration

## Follow-up Work

- add `gemigo init` to scaffold the manifest
- add resumable uploads for large static sites
- add UI support for editing localized metadata
- add localized category/tag vocabularies if product needs them
