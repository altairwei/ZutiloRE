# ZutiloRE - Zotero Utility Reloaded

A Zotero 8 compatible utility plugin providing enhanced item management, tag operations, collection utilities, metadata updating, and HTML snapshot editing.

## Why ZutiloRE?

The original [Zutilo](https://github.com/wshanks/Zutilo) plugin was an essential tool for Zotero power users, providing features like bulk tag operations, item relations, and collection links. However, it was not compatible with **Zotero 8**, which introduced significant changes to the plugin architecture.

**ZutiloRE** (Zutilo Reloaded) was created to fill this gap:
- Fully compatible with **Zotero 8.0+** (and Zotero 7.0+)
- Modern plugin architecture using Zotero 8's bootstrap extension APIs
- Addresses platform-specific issues (e.g., macOS clipboard permissions)
- Adds new features beyond the original Zutilo (metadata update, HTML snapshot editing)

## Features

### Tag Operations
- **Copy Tags** — Copy all unique tags from selected items to clipboard
- **Paste Tags** — Paste previously copied tags to selected items (uses internal storage to avoid macOS clipboard permission issues)
- **Remove All Tags** — Remove all tags from selected items (with confirmation)

### Item Operations
- **Relate Items** — Create bidirectional relationships between multiple selected items
- **Copy Select Link** — Copy `zotero://select/` links for selected items
- **Copy Item ID** — Copy internal Zotero item keys
- **Copy Zotero URI** — Copy public web URLs (`https://www.zotero.org/...`) for selected items
- **Copy Attachment Paths** — Copy file paths of all attachments in selected items
- **Copy Creators** — Copy all unique authors (tab-separated last/first name)
- **Copy Child Items / Relocate Children** — Copy child item IDs and move them to a different parent

### Item Creation
- **Create Book from Section** — Create a new book item from a selected book section, copying relevant fields and creating a bidirectional relation
- **Create Section from Book** — Create a new book section from a selected book, prompting for a chapter title

### Collection Operations
- **Copy Collection Link** — Copy a `zotero://` link for the selected collection
- **Copy Collection Path** — Copy the full hierarchical path (e.g., "Research / Papers / 2024")

### Update Metadata
- Fetch updated metadata from public sources (Crossref, PubMed, arXiv, etc.)
- Uses DOI, ISBN, PMID, or arXiv identifiers to look up current metadata
- Opens a field-level merge dialog for selective updates
- Special handling for PubMed Central (PMC) articles via NCBI E-utilities API
- Supports batch operations across multiple items

### HTML Snapshot Editor
A visual DOM editor for cleaning up HTML snapshots saved in Zotero:

- **Activation**: Click the eraser icon in the reader toolbar (appears for snapshot items only)
- **Remove Mode**: Hover to highlight elements, click to remove; scroll wheel to navigate parent/child elements
- **CSS Mode**: Inspect and edit inline CSS properties with a sidebar panel; DevTools-style box-model overlay
- **Preset Layout**: One-click transformation to center main content and hide sidebars
- **Undo/Redo**: Full history with `Ctrl+Z` / `Ctrl+Y`
- **Save**: `Ctrl+S` to permanently save changes to the snapshot
- **Exit**: Press `Escape` to leave edit mode

## Installation

1. Download the latest `zutilore.xpi` from the [Releases page](https://github.com/altairwei/ZutiloRE/releases)
2. Open Zotero → Tools → Add-ons
3. Click the gear icon → Install Add-on From File
4. Select the downloaded `.xpi` file
5. Restart Zotero

## Compatibility

- **Zotero 7.0+** — Full support
- **Zotero 8.0+** — Full support (primary target)
- **Platforms**: macOS, Windows, Linux

## Development

### Prerequisites

- Node.js 18+
- A local Zotero installation

### Project Structure
```
ZutiloRE/
├── addon/
│   └── bootstrap.js          # Bootstrap entry point
├── src/
│   ├── index.ts              # Plugin API & lifecycle
│   ├── hooks.ts              # Startup/shutdown hooks
│   └── modules/
│       ├── main.ts           # Menu registration & utilities
│       ├── tags.ts           # Tag operations
│       ├── items.ts          # Item operations
│       ├── creation.ts       # Book/section creation
│       ├── collections.ts    # Collection operations
│       ├── metadata.ts       # Metadata update & merge dialog
│       └── snapshotCleaner.ts # HTML snapshot editor
├── addon/locale/en-US/
│   └── zutilore.ftl          # Localization strings
├── scripts/
│   └── dev.mjs               # Dev workflow (build, watch, hot-reload)
├── build.mjs                 # Production build script
├── manifest.json             # WebExtension manifest
├── zotero-plugin.config.ts   # Plugin configuration
└── tsconfig.json
```

### Build & Development

```bash
# Install dependencies
npm install

# Development mode with hot-reload
npm run dev

# Production build
npm run build

# Build XPI package
npm run build:xpi
```

### Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

AGPL-3.0 — See [LICENSE](LICENSE) for details.

## Credits

Inspired by the original [Zutilo](https://github.com/wshanks/Zutilo) plugin by wshanks.
