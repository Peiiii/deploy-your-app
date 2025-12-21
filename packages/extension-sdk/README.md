# @gemigo/extension-sdk

GemiGo Extension SDK for building apps that run inside the GemiGo browser extension.

## Installation

### CDN (Recommended)

```html
<script src="https://unpkg.com/@gemigo/extension-sdk/dist/gemigo-extension-sdk.umd.js"></script>
```

### npm

```bash
npm install @gemigo/extension-sdk
```

## Quick Start

```html
<script src="https://unpkg.com/@gemigo/extension-sdk/dist/gemigo-extension-sdk.umd.js"></script>
<script>
  // SDK auto-connects, use gemigo.extension.* APIs directly
  gemigo.extension.getPageInfo().then(console.log);
  
  // Subscribe to context menu events
  gemigo.extension.onContextMenu((event) => {
    console.log('Menu clicked:', event.menuId, event.selectionText);
  });
</script>
```

## API Reference

### Page Content Reading

| Method | Description |
|--------|-------------|
| `getPageInfo()` | Get current page URL, title, favicon |
| `getPageHTML()` | Get full page HTML content |
| `getPageText()` | Get page text content |
| `getSelection()` | Get selected text |
| `extractArticle()` | Extract article title, content, excerpt |
| `extractLinks()` | Extract all links from page |
| `extractImages()` | Extract all images from page |
| `queryElement(selector, limit?)` | Query elements by CSS selector |

### Page Manipulation

| Method | Description |
|--------|-------------|
| `highlight(selector, color?)` | Highlight elements (returns highlightId) |
| `removeHighlight(highlightId)` | Remove highlight |
| `insertWidget(html, position)` | Insert floating widget |
| `updateWidget(widgetId, html)` | Update widget content |
| `removeWidget(widgetId)` | Remove widget |
| `injectCSS(css)` | Inject CSS (returns styleId) |
| `removeCSS(styleId)` | Remove injected CSS |

### Screenshots

| Method | Description |
|--------|-------------|
| `captureVisible()` | Capture visible area screenshot |

### Events

| Method | Description |
|--------|-------------|
| `onContextMenu(handler)` | Subscribe to context menu events |
| `getContextMenuEvent()` | Get pending context menu event |

### Common APIs

| Method | Description |
|--------|-------------|
| `gemigo.notify(title, message)` | Send system notification |

## Example: Translation Bubble

```html
<script src="https://unpkg.com/@gemigo/extension-sdk/dist/gemigo-extension-sdk.umd.js"></script>
<script>
  gemigo.extension.onContextMenu(async (event) => {
    if (event.selectionText) {
      const translated = await translateText(event.selectionText);
      
      // Show translation bubble on page
      await gemigo.extension.insertWidget(
        `<div style="background:#667eea;color:#fff;padding:16px;border-radius:12px;">
          ${translated}
        </div>`,
        'bottom-right'
      );
    }
  });
</script>
```

## Example: Reader Mode

```javascript
// Inject reader-friendly CSS
const { styleId } = await gemigo.extension.injectCSS(`
  body { max-width: 720px; margin: 0 auto; font-family: Georgia, serif; }
  nav, aside, .ads { display: none !important; }
`);

// Remove later
await gemigo.extension.removeCSS(styleId);
```

## License

MIT
