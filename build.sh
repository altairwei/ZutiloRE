#!/bin/bash
# Build script for ZutiloRE

# Clean previous build
rm -f zutilore.xpi

# Create XPI package with both manifest.json and install.rdf
zip -r zutilore.xpi \
    manifest.json \
    install.rdf \
    bootstrap.js \
    src/ \
    chrome/ \
    locale/

echo "Build complete: zutilore.xpi"
