#!/bin/bash
# ZutiloRE Test Script
# Usage: ./scripts/test.sh [debug|install|run]

set -e

# Source environment setup
source "$(dirname "$0")/setup-env.sh"

# Project root
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
XPI_FILE="$PROJECT_ROOT/zutilore.xpi"

show_help() {
    echo "ZutiloRE Test Script"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  debug     Start Zotero with debug output (for development)"
    echo "  install   Build and install XPI to test profile"
    echo "  run       Start Zotero normally"
    echo "  log       Show Zotero log output"
    echo "  clean     Clean test profile"
    echo ""
    echo "Examples:"
    echo "  $0 debug     # Start with console output for debugging"
    echo "  $0 install   # Build and install XPI"
}

cmd_debug() {
    echo "Starting Zotero in debug mode..."
    echo "Press Ctrl+C to stop"
    echo ""
    
    # Start Zotero with debug output
    "$ZOTERO_BIN" \
        -P "$ZOTERO_PROFILE" \
        -ZoteroDebugText \
        -jsconsole \
        2>&1 | tee "$PROJECT_ROOT/zotero-debug.log"
}

cmd_install() {
    echo "Building XPI..."
    cd "$PROJECT_ROOT"
    bash build.sh
    
    if [ ! -f "$XPI_FILE" ]; then
        echo "Error: Failed to build XPI"
        exit 1
    fi
    
    echo "Installing XPI to test profile..."
    
    # Create extensions directory if not exists
    EXT_DIR="$ZOTERO_PROFILE_DIR/extensions"
    mkdir -p "$EXT_DIR"
    
    # Copy XPI to extensions directory
    cp "$XPI_FILE" "$EXT_DIR/zutilore@altairwei.github.io.xpi"
    
    # Create extension JSON if not exists
    EXT_JSON="$EXT_DIR/zutilore@altairwei.github.io.json"
    if [ ! -f "$EXT_JSON" ]; then
        cat > "$EXT_JSON" << EOF
{
    "id": "zutilore@altairwei.github.io",
    "installDate": $(date +%s)000,
    "version": "1.0.0",
    "active": true,
    "userDisabled": false,
    "appDisabled": false,
    "type": "extension",
    "scope": 1,
    "installType": 1
}
EOF
    fi
    
    echo "XPI installed successfully!"
    echo "Run './scripts/test.sh debug' to test"
}

cmd_run() {
    echo "Starting Zotero..."
    "$ZOTERO_BIN" -P "$ZOTERO_PROFILE" &
    echo "Zotero started with PID $!"
}

cmd_log() {
    LOG_FILE="$PROJECT_ROOT/zotero-debug.log"
    if [ -f "$LOG_FILE" ]; then
        echo "=== Zotero Log ==="
        tail -f "$LOG_FILE"
    else
        echo "No log file found. Run '$0 debug' first."
    fi
}

cmd_clean() {
    echo "Cleaning test profile..."
    rm -rf "$ZOTERO_PROFILE_DIR"
    echo "Test profile cleaned"
}

# Main command dispatcher
case "${1:-debug}" in
    debug)
        cmd_debug
        ;;
    install)
        cmd_install
        ;;
    run)
        cmd_run
        ;;
    log)
        cmd_log
        ;;
    clean)
        cmd_clean
        ;;
    help|-h|--help)
        show_help
        ;;
    *)
        echo "Unknown command: $1"
        show_help
        exit 1
        ;;
esac
