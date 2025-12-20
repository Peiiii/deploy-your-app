# @gemigo/extension-sdk

GemiGo Extension SDK for building apps that run inside the GemiGo browser extension.

## Installation

### CDN (Recommended for simple apps)

```html
<script src="https://unpkg.com/@gemigo/extension-sdk/dist/gemigo-extension-sdk.umd.js"></script>
```

Or use jsDelivr:
```html
<script src="https://cdn.jsdelivr.net/npm/@gemigo/extension-sdk/dist/gemigo-extension-sdk.umd.js"></script>
```

### npm

```bash
npm install @gemigo/extension-sdk
```

## Quick Start

### CDN Usage

```html
<script src="https://unpkg.com/@gemigo/extension-sdk/dist/gemigo-extension-sdk.umd.js"></script>
<script>
  GemigoExtensionSDK.connect().then((gemigo) => {
    // Get current page info
    gemigo.getPageInfo().then(console.log);
    
    // Subscribe to context menu events
    gemigo.on('contextMenu', (event) => {
      console.log('Menu clicked:', event.menuId, event.selectionText);
    });
  });
</script>
```

### ES Module Usage

```js
import { connect } from '@gemigo/extension-sdk';

const gemigo = await connect();
const pageInfo = await gemigo.getPageInfo();
```

## API Reference

### `connect(): Promise<GemigoExtension>`

Connect to the GemiGo extension host. Must be called before using any SDK methods.

### Page APIs

| Method | Description |
|--------|-------------|
| `getPageInfo()` | Get current page URL, title, favicon |
| `getPageHTML()` | Get full page HTML content |
| `getPageText()` | Get page text content |
| `getSelection()` | Get selected text |
| `extractArticle()` | Extract article title, content, excerpt |

### Action APIs

| Method | Description |
|--------|-------------|
| `highlight(selector, color?)` | Highlight elements on page |
| `notify(title, message)` | Send system notification |
| `captureVisible()` | Capture screenshot of visible tab |

### Event APIs

| Method | Description |
|--------|-------------|
| `on('contextMenu', handler)` | Subscribe to context menu events |
| `off('contextMenu', handler?)` | Unsubscribe from events |
| `getContextMenuEvent()` | Get pending context menu event |

## Example: Translation App

```html
<!DOCTYPE html>
<html>
<head>
  <title>Translation App</title>
</head>
<body>
  <div id="result"></div>
  
  <script src="https://unpkg.com/@gemigo/extension-sdk/dist/gemigo-extension-sdk.umd.js"></script>
  <script>
    GemigoExtensionSDK.connect().then(async (gemigo) => {
      // Handle context menu "Translate" action
      gemigo.on('contextMenu', async (event) => {
        if (event.menuId === 'translate' && event.selectionText) {
          // Your translation logic here
          document.getElementById('result').textContent = 
            `Translating: ${event.selectionText}`;
        }
      });
    });
  </script>
</body>
</html>
```

## License

MIT
