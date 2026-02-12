#!/bin/bash
# ZutiloRE Test Environment Setup
# Usage: source ./scripts/setup-env.sh

# Zotero paths
export ZOTERO_HOME="${ZOTERO_HOME:-$HOME/.zotero}"
export ZOTERO_PROFILE="${ZOTERO_PROFILE:-zutilore-test}"

# Create test profile directory
export ZOTERO_PROFILE_DIR="$HOME/.zotero/zotero/$ZOTERO_PROFILE"
mkdir -p "$ZOTERO_PROFILE_DIR"

# Create profile prefs.js if not exists
if [ ! -f "$ZOTERO_PROFILE_DIR/prefs.js" ]; then
    cat > "$ZOTERO_PROFILE_DIR/prefs.js" << 'EOF'
user_pref("app.update.auto", false);
user_pref("app.update.enabled", false);
user_pref("extensions.autoDisableScopes", 0);
user_pref("extensions.enabledScopes", 15);
user_pref("extensions.update.enabled", false);
user_pref("extensions.update.autoUpdateDefault", false);
user_pref("browser.download.start_downloads_in_tmp_dir", true);
user_pref("devtools.chrome.enabled", true);
user_pref("devtools.debugger.remote-enabled", true);
EOF
fi

# Find Zotero executable
if [ -d "/tmp/zotero" ]; then
    export ZOTERO_BIN="/tmp/zotero/zotero"
elif [ -d "$HOME/.local/zotero" ]; then
    export ZOTERO_BIN="$HOME/.local/zotero/zotero"
else
    echo "Error: Zotero not found. Please run install-zotero.sh first."
    return 1
fi

# Verify Zotero exists
if [ ! -f "$ZOTERO_BIN" ]; then
    echo "Error: Zotero binary not found at $ZOTERO_BIN"
    return 1
fi

echo "ZutiloRE Test Environment:"
echo "  Zotero Binary: $ZOTERO_BIN"
echo "  Profile: $ZOTERO_PROFILE"
echo "  Profile Dir: $ZOTERO_PROFILE_DIR"
echo ""
echo "Run './scripts/test.sh' to start testing"
