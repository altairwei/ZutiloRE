#!/bin/bash
# Install Zotero for Linux

ZOTERO_URL="https://www.zotero.org/download/client/dl?channel=release&platform=linux-x86_64"
INSTALL_DIR="${HOME}/.local/zotero"
TEMP_DIR="/tmp/zotero-install"

echo "Installing Zotero..."
echo "  Download URL: $ZOTERO_URL"
echo "  Install Dir: $INSTALL_DIR"

# Create temp directory
mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"

# Download Zotero
echo "Downloading Zotero..."
curl -L -o zotero.tar.bz2 "$ZOTERO_URL"

# Extract
echo "Extracting..."
if file zotero.tar.bz2 | grep -q "XZ compressed"; then
    xzcat zotero.tar.bz2 | tar -xf -
elif file zotero.tar.bz2 | grep -q "bzip2"; then
    tar -xjf zotero.tar.bz2
else
    tar -xf zotero.tar.bz2
fi

# Find extracted directory
ZOTERO_DIR=$(ls -d Zotero_* 2>/dev/null || ls -d zotero* 2>/dev/null | head -1)

if [ -z "$ZOTERO_DIR" ]; then
    echo "Error: Could not find extracted Zotero directory"
    exit 1
fi

# Install
echo "Installing to $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"
cp -r "$ZOTERO_DIR"/* "$INSTALL_DIR/"

# Create symlink in PATH
mkdir -p "$HOME/.local/bin"
ln -sf "$INSTALL_DIR/zotero" "$HOME/.local/bin/zotero"

# Cleanup
cd /
rm -rf "$TEMP_DIR"

echo ""
echo "Zotero installed successfully!"
echo "  Binary: $INSTALL_DIR/zotero"
echo "  Run: zotero"
