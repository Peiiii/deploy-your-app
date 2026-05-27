# @gemigo/cli

`gemigo` is the GemiGo CLI for publishing an already-built static site directory as a GemiGo App.

## What It Does

`gemigo` currently focuses on one job: upload a prebuilt static directory to GemiGo.

It does not install dependencies, run framework builds, or infer your app metadata for you. Build first, then deploy the generated static output.

## Install

Requirements:

- Node.js `>=18`

Install from npm:

```bash
npm install -g gemigo
```

Or run it from this repo during development:

```bash
pnpm build:cli
node packages/gemigo-cli/dist/bin.js --help
```

## Command Summary

```bash
gemigo init [dir] [--config ./gemigo.app.json] [--name "My App"] [--description "..."] [--force]
gemigo validate [dir] [--config ./gemigo.app.json]
gemigo login [--origin https://gemigo.io] [--no-browser]
gemigo whoami [--origin https://gemigo.io]
gemigo logout
gemigo deploy <dir> [--config ./gemigo.app.json] [--origin https://gemigo.io]
gemigo publish <dir> [--config ./gemigo.app.json] [--origin https://gemigo.io]
```

`gemigo publish` is an alias for `gemigo deploy`.

## Recommended Workflow

### 1. Build your app first

Examples:

```bash
pnpm build
# or
npm run build
```

The final directory you deploy must:

- contain `index.html` at the directory root
- not contain a top-level `package.json`

Typical output folders are `dist`, `build`, or another static export directory.

### 2. Create or validate `gemigo.app.json`

Generate a complete manifest template:

```bash
gemigo init ./dist --config ./gemigo.app.json --name "My Static App" --description "A static app published to GemiGo."
```

Then preflight both the manifest and static directory before any remote deploy:

```bash
gemigo validate --config ./gemigo.app.json
```

`validate` is offline and does not require login.

Put the manifest in your project root and point `sourceDir` to the built output:

```json
{
  "$schema": "https://gemigo.io/schema/gemigo.app.schema.json",
  "sourceDir": "./dist",
  "slug": "my-static-app",
  "visibility": "public",
  "category": "Tools",
  "tags": ["static", "ai"],
  "defaultLocale": "en",
  "locales": {
    "en": {
      "name": "My Static App",
      "description": "A static app published to GemiGo."
    },
    "zh-CN": {
      "name": "我的静态应用",
      "description": "一个发布到 GemiGo 的静态应用。"
    }
  }
}
```

Manifest rules:

- `visibility` must be `public` or `private`
- `category` is required
- `tags` is required and supports `1` to `5` items
- `defaultLocale` is required
- `locales[defaultLocale].name` is required
- `locales[defaultLocale].description` is required
- `slug` is optional
- `sourceDir` is optional if you pass a directory directly to `gemigo deploy`

For portability, prefer the hosted schema URL:

```json
{
  "$schema": "https://gemigo.io/schema/gemigo.app.schema.json"
}
```

When working inside this repository, the same schema file also exists at `packages/gemigo-cli/schema/gemigo.app.schema.json`.

## Login

Login opens a browser by default:

```bash
gemigo login
```

After authorization, the temporary local callback redirects back to a GemiGo
success page so the browser does not stay on a `127.0.0.1` URL.

If you are on a remote machine or do not want the CLI to open the browser automatically:

```bash
gemigo login --no-browser
```

The CLI will print the login URL and wait for the callback on a local loopback port.

## Check Current Login

```bash
gemigo whoami
```

## Validate Before Deploy

```bash
gemigo validate ./dist --config ./gemigo.app.json
```

The command checks all manifest requirements and the static directory shape in
one local step. Use it before `deploy` so missing metadata is reported together
instead of being discovered during a remote deployment attempt.

## Deploy

Deploy by passing the static directory explicitly:

```bash
gemigo deploy ./dist --config ./gemigo.app.json
```

Or rely on `sourceDir` from the manifest:

```bash
gemigo deploy --config ./gemigo.app.json
```

Alias:

```bash
gemigo publish ./dist --config ./gemigo.app.json
```

## Custom Origin

By default the CLI uses `https://gemigo.io`.

You can override it per command:

```bash
gemigo login --origin https://staging.gemigo.io
gemigo deploy ./dist --origin https://staging.gemigo.io
```

Or set it once with an environment variable:

```bash
export GEMIGO_ORIGIN=https://staging.gemigo.io
gemigo login
gemigo deploy ./dist
```

Important: the saved login session is tied to the origin you used. If you switch origin later, log in again for that environment.

## Logout

```bash
gemigo logout
```

## Common Errors

`No saved session found. Run "gemigo login" first.`

- You have not logged in yet on this machine.

`Stored session is for ... Re-run "gemigo login" for ...`

- You logged in against a different `--origin` or `GEMIGO_ORIGIN`.

`Static directory must contain index.html at its root`

- You passed the wrong directory, or you tried to deploy source code instead of the built output.

`Static directory must not contain a top-level package.json`

- You likely pointed the CLI at the project root instead of the build output directory.

## Example End-To-End

```bash
pnpm build

cat > gemigo.app.json <<'EOF'
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
EOF

gemigo login
gemigo deploy --config ./gemigo.app.json
```
