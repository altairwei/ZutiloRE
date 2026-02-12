#!/bin/bash
# Build script for ZutiloRE
# Zotero 8 requires manifest.json but also supports install.rdf for bootstrap extensions

# Clean previous build
rm -f zutilore.xpi

# Create XPI package with BOTH manifest.json and install.rdf
# manifest.json: Required by Zotero 8
# install.rdf: Declares this as a bootstrap extension
zip -r zutilore.xpi \
    manifest.json \
    install.rdf \
    bootstrap.js \
    icon.png \
    icon@2x.png \
    src/ \
    chrome/ \
    locale/

echo "Build complete: zutilore.xpi"
echo "Contains: manifest.json (WebExtension) + install.rdf (Bootstrap)"
