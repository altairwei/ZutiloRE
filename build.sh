# Build script for ZutiloRE

# Clean previous build
rm -f zutilore.xpi

# Create XPI package
zip -r zutilore.xpi \
    manifest.json \
    bootstrap.js \
    src/ \
    chrome/ \
    locale/ \
    README.md

echo "Build complete: zutilore.xpi"
