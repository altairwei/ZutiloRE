#!/bin/bash
# Launch Zotero for testing with full output

export DISPLAY=${DISPLAY:-:1}
export MOZ_DISABLE_AUTO_SAFE_MODE=1

ZOTERO_BIN="${HOME}/.local/zotero/zotero"
PROFILE="zutilore-test"

# Create a temp log file
LOGFILE="/tmp/zotero-test-$(date +%s).log"

echo "Starting Zotero..."
echo "  Display: $DISPLAY"
echo "  Profile: $PROFILE"
echo "  Log: $LOGFILE"
echo ""

# Start Zotero with all output captured
"$ZOTERO_BIN" -P "$PROFILE" -ZoteroDebugText 2>&1 | tee "$LOGFILE" &
echo $! > /tmp/zotero-test.pid

PID=$(cat /tmp/zotero-test.pid)
echo "Zotero PID: $PID"
echo ""
echo "Waiting for startup (10 seconds)..."
sleep 10

# Check if still running
if ps -p "$PID" > /dev/null 2>&1; then
    echo "✅ Zotero is running!"
    echo ""
    echo "=== Recent Log Output ==="
    tail -50 "$LOGFILE" 2>/dev/null || echo "No log output yet"
    echo ""
    echo "To view live logs: tail -f $LOGFILE"
    echo "To stop Zotero: kill $PID"
else
    echo "❌ Zotero exited early"
    echo ""
    echo "=== Full Log Output ==="
    cat "$LOGFILE" 2>/dev/null || echo "No log file created"
fi
