#!/bin/bash
# ZutiloRE Auto-Reload Development Server
# Watches source files and automatically reloads the plugin in Zotero

set -e

# Source environment
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
source "$SCRIPT_DIR/setup-env.sh"

# Configuration
XPI_FILE="$PROJECT_ROOT/zutilore.xpi"
EXT_ID="zutilore@altairwei.github.io"
EXT_DIR="$ZOTERO_PROFILE_DIR/extensions"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Build the XPI
build_xpi() {
    log_info "Building XPI..."
    cd "$PROJECT_ROOT"
    bash build.sh

    if [ ! -f "$XPI_FILE" ]; then
        log_error "Build failed!"
        return 1
    fi

    log_info "XPI built successfully: $XPI_FILE"
    return 0
}

# Install XPI to test profile
install_xpi() {
    log_info "Installing XPI to test profile..."

    mkdir -p "$EXT_DIR"

    # Remove old versions
    rm -f "$EXT_DIR/${EXT_ID}.xpi"
    rm -f "$EXT_DIR/${EXT_ID}.json"

    # Copy new XPI
    cp "$XPI_FILE" "$EXT_DIR/${EXT_ID}.xpi"

    # Create extension JSON
    cat > "$EXT_DIR/${EXT_ID}.json" << EOF
{
    "id": "$EXT_ID",
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

    log_info "XPI installed to test profile"
}

# Try to reload Zotero using AppleScript
reload_zotero() {
    log_info "Attempting to trigger Zotero reload..."

    # Method 1: Use osascript to simulate keyboard shortcut
    # Cmd+Shift+R is the standard reload shortcut in many Firefox-based apps
    osascript -e '
    tell application "Zotero"
        if it is running then
            activate
            -- Try to open addons manager
            tell application "System Events"
                -- First try: Ctrl+Shift+R (developer shortcut)
                keystroke "r" using {command down, shift down, control down}
            end tell
        end if
    end tell
    ' 2>/dev/null || true

    # Alternative: Send notification to Zotero
    # Zotero will check for updated extensions on startup
    log_warn "Manual reload may be required in Zotero"
    log_warn "Go to: Tools > Plugins > ZutiloRE > Reload"
}

# Full build and install cycle
build_and_install() {
    if build_xpi; then
        install_xpi
        reload_zotero
        log_info "Auto-reload complete!"
    else
        log_error "Build and install failed"
        return 1
    fi
}

# Watch mode using fswatch (if available) or macOS FSEvents
watch_mode() {
    log_info "Starting watch mode..."
    log_info "Watching: $PROJECT_ROOT/src $PROJECT_ROOT/bootstrap.js $PROJECT_ROOT/manifest.json"
    log_info "Press Ctrl+C to stop"
    echo ""

    # Check for fswatch
    if command -v fswatch &> /dev/null; then
        fswatch -o "$PROJECT_ROOT/src" "$PROJECT_ROOT/bootstrap.js" "$PROJECT_ROOT/manifest.json" "$PROJECT_ROOT/chrome" | while read -r; do
            echo ""
            log_info "Change detected, rebuilding..."
            build_and_install
            echo ""
            log_info "Watching for changes..."
        done
    else
        # Fallback: use macOS launchd FSEvents via Python
        log_warn "fswatch not found, using Python FSEvents watcher"

        python3 << 'PYEOF'
import os
import time
import subprocess

def watch_paths(paths, callback):
    """Simple file watcher using stat"""
    mtimes = {}
    for p in paths:
        for root, dirs, files in os.walk(p):
            for f in files:
                if f.endswith(('.js', '.json', '.xul', '.ftl', '.rdf')):
                    fpath = os.path.join(root, f)
                    try:
                        mtimes[fpath] = os.stat(fpath).st_mtime
                    except:
                        pass

    print("Watching for changes...")
    while True:
        time.sleep(1)
        for p in paths:
            for root, dirs, files in os.walk(p):
                for f in files:
                    if f.endswith(('.js', '.json', '.xul', '.ftl', '.rdf')):
                        fpath = os.path.join(root, f)
                        try:
                            mtime = os.stat(fpath).st_mtime
                            if fpath not in mtimes or mtimes[fpath] != mtime:
                                mtimes[fpath] = mtime
                                callback()
                                break
                        except:
                            pass
                else:
                    continue
                break
            else:
                continue
            break

paths = ['src', '.']
watch_paths(paths, lambda: subprocess.call(['/bin/bash', '-c', 'build_and_install']))
PYEOF
    fi
}

# Check Zotero status
check_zotero() {
    if pgrep -x "Zotero" > /dev/null; then
        log_info "Zotero is running"
    else
        log_warn "Zotero is NOT running"
        log_info "Start Zotero with: ./scripts/test.sh run"
    fi
}

# Show help
show_help() {
    echo "ZutiloRE Auto-Reload Development Server"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  build     Build and install XPI once"
    echo "  watch     Watch for file changes and auto-reload (default)"
    echo "  start     Start Zotero in test profile"
    echo "  check     Check Zotero status"
    echo "  openlog   Open Zotero debug log"
    echo ""
    echo "Workflow:"
    echo "  1. ./scripts/autoreload.sh watch   # Start watching"
    echo "  2. Edit source files in src/       # Make changes"
    echo "  3. XPI auto-rebuilds and installs  # Magic!"
    echo "  4. Reload in Zotero: Tools > Plugins > ZutiloRE > Reload"
}

# Main
case "${1:-watch}" in
    build)
        build_and_install
        ;;
    watch)
        check_zotero
        watch_mode
        ;;
    start)
        "$ZOTERO_BIN" -P "$ZOTERO_PROFILE" &
        echo "Zotero started"
        ;;
    check)
        check_zotero
        ;;
    openlog)
        if [ -f "$PROJECT_ROOT/zotero-debug.log" ]; then
            tail -f "$PROJECT_ROOT/zotero-debug.log"
        else
            log_error "No log file found. Run with 'debug' first"
        fi
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo "Unknown command: $1"
        show_help
        exit 1
        ;;
esac