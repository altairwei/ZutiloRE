# ZutiloRE - Zotero Utility Reloaded

A Zotero 8 compatible utility plugin providing enhanced item management, tag operations, and collection utilities.

## Why ZutiloRE?

The original [Zutilo](https://github.com/wshanks/Zutilo) plugin was an essential tool for Zotero power users, providing features like bulk tag operations, item relations, and collection links. However, it was not compatible with **Zotero 8**, which introduced significant changes to the plugin architecture.

**ZutiloRE** (Zutilo Reloaded) was created to fill this gap:
- Fully compatible with **Zotero 8.0+** (and Zotero 7.0+)
- Modern plugin architecture using Zotero 8's extension APIs
- Addresses platform-specific issues (e.g., macOS clipboard permissions)
- Clean, maintainable codebase for future Zotero versions

## Features

### Tag Operations
- **Copy Tags to Clipboard** - Copy all unique tags from selected items (works with external applications)
- **Paste Tags from Clipboard** - Paste copied tags to selected items (uses internal storage to avoid macOS clipboard permission issues)
- **Remove All Tags** - Remove all tags from selected items

### Item Operations
- **Relate Items** - Create bidirectional relationships between multiple items

### Collection Operations
- **Copy Collection Link** - Copy a `zotero://` link for the selected collection

## Installation

1. Download the latest `zutilore.xpi` file from the [releases page](https://github.com/altairwei/ZutiloRE/releases)
2. Open Zotero → Tools → Add-ons
3. Click the gear icon → Install Add-on From File
4. Select the downloaded `.xpi` file
5. Restart Zotero

## Compatibility

- **Zotero 7.0+** - Full support
- **Zotero 8.0+** - Full support (primary target)

## About

**ZutiloRE** was developed by **Karu**, an OpenClaw AI assistant, with assistance from **Altair Wei**.

This project represents a collaborative effort between human guidance and AI implementation to solve a real-world compatibility problem in the academic workflow ecosystem.

### Technical Highlights

- **Bootstrap Extension Format**: Uses Zotero 8's recommended bootstrap architecture
- **macOS Compatibility**: Works around clipboard permission issues by using internal storage for paste operations
- **Clean Architecture**: Simple, maintainable code following modern JavaScript practices
- **Git Version Control**: Full development history preserved

## Development

### Project Structure
```
ZutiloRE/
├── manifest.json          # WebExtension manifest
├── install.rdf            # Bootstrap declaration
├── bootstrap.js           # Bootstrap entry point
├── src/
│   ├── zutilore.js       # Main functionality
│   ├── collection.js     # Collection operations
│   ├── creation.js       # Item creation utilities
│   └── advancedCopy.js   # Advanced copy functions
├── chrome/
│   └── content/
│       ├── preferences.xhtml
│       ├── preferences.js
│       └── preferences.css
├── locale/
│   └── en-US/
│       └── zutilore.ftl
├── build.sh              # Build script
└── README.md
```

### Building

```bash
# Create XPI package
bash build.sh
```

### Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - See [LICENSE](LICENSE) for details

## Credits

Inspired by the original [Zutilo](https://github.com/wshanks/Zutilo) plugin by wshanks.

ZutiloRE is a complete rewrite for Zotero 7/8 compatibility, developed with the assistance of OpenClaw AI.
