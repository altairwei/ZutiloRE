# ZutiloRE - Zotero Utility Reloaded

A Zotero 8 compatible utility plugin providing enhanced item management, tag operations, attachment handling, and keyboard shortcuts.

## Features

### Tag Operations
- **Copy Tags to Clipboard** - Copy all unique tags from selected items
- **Paste Tags from Clipboard** - Paste tags to selected items
- **Remove All Tags** - Remove all tags from selected items

### Attachment Operations
- **Show Attachments** - Reveal attachment files in file manager
- **Copy Attachment Paths** - Copy file paths of attachments to clipboard

### Item Operations
- **Relate Items** - Relate multiple items to each other
- **Copy Item Fields** - Copy item metadata fields
- **Paste Item Fields** - Paste fields to items (all/empty/non-empty modes)

### QuickCopy
- **Alternative QuickCopy** - Two additional QuickCopy formats

## Installation

1. Download the latest `.xpi` file from the [releases page](https://github.com/altairwei/ZutiloRE/releases)
2. Open Zotero → Tools → Add-ons
3. Click the gear icon → Install Add-on From File
4. Select the downloaded `.xpi` file
5. Restart Zotero

## Compatibility

- **Zotero 7.0+** - Full support
- **Zotero 8.0+** - Full support

## Development

### Project Structure
```
ZutiloRE/
├── manifest.json          # WebExtension manifest
├── bootstrap.js           # Bootstrap entry point
├── src/
│   └── zutilore.js       # Main functionality
├── chrome/
│   └── content/
│       ├── preferences.xhtml
│       ├── preferences.js
│       └── preferences.css
├── locale/
│   └── en-US/
│       └── zutilore.ftl
└── README.md
```

### Building

```bash
# Create XPI package
zip -r zutilore.xpi manifest.json bootstrap.js src/ chrome/ locale/
```

### Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - See [LICENSE](LICENSE) for details

## Credits

Inspired by the original [Zutilo](https://github.com/wshanks/Zutilo) plugin by wshanks.

ZutiloRE is a complete rewrite for Zotero 7/8 compatibility.
