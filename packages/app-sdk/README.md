# @gemigo/app-sdk

GemiGo App SDK that auto-adapts for Web / Desktop / Browser Extension.

## Installation

### CDN (Recommended)

```html
<script src="https://unpkg.com/@gemigo/app-sdk/dist/gemigo-app-sdk.umd.js"></script>
```

### npm

```bash
npm install @gemigo/app-sdk
```

## Quick Start

```html
<script src="https://unpkg.com/@gemigo/app-sdk/dist/gemigo-app-sdk.umd.js"></script>
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
| `getSelection()` | Get selected text and position `{ text, rect? }` |
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
| `onSelectionChange(handler)` | Subscribe to selection changes `(text, rect, url)` |
| `getContextMenuEvent()` | Get pending context menu event |

### Common APIs

| Method | Description |
|--------|-------------|
| `gemigo.notify(title, message)` | Send system notification |

## Example: Translation Bubble

```html
<script src="https://unpkg.com/@gemigo/app-sdk/dist/gemigo-app-sdk.umd.js"></script>
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

## Web authorization (0.3.1)

Call `await gemigo.auth.handleRedirectCallback()` at application startup. For a same-tab login, call `gemigo.auth.login({display: "redirect", persist: "session"})` in a click handler. The callback restores the original page and returns the application token; the departing login Promise does not resolve. `popup` remains the default, and `auto` uses redirect on mobile or when popups are blocked. All scopes require an origin matching the published application URL. `redirectUri` must exactly match that registered URL; it defaults to your origin root. Restart login after cancellation, timeout, or expired state. Legacy `/sdk/broker` clients remain compatible for registered app origins.

Download the fixed release at https://docs.gemigo.io/sdk/0.3.1/gemigo-app-sdk-0.3.1.tgz (npm registry currently contains 0.2.9).
