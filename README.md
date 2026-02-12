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

### Item Creation
- **Create Book from Section** - Generate a book item from a book section
- **Create Section from Book** - Generate a book section from a book

### Collection Operations
- **Copy Collection Link** - Copy zotero:// link for collection
- **Export Bibliography** - Copy formatted bibliography from collection
- **Export Metadata** - Export collection items as JSON

### QuickCopy
- **Alternative QuickCopy** - Two additional QuickCopy formats

### Advanced Copy
- **Copy Item Links** - Copy zotero://select links
- **Copy Zotero URIs** - Copy item URIs
- **Copy Creators** - Copy author names
- **Copy as Markdown Citation** - Copy [@authorYear] format
- **Copy as Formatted Reference** - Copy APA-like reference

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
├── scripts/              # Development scripts
│   ├── install-zotero.sh # Install Zotero on Linux
│   ├── setup-env.sh      # Setup test environment
│   └── test.sh           # Test runner
└── README.md
```

### Building

```bash
# Create XPI package
bash build.sh
```

### Testing on Linux

For rapid development iteration on Linux, we provide test scripts:

```bash
# 1. Setup test environment (creates isolated profile)
source ./scripts/setup-env.sh

# 2. Build and install XPI
./scripts/test.sh install

# 3. Run Zotero in debug mode (shows console output)
./scripts/test.sh debug
```

**Available test commands:**
- `install` - Build XPI and install to test profile
- `debug` - Start Zotero with debug console output
- `run` - Start Zotero normally
- `log` - Show Zotero log output
- `clean` - Clean test profile

**Note:** The test environment uses an isolated Zotero profile to avoid affecting your main Zotero data.

### Installing Zotero on Linux

If you don't have Zotero installed:

```bash
./scripts/install-zotero.sh
```

This downloads and installs Zotero to `~/.local/zotero/`.

### Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - See [LICENSE](LICENSE) for details

## Credits

Inspired by the original [Zutilo](https://github.com/wshanks/Zutilo) plugin by wshanks.

ZutiloRE is a complete rewrite for Zotero 7/8 compatibility.
