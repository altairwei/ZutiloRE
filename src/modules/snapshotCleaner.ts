/**
 * Snapshot Cleaner - DOM Element Removal Tool for HTML Reader
 *
 * Enables visual selection and removal of unwanted DOM elements
 * from HTML snapshots with undo/redo and save functionality.
 *
 * Usage:
 *   1. Open an HTML snapshot in the Zotero reader
 *   2. Click the eraser icon in the reader toolbar
 *   3. Hover elements to highlight, click to remove
 *   4. Use scroll wheel to navigate to parent/child elements
 *   5. Ctrl+Z / Ctrl+Y for undo/redo, Ctrl+S to save, Escape to exit
 */

const PLUGIN_ID = 'zutilore@altairwei.github.io';
const ATTR_REMOVED = 'data-zutilore-removed';
const ATTR_UI = 'data-zutilore-ui';
const HIGHLIGHT_CLASS = 'zutilore-highlight';
const TOOLBAR_ID = 'zutilore-cleaner-toolbar';
const ATTR_HIDDEN = 'data-zutilore-hidden';

interface RemovedEntry {
  element: HTMLElement;
  previousDisplay: string;
}

interface CleanerSession {
  active: boolean;
  reader: any;
  snapshotWin: any;
  snapshotDoc: Document;
  undoStack: RemovedEntry[];
  redoStack: RemovedEntry[];
  highlightedEl: HTMLElement | null;
  ancestorLevel: number;
  baseElement: HTMLElement | null;
  toolbarEl: HTMLElement | null;
  styleEl: HTMLElement | null;
  cleanupFns: Array<() => void>;
  toggleButton: HTMLElement | null;
}

const sessions = new Map<string, CleanerSession>();

// Keep a reference to the toolbar handler so we can unregister if needed
let toolbarHandler: ((event: any) => void) | null = null;

/**
 * Initialize the snapshot cleaner module.
 */
export function initSnapshotCleaner(): void {
  const reader = (Zotero as any).Reader;
  if (!reader) {
    Zotero.debug('ZutiloRE: Reader not available, skipping HTML Editor init');
    return;
  }

  toolbarHandler = onRenderToolbar;
  reader.registerEventListener('renderToolbar', toolbarHandler, PLUGIN_ID);
  Zotero.debug('ZutiloRE: HTML Editor initialized');
}

/**
 * Destroy the snapshot cleaner module.
 */
export function destroySnapshotCleaner(): void {
  for (const [, session] of sessions) {
    if (session.active) {
      doExit(session, false);
    }
  }
  sessions.clear();
  toolbarHandler = null;
}

// ---------------------------------------------------------------------------
// Toolbar button
// ---------------------------------------------------------------------------

function onRenderToolbar(event: any): void {
  const { reader, doc, append } = event;

  if (reader._type !== 'snapshot' && reader.type !== 'snapshot') {
    return;
  }

  // Reader toolbar is a React app in an HTML iframe.
  // Buttons must be plain HTML <button> with class "toolbar-button"
  // to match reader's own toolbar styling (hover, active states, sizing).
  const button = doc.createElement('button');
  button.className = 'toolbar-button';
  button.setAttribute('title', 'Edit HTML');
  button.setAttribute('tabindex', '-1');
  button.setAttribute(ATTR_UI, 'true');

  // SVG icon – 20x20 to match reader's icon convention
  button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20H7L3 16c-.8-.8-.8-2 0-2.8L13.5 2.7a2 2 0 0 1 2.8 0L21 7.3a2 2 0 0 1 0 2.8L11 20"/><path d="M6 12l4 4"/></svg>`;

  button.onclick = () => toggleCleanerMode(reader, button);

  append(button);
}

// ---------------------------------------------------------------------------
// Toggle / Enter / Exit
// ---------------------------------------------------------------------------

async function toggleCleanerMode(reader: any, button: HTMLElement): Promise<void> {
  const session = sessions.get(reader._instanceID);
  if (session?.active) {
    doExit(session, true);
  } else {
    await enterCleanerMode(reader, button);
  }
}

async function enterCleanerMode(reader: any, button: HTMLElement): Promise<void> {
  try {
    await reader._initPromise;

    // Wait for snapshot view iframe
    let n = 0;
    while (!reader._internalReader?._primaryView?._iframeWindow) {
      if (n++ >= 500) throw new Error('Timeout waiting for snapshot content');
      await new Promise(r => setTimeout(r, 10));
    }

    const snapshotWin = reader._internalReader._primaryView._iframeWindow;
    const snapshotDoc = snapshotWin.document;

    const session: CleanerSession = {
      active: true,
      reader,
      snapshotWin,
      snapshotDoc,
      undoStack: [],
      redoStack: [],
      highlightedEl: null,
      ancestorLevel: 0,
      baseElement: null,
      toolbarEl: null,
      styleEl: null,
      cleanupFns: [],
      toggleButton: button,
    };

    sessions.set(reader._instanceID, session);

    // Visual feedback on toolbar button (use reader's "active" class)
    button.classList.add('active');

    injectStyles(session);
    injectControlBar(session);
    attachListeners(session);

    Zotero.debug('ZutiloRE: Entered HTML Editor mode');
  } catch (e) {
    Zotero.debug(`ZutiloRE: Failed to enter cleaner mode: ${e}`);
  }
}

function doExit(session: CleanerSession, promptSave: boolean): void {
  if (!session.active) return;

  if (promptSave && session.undoStack.length > 0) {
    const ps = Services.prompt;
    const flags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
      + ps.BUTTON_POS_1 * ps.BUTTON_TITLE_IS_STRING
      + ps.BUTTON_POS_2 * ps.BUTTON_TITLE_CANCEL;
    const result = ps.confirmEx(
      null,
      'HTML Editor',
      `You have ${session.undoStack.length} unsaved removal(s). Save before exiting?`,
      flags,
      'Save', 'Discard', '', null, {},
    );
    if (result === 0) {
      saveChanges(session);
      return; // saveChanges handles cleanup
    }
    if (result === 2) {
      return; // Cancel - stay in cleaner mode
    }
    // result === 1: Discard - fall through to cleanup
  }

  // Restore all hidden elements
  while (session.undoStack.length > 0) {
    undoOne(session);
  }

  cleanupSession(session);
}

function cleanupSession(session: CleanerSession): void {
  // Remove highlight
  if (session.highlightedEl) {
    session.highlightedEl.classList.remove(HIGHLIGHT_CLASS);
  }

  // Remove injected UI
  session.toolbarEl?.remove();
  session.styleEl?.remove();

  // Detach event listeners
  for (const fn of session.cleanupFns) fn();
  session.cleanupFns = [];

  // Reset toolbar button
  if (session.toggleButton) {
    session.toggleButton.classList.remove('active');
  }

  session.active = false;
  session.highlightedEl = null;
  session.baseElement = null;
  sessions.delete(session.reader._instanceID);
  Zotero.debug('ZutiloRE: Exited HTML Editor mode');
}

// ---------------------------------------------------------------------------
// CSS injection
// ---------------------------------------------------------------------------

function injectStyles(session: CleanerSession): void {
  const style = session.snapshotDoc.createElement('style');
  style.setAttribute(ATTR_UI, 'true');
  style.textContent = `
    .${HIGHLIGHT_CLASS} {
      outline: 3px solid #e74c3c !important;
      outline-offset: -1px !important;
      cursor: crosshair !important;
      background-color: rgba(231, 76, 60, 0.08) !important;
    }
    [${ATTR_REMOVED}] {
      display: none !important;
    }
    #${TOOLBAR_ID} {
      position: fixed !important;
      top: 0 !important; left: 0 !important; right: 0 !important;
      z-index: 2147483647 !important;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%) !important;
      color: #e8e8e8 !important;
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
      padding: 8px 16px !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      font-size: 13px !important;
      box-shadow: 0 3px 12px rgba(0,0,0,0.4) !important;
      user-select: none !important;
      line-height: 1.4 !important;
    }
    #${TOOLBAR_ID} button {
      padding: 5px 12px !important;
      border: 1px solid rgba(255,255,255,0.2) !important;
      border-radius: 4px !important;
      background: rgba(255,255,255,0.1) !important;
      color: #e8e8e8 !important;
      cursor: pointer !important;
      font-size: 12px !important;
      font-family: inherit !important;
      white-space: nowrap !important;
    }
    #${TOOLBAR_ID} button:hover:not(:disabled) {
      background: rgba(255,255,255,0.2) !important;
    }
    #${TOOLBAR_ID} button:disabled {
      opacity: 0.4 !important;
      cursor: default !important;
    }
    #${TOOLBAR_ID} button.zr-save {
      background: rgba(46,204,113,0.3) !important;
      border-color: rgba(46,204,113,0.5) !important;
    }
    #${TOOLBAR_ID} button.zr-save:hover:not(:disabled) {
      background: rgba(46,204,113,0.5) !important;
    }
    #${TOOLBAR_ID} button.zr-exit {
      background: rgba(231,76,60,0.3) !important;
      border-color: rgba(231,76,60,0.5) !important;
    }
    #${TOOLBAR_ID} button.zr-exit:hover {
      background: rgba(231,76,60,0.5) !important;
    }
    #${TOOLBAR_ID} .zr-info {
      flex: 1 !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
      color: #aaa !important;
      font-size: 12px !important;
      font-family: "SF Mono", "Fira Code", Consolas, monospace !important;
    }
    #${TOOLBAR_ID} .zr-sep {
      width: 1px !important; height: 20px !important;
      background: rgba(255,255,255,0.2) !important;
      margin: 0 4px !important;
    }
    body.zutilore-clean-active {
      padding-top: 44px !important;
    }
  `;
  session.snapshotDoc.head.appendChild(style);
  session.styleEl = style;
  session.snapshotDoc.body.classList.add('zutilore-clean-active');
}

// ---------------------------------------------------------------------------
// Control bar
// ---------------------------------------------------------------------------

function injectControlBar(session: CleanerSession): void {
  const doc = session.snapshotDoc;
  const bar = doc.createElement('div');
  bar.id = TOOLBAR_ID;
  bar.setAttribute(ATTR_UI, 'true');

  bar.innerHTML = `
    <span style="font-weight:600;color:#e74c3c;">HTML Editor</span>
    <span class="zr-sep"></span>
    <span class="zr-info" id="zr-info">Click element to remove. Scroll to navigate. Ctrl+Z/Y undo/redo.</span>
    <span class="zr-sep"></span>
    <button id="zr-undo" disabled>Undo (0)</button>
    <button id="zr-redo" disabled>Redo (0)</button>
    <span class="zr-sep"></span>
    <button id="zr-save" class="zr-save" disabled>Save</button>
    <button id="zr-exit" class="zr-exit">Exit</button>
  `;

  doc.body.insertBefore(bar, doc.body.firstChild);
  session.toolbarEl = bar;

  const btn = (id: string) => doc.getElementById(id)!;

  btn('zr-undo').addEventListener('click', (e) => {
    e.stopPropagation();
    undoOne(session);
    refreshBar(session);
  });
  btn('zr-redo').addEventListener('click', (e) => {
    e.stopPropagation();
    redoOne(session);
    refreshBar(session);
  });
  btn('zr-save').addEventListener('click', (e) => {
    e.stopPropagation();
    saveChanges(session);
  });
  btn('zr-exit').addEventListener('click', (e) => {
    e.stopPropagation();
    doExit(session, true);
  });
}

function refreshBar(session: CleanerSession): void {
  const doc = session.snapshotDoc;
  const undoBtn = doc.getElementById('zr-undo') as HTMLButtonElement | null;
  const redoBtn = doc.getElementById('zr-redo') as HTMLButtonElement | null;
  const saveBtn = doc.getElementById('zr-save') as HTMLButtonElement | null;
  if (undoBtn) {
    undoBtn.textContent = `Undo (${session.undoStack.length})`;
    undoBtn.disabled = session.undoStack.length === 0;
  }
  if (redoBtn) {
    redoBtn.textContent = `Redo (${session.redoStack.length})`;
    redoBtn.disabled = session.redoStack.length === 0;
  }
  if (saveBtn) {
    saveBtn.disabled = session.undoStack.length === 0;
  }
}

function showElementInfo(session: CleanerSession, el: HTMLElement | null): void {
  const info = session.snapshotDoc.getElementById('zr-info');
  if (!info) return;
  if (!el) {
    info.textContent = 'Click element to remove. Scroll to navigate. Ctrl+Z/Y undo/redo.';
    return;
  }

  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const classes = el.className && typeof el.className === 'string'
    ? el.className.split(/\s+/)
        .filter(c => c && c !== HIGHLIGHT_CLASS)
        .map(c => '.' + c)
        .join('')
    : '';
  const dims = `${el.offsetWidth}\u00D7${el.offsetHeight}`;
  let label = `<${tag}${id}${classes}> [${dims}px]`;
  if (session.ancestorLevel > 0) {
    label += ` (parent \u00D7${session.ancestorLevel})`;
  }
  info.textContent = label;
}

// ---------------------------------------------------------------------------
// Event listeners
// ---------------------------------------------------------------------------

function attachListeners(session: CleanerSession): void {
  const doc = session.snapshotDoc;

  const onMouseMove = (e: MouseEvent) => {
    if (!session.active) return;
    const target = e.target as HTMLElement;
    if (!target || isUI(target)) return;

    if (target !== session.baseElement) {
      session.baseElement = target;
      session.ancestorLevel = 0;
    }
    highlight(session, ancestor(target, session.ancestorLevel, session.snapshotDoc));
  };

  const onClick = (e: MouseEvent) => {
    if (!session.active) return;
    if (isUI(e.target as HTMLElement)) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    if (session.highlightedEl) {
      removeEl(session, session.highlightedEl);
      refreshBar(session);
      session.highlightedEl = null;
      session.baseElement = null;
      session.ancestorLevel = 0;
      showElementInfo(session, null);
    }
  };

  const onMouseDown = (e: MouseEvent) => {
    if (!session.active) return;
    if (isUI(e.target as HTMLElement)) return;
    e.preventDefault();
    e.stopPropagation();
  };

  const onWheel = (e: WheelEvent) => {
    if (!session.active || !session.baseElement) return;
    if (isUI(e.target as HTMLElement)) return;
    e.preventDefault();
    e.stopPropagation();

    if (e.deltaY < 0) {
      // Scroll up -> parent
      const next = ancestor(session.baseElement, session.ancestorLevel + 1, session.snapshotDoc);
      if (next !== session.snapshotDoc.documentElement && next !== session.snapshotDoc.body) {
        session.ancestorLevel++;
        highlight(session, next);
      }
    } else if (e.deltaY > 0 && session.ancestorLevel > 0) {
      // Scroll down -> child
      session.ancestorLevel--;
      highlight(session, ancestor(session.baseElement, session.ancestorLevel, session.snapshotDoc));
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!session.active) return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      undoOne(session);
      refreshBar(session);
    } else if (ctrl && (e.key === 'y' || (e.shiftKey && (e.key === 'z' || e.key === 'Z')))) {
      e.preventDefault();
      redoOne(session);
      refreshBar(session);
    } else if (ctrl && e.key === 's') {
      e.preventDefault();
      if (session.undoStack.length > 0) saveChanges(session);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      doExit(session, true);
    }
  };

  doc.addEventListener('mousemove', onMouseMove, true);
  doc.addEventListener('click', onClick, true);
  doc.addEventListener('mousedown', onMouseDown, true);
  doc.addEventListener('wheel', onWheel, { capture: true, passive: false } as any);
  doc.addEventListener('keydown', onKeyDown, true);

  session.cleanupFns.push(() => {
    doc.removeEventListener('mousemove', onMouseMove, true);
    doc.removeEventListener('click', onClick, true);
    doc.removeEventListener('mousedown', onMouseDown, true);
    doc.removeEventListener('wheel', onWheel, true);
    doc.removeEventListener('keydown', onKeyDown, true);
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isUI(el: HTMLElement | null): boolean {
  return !!el?.closest?.(`[${ATTR_UI}]`);
}

function ancestor(el: HTMLElement, depth: number, doc: Document): HTMLElement {
  let cur = el;
  for (let i = 0; i < depth; i++) {
    const p = cur.parentElement;
    if (!p || p === doc.documentElement || p === doc.body) break;
    cur = p;
  }
  return cur;
}

function highlight(session: CleanerSession, el: HTMLElement | null): void {
  if (session.highlightedEl === el) {
    showElementInfo(session, el);
    return;
  }
  if (session.highlightedEl) {
    session.highlightedEl.classList.remove(HIGHLIGHT_CLASS);
  }
  session.highlightedEl = el;
  if (el) el.classList.add(HIGHLIGHT_CLASS);
  showElementInfo(session, el);
}

function removeEl(session: CleanerSession, el: HTMLElement): void {
  el.classList.remove(HIGHLIGHT_CLASS);
  session.undoStack.push({
    element: el,
    previousDisplay: el.style.display || '',
  });
  session.redoStack = [];
  el.setAttribute(ATTR_REMOVED, 'true');
}

function undoOne(session: CleanerSession): void {
  const entry = session.undoStack.pop();
  if (!entry) return;
  entry.element.removeAttribute(ATTR_REMOVED);
  entry.element.style.display = entry.previousDisplay;
  session.redoStack.push(entry);
}

function redoOne(session: CleanerSession): void {
  const entry = session.redoStack.pop();
  if (!entry) return;
  entry.element.setAttribute(ATTR_REMOVED, 'true');
  session.undoStack.push(entry);
}

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------

async function saveChanges(session: CleanerSession): Promise<void> {
  try {
    const item = session.reader._item;
    const filePath = await item.getFilePathAsync();
    if (!filePath) {
      throw new Error('Cannot determine snapshot file path');
    }

    // Choose save strategy based on whether annotations exist
    const annotations = item.getAnnotations();
    let strategy: 'remove' | 'hide' | 'fix' = 'remove';

    if (annotations.length > 0) {
      const ps = Services.prompt;
      const flags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
        + ps.BUTTON_POS_1 * ps.BUTTON_TITLE_IS_STRING
        + ps.BUTTON_POS_2 * ps.BUTTON_TITLE_CANCEL;
      const choice = ps.confirmEx(
        null,
        'HTML Editor',
        `This snapshot has ${annotations.length} annotation(s) that may be affected.\n\n`
        + '\u2022 Hide (Safe) \u2013 Hides elements with CSS display:none instead of '
        + 'removing them from the DOM. The document structure stays intact, '
        + 'so all annotation positions are preserved.\n\n'
        + '\u2022 Remove + Fix \u2013 Removes elements from the DOM and recalculates '
        + 'annotation positions automatically. Annotations whose target content '
        + 'was removed cannot be recovered.',
        flags,
        'Hide (Safe)', 'Remove + Fix', '', null, {},
      );
      if (choice === 2) return;
      strategy = choice === 0 ? 'hide' : 'fix';
    }

    // --- Prepare DOM for serialization ---
    session.toolbarEl?.remove();
    session.styleEl?.remove();
    session.snapshotDoc.body.classList.remove('zutilore-clean-active');
    if (session.highlightedEl) {
      session.highlightedEl.classList.remove(HIGHLIGHT_CLASS);
    }

    // --- Apply chosen strategy ---
    const marked = session.snapshotDoc.querySelectorAll(`[${ATTR_REMOVED}]`);
    const count = marked.length;
    let fixResult: { fixed: number; broken: number } | null = null;

    if (strategy === 'hide') {
      applyHideStrategy(marked);
    } else if (strategy === 'fix') {
      fixResult = await applyFixStrategy(session, item, marked);
    } else {
      for (const el of marked) el.remove();
    }

    // --- Serialize and write ---
    const html = serializeDoc(session.snapshotDoc);
    await (Zotero as any).File.putContentsAsync(filePath, html);

    // Notify Zotero sync system that the file has changed so it can
    // recalculate the storageHash and mark the attachment for upload.
    item.attachmentSyncState = 0; // Zotero.Sync.Storage.Local.SYNC_STATE_TO_UPLOAD
    await item.saveTx({ skipAll: true });

    // --- Build notification message ---
    let msg: string;
    if (strategy === 'hide') {
      msg = `${count} element(s) hidden. Annotations preserved.`;
    } else if (strategy === 'fix' && fixResult) {
      const parts = [`${count} element(s) removed.`];
      if (fixResult.fixed > 0) parts.push(`${fixResult.fixed} annotation(s) fixed.`);
      if (fixResult.broken > 0) parts.push(`${fixResult.broken} annotation(s) broken.`);
      if (fixResult.fixed === 0 && fixResult.broken === 0) parts.push('No annotations affected.');
      msg = parts.join(' ');
    } else {
      msg = `${count} element(s) removed.`;
    }
    Zotero.debug(`ZutiloRE: Saved snapshot \u2013 ${msg}`);

    // --- Cleanup session ---
    session.undoStack = [];
    session.redoStack = [];
    for (const fn of session.cleanupFns) fn();
    session.cleanupFns = [];
    if (session.toggleButton) {
      session.toggleButton.classList.remove('active');
    }
    session.active = false;
    session.highlightedEl = null;
    sessions.delete(session.reader._instanceID);

    showNotification(session.snapshotDoc, msg);
  } catch (e) {
    Zotero.debug(`ZutiloRE: Failed to save snapshot: ${e}`);

    // Restore UI on failure
    if (session.styleEl) {
      session.snapshotDoc.head.appendChild(session.styleEl);
    }
    if (session.toolbarEl) {
      session.snapshotDoc.body.insertBefore(session.toolbarEl, session.snapshotDoc.body.firstChild);
    }
    session.snapshotDoc.body.classList.add('zutilore-clean-active');

    const ps = Services.prompt;
    ps.alert(null, 'HTML Editor', `Failed to save: ${e}`);
  }
}

// ---------------------------------------------------------------------------
// Save strategies
// ---------------------------------------------------------------------------

/**
 * Hide strategy: apply inline display:none instead of removing elements.
 *
 * DOM structure (tag names, nth-child indices) is unchanged, so
 * CssSelector-based annotation positions remain valid. Text nodes inside
 * hidden elements are still traversable by createNodeIterator(SHOW_TEXT),
 * so TextPositionSelector character offsets are also preserved.
 */
function applyHideStrategy(marked: NodeListOf<Element>): void {
  for (const el of marked) {
    el.removeAttribute(ATTR_REMOVED);
    (el as HTMLElement).style.setProperty('display', 'none', 'important');
    el.setAttribute(ATTR_HIDDEN, 'true');
  }
}

/**
 * Fix strategy: remove elements from the DOM, then recalculate annotation
 * positions using the reader's own selector resolution.
 *
 * 1. Resolve every annotation's stored position to a live DOM Range
 *    (via SnapshotView.toDisplayedRange).
 * 2. Remove the marked elements — surviving Ranges remain attached to
 *    their text nodes because DOM Range endpoints are live references.
 * 3. Re-generate each selector from the surviving Range
 *    (via SnapshotView.toSelector) and update the annotation in the DB.
 *
 * Annotations whose target content was removed will have their Range
 * detached from the document and are reported as "broken".
 */
async function applyFixStrategy(
  session: CleanerSession,
  item: any,
  marked: NodeListOf<Element>,
): Promise<{ fixed: number; broken: number }> {
  const view = session.reader._internalReader?._primaryView;
  const annotations = item.getAnnotations();

  if (!view
      || typeof view.toDisplayedRange !== 'function'
      || typeof view.toSelector !== 'function') {
    Zotero.debug('ZutiloRE: SnapshotView API unavailable, falling back to plain remove');
    for (const el of marked) el.remove();
    return { fixed: 0, broken: annotations.length };
  }

  // Step 1: Resolve all annotation positions to live DOM Ranges
  const resolved: Array<{ ann: any; range: Range | null }> = [];
  for (const ann of annotations) {
    try {
      const position = JSON.parse(ann.annotationPosition);
      const range = view.toDisplayedRange(position);
      resolved.push({ ann, range });
    } catch {
      resolved.push({ ann, range: null });
    }
  }

  // Step 2: Remove marked elements (Ranges pointing to surviving nodes
  // stay valid because Range endpoints are live DOM references)
  for (const el of marked) {
    el.remove();
  }

  // Step 3: Recalculate positions from surviving Ranges
  let fixed = 0;
  let broken = 0;

  for (const { ann, range } of resolved) {
    if (!range || range.collapsed) {
      broken++;
      continue;
    }
    try {
      // Range endpoints removed from document — annotation is lost
      if (!session.snapshotDoc.contains(range.startContainer)
          || !session.snapshotDoc.contains(range.endContainer)) {
        broken++;
        continue;
      }

      const newSelector = view.toSelector(range);
      if (!newSelector) {
        broken++;
        continue;
      }

      const newPosition = JSON.stringify(newSelector);
      // _getSortIndex is TypeScript-private but accessible at runtime
      let newSortIndex: string | undefined;
      try {
        newSortIndex = view._getSortIndex(range);
      } catch {
        // Ignore — sortIndex update is best-effort
      }

      let changed = false;
      if (newPosition !== ann.annotationPosition) {
        ann.annotationPosition = newPosition;
        changed = true;
      }
      if (newSortIndex && newSortIndex !== ann.annotationSortIndex) {
        ann.annotationSortIndex = newSortIndex;
        changed = true;
      }
      if (changed) {
        await ann.saveTx();
        fixed++;
      }
    } catch (e) {
      Zotero.debug(`ZutiloRE: Failed to fix annotation ${ann.key}: ${e}`);
      broken++;
    }
  }

  return { fixed, broken };
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

function serializeDoc(doc: Document): string {
  let html = '';
  if (doc.doctype) {
    html += `<!DOCTYPE ${doc.doctype.name}`;
    if (doc.doctype.publicId) html += ` PUBLIC "${doc.doctype.publicId}"`;
    if (doc.doctype.systemId) html += ` "${doc.doctype.systemId}"`;
    html += '>\n';
  }
  html += doc.documentElement.outerHTML;
  return html;
}

function showNotification(doc: Document, message: string): void {
  const el = doc.createElement('div');
  el.setAttribute(ATTR_UI, 'true');
  el.style.cssText = [
    'position:fixed', 'top:16px', 'left:50%', 'transform:translateX(-50%)',
    'z-index:2147483647', 'background:#2ecc71', 'color:#fff',
    'padding:10px 24px', 'border-radius:6px',
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
    'font-size:14px', 'box-shadow:0 4px 12px rgba(0,0,0,0.3)',
    'transition:opacity 0.5s',
  ].join(';');
  el.textContent = `Saved! ${message}`;
  doc.body.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 500);
  }, 2000);
}
