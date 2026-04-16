# @gemigo/cli

Publish an already-built static directory as a GemiGo App.

## Usage

```bash
gemigo login
gemigo deploy ./dist --config ./gemigo.app.json
```

`gemigo publish` is an alias for `gemigo deploy`.

## Manifest

Use `gemigo.app.json` to describe the app metadata:

```json
{
  "$schema": "./schema/gemigo.app.schema.json",
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
    }
  }
}
```
