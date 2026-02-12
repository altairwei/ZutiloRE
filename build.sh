#!/bin/bash
# Build script for ZutiloRE (Bootstrap format - Zotero 7/8 compatible)

# Clean previous build
rm -f zutilore.xpi

# Create XPI package with only install.rdf (traditional bootstrap format)
# Note: manifest.json removed as Zotero 8 has stricter WebExtension validation
zip -r zutilore.xpi \
    install.rdf \
    bootstrap.js \
    src/ \
    chrome/ \
    locale/

echo "Build complete: zutilore.xpi"
echo "Format: Bootstrap (install.rdf) - Compatible with Zotero 7/8"
