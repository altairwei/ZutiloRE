#!/bin/bash
# ZutiloRE Development Workflow - Complete Auto-Reload System
# Usage: ./scripts/dev.sh [command]

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Source environment
source "$SCRIPT_DIR/setup-env.sh"

# Configuration
XPI_FILE="$PROJECT_ROOT/zutilore.xpi"
EXT_ID="zutilore@altairwei.github.io"
EXT_DIR="$ZOTERO_PROFILE_DIR/extensions"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[ZutiloRE]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Build XPI
build() {
    log "Building XPI..."
    cd "$PROJECT_ROOT"
    bash build.sh
    if [ -f "$XPI_FILE" ]; then
        log "Build complete: $XPI_FILE"
        return 0
    else
        error "Build failed!"
        return 1
    fi
}

# Install to test profile
install() {
    log "Installing to test profile..."
    mkdir -p "$EXT_DIR"

    # Remove old files
    rm -f "$EXT_DIR/${EXT_ID}.xpi"
    rm -f "$EXT_DIR/${EXT_ID}.json"

    # Install new XPI
    cp "$XPI_FILE" "$EXT_DIR/${EXT_ID}.xpi"

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
    log "Installed successfully"
}

# Build + Install
build_install() {
    build && install
}

# Check if Zotero is running
check_zotero() {
    if pgrep -x "Zotero" > /dev/null 2>&1; then
        log "Zotero is running"
        return 0
    else
        warn "Zotero is NOT running"
        return 1
    fi
}

# Trigger Zotero to reload the addon
# Note: Full reload requires user action or restart
trigger_reload() {
    log "Attempting to trigger reload..."

    # Method 1: Use AppleScript to bring Zotero to front
    osascript -e '
    tell application "Zotero"
        activate
    end tell
    ' 2>/dev/null || true

    log "To reload the plugin:"
    echo "  Option 1: Press Cmd+Shift+R in Zotero"
    echo "  Option 2: Tools > Plugins > ZutiloRE > Reload"
    echo "  Option 3: Restart Zotero"
    echo ""
    echo "Or use JavaScript console:"
    echo "  Zotero.zutiloRE.devReload()"
}

# Full workflow
deploy() {
    check_zotero || true
    build_install
    trigger_reload
}

# Watch mode - auto-rebuild on file changes
watch() {
    log "Starting watch mode..."
    log "Edit files in src/ and changes will auto-deploy"
    echo ""
    echo "Watching: src/ bootstrap.js manifest.json chrome/ locale/"
    echo "Press Ctrl+C to stop"
    echo ""

    # Use Python's watchdog if available, otherwise simple polling
    if command -v watchdog &> /dev/null; then
        python3 -c "
import watchdog
from watchdog.observers import Observer
import subprocess
import time
import os

class DevWatcher(watchdog.events.FileSystemEventHandler):
    def __init__(self):
        self.last_build = 0

    def on_modified(self, event):
        if event.is_directory:
            return
        ext = os.path.splitext(event.src_path)[1]
        if ext in ['.js', '.json', '.xul', '.ftl', '.rdf']:
            now = time.time()
            if now - self.last_build > 2:  # Debounce 2 seconds
                self.last_build = now
                print('\n[Change detected] Building...')
                subprocess.run(['bash', '-c', 'cd /Users/altairwei/src/ZutiloRE && bash build.sh && cp zutilore.xpi ~/.zotero/zotero/zutilore-test/extensions/zutilore@altairwei.github.io.xpi'])
                print('[Done] Reload in Zotero (Tools > Plugins > Reload)')

observer = Observer()
observer.schedule(DevWatcher(), '/Users/altairwei/src/ZutiloRE/src', recursive=True)
observer.schedule(DevWatcher(), '/Users/altairwei/src/ZutiloRE', recursive=False)
observer.start()
try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    observer.stop()
observer.join()
"
    else
        # Simple fallback using stat polling
        python3 << 'PYEOF'
import subprocess
import time
import os

project = "/Users/altairwei/src/ZutiloRE"
mtimes = {}

def get_mtimes():
    for root, dirs, files in os.walk(project):
        for f in files:
            if f.endswith(('.js', '.json', '.xul', '.ftl', '.rdf', '.png', '.svg')):
                fpath = os.path.join(root, f)
                try:
                    yield fpath, os.stat(fpath).st_mtime
                except: pass

# Initial mtimes
for f, t in get_mtimes():
    mtimes[f] = t

print("Watching for changes... (Ctrl+C to stop)")
last_build = 0

while True:
    time.sleep(1)
    changed = False
    for f, t in get_mtimes():
        if f not in mtimes or mtimes[f] != t:
            mtimes[f] = t
            changed = True

    if changed:
        now = time.time()
        if now - last_build > 2:
            last_build = now
            print("\n>>> Change detected, building...")
            result = subprocess.run(
                "cd /Users/altairwei/src/ZutiloRE && bash build.sh && "
                "cp zutilore.xpi ~/.zotero/zotero/zutilore-test/extensions/",
                shell=True, capture_output=True, text=True
            )
            if result.returncode == 0:
                print(">>> Built and installed! Reload in Zotero")
            else:
                print(">>> Build failed:", result.stderr)
PYEOF
    fi
}

# Start Zotero with test profile
start() {
    log "Starting Zotero with test profile..."
    "$ZOTERO_BIN" -P "$ZOTERO_PROFILE" &
    log "Zotero started (PID: $!)"
}

# Open Zotero JavaScript console
console() {
    log "Zotero JavaScript Console"
    echo "In the console, you can:"
    echo "  - Zotero.zutiloRE.devReload()  # Reload plugin code"
    echo "  - Zotero.zutiloRE.copyTags()   # Test copy tags"
    echo "  - Zotero.zutiloRE.pasteTags()  # Test paste tags"
    echo ""
    log "Make sure Zotero is running, then open:"
    echo "  Tools > Developer > JavaScript Console"
}

# Show debug log
logtail() {
    LOG="$PROJECT_ROOT/zotero-debug.log"
    if [ -f "$LOG" ]; then
        tail -f "$LOG"
    else
        error "No log file. Run: ./scripts/test.sh debug"
    fi
}

# Show help
help() {
    echo "ZutiloRE Development Script"
    echo ""
    echo "Usage: $0 <command>"
    echo ""
    echo "Commands:"
    echo "  build     Build XPI"
    echo "  install   Install XPI to test profile"
    echo "  deploy    Build + install (full workflow)"
    echo "  watch     Watch for file changes (auto-deploy)"
    echo "  start     Start Zotero with test profile"
    echo "  console   Show JavaScript console instructions"
    echo "  logtail   Watch debug log"
    echo "  help      Show this help"
    echo ""
    echo "Quick Start:"
    echo "  1. ./scripts/dev.sh watch      # Terminal 1: Watch mode"
    echo "  2. ./scripts/dev.sh start      # Terminal 2: Start Zotero"
    echo "  3. Edit src/*.js               # Make changes"
    echo "  4. Reload in Zotero            # Tools > Plugins > Reload"
}

# Main
case "${1:-help}" in
    build) build ;;
    install) install ;;
    deploy) deploy ;;
    watch) watch ;;
    start) start ;;
    console) console ;;
    logtail) logtail ;;
    help|--help|-h) help ;;
    *) error "Unknown command: $1"; help ;;
esac