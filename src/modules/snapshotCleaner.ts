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
const SELECTED_CLASS = 'zutilore-selected';
const CSS_PANEL_ID = 'zutilore-css-panel';
const PRESET_STYLE_ID = 'zutilore-preset-style';

type UndoAction =
  | { type: 'remove'; element: HTMLElement; previousDisplay: string }
  | { type: 'css-change'; element: HTMLElement; property: string; oldValue: string; newValue: string }
  | { type: 'preset-css'; styleBlockId: string; previousInlineStyles: Array<{ element: HTMLElement; prev: string }> };

interface CleanerSession {
  active: boolean;
  reader: any;
  snapshotWin: any;
  snapshotDoc: Document;
  /** The parent document that contains the snapshot iframe (reader chrome) */
  parentDoc: Document;
  /** The <iframe> element hosting the snapshot */
  iframeEl: HTMLIFrameElement;
  undoStack: UndoAction[];
  redoStack: UndoAction[];
  highlightedEl: HTMLElement | null;
  ancestorLevel: number;
  baseElement: HTMLElement | null;
  /** Toolbar lives in parentDoc, above the iframe */
  toolbarEl: HTMLElement | null;
  /** Style injected into parentDoc for toolbar + CSS panel */
  toolbarStyleEl: HTMLElement | null;
  styleEl: HTMLElement | null;
  cleanupFns: Array<() => void>;
  toggleButton: HTMLElement | null;
  mode: 'remove' | 'css';
  cssPanelEl: HTMLElement | null;
  selectedEl: HTMLElement | null;
  presetStyleEl: HTMLElement | null;
  /** DevTools-style overlay container for box-model visualization */
  overlayContainer: HTMLElement | null;
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

    const primaryView = reader._internalReader._primaryView;
    const snapshotWin = primaryView._iframeWindow;
    const snapshotDoc = snapshotWin.document;
    const iframeEl = primaryView._iframe as HTMLIFrameElement;
    const parentDoc = iframeEl.ownerDocument;

    const session: CleanerSession = {
      active: true,
      reader,
      snapshotWin,
      snapshotDoc,
      parentDoc,
      iframeEl,
      undoStack: [],
      redoStack: [],
      highlightedEl: null,
      ancestorLevel: 0,
      baseElement: null,
      toolbarEl: null,
      toolbarStyleEl: null,
      styleEl: null,
      cleanupFns: [],
      toggleButton: button,
      mode: 'remove',
      cssPanelEl: null,
      selectedEl: null,
      presetStyleEl: null,
      overlayContainer: null,
    };

    sessions.set(reader._instanceID, session);

    // Visual feedback on toolbar button (use reader's "active" class)
    button.classList.add('active');

    injectStyles(session);
    injectControlBar(session);
    injectCSSPanel(session);
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
      `You have ${session.undoStack.length} unsaved change(s). Save before exiting?`,
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
  // Remove overlay elements
  session.overlayContainer?.remove();

  // Remove selected element indicator
  if (session.selectedEl) {
    session.selectedEl.classList.remove(SELECTED_CLASS);
  }

  // Remove injected UI (toolbar lives in parentDoc, rest in snapshotDoc)
  session.toolbarEl?.remove();
  session.toolbarStyleEl?.remove();
  session.styleEl?.remove();
  session.cssPanelEl?.remove();

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
  session.selectedEl = null;
  session.cssPanelEl = null;
  session.overlayContainer = null;
  sessions.delete(session.reader._instanceID);
  Zotero.debug('ZutiloRE: Exited HTML Editor mode');
}

// ---------------------------------------------------------------------------
// CSS injection
// ---------------------------------------------------------------------------

function injectStyles(session: CleanerSession): void {
  const doc = session.snapshotDoc;
  const style = doc.createElement('style');
  style.setAttribute(ATTR_UI, 'true');
  style.textContent = `
    [${ATTR_REMOVED}] {
      display: none !important;
    }
    .${SELECTED_CLASS} {
      outline: 3px solid #89b4fa !important;
      outline-offset: -1px !important;
      background-color: rgba(137, 180, 250, 0.08) !important;
    }
  `;
  doc.head.appendChild(style);
  session.styleEl = style;

  // Create overlay container — uses position:fixed so coordinates are viewport-relative.
  // All styles are inline with cssText to be immune to page CSS interference.
  const container = doc.createElement('div');
  container.setAttribute(ATTR_UI, 'true');
  container.style.cssText = 'position:fixed !important;top:0 !important;left:0 !important;'
    + 'width:100vw !important;height:100vh !important;'
    + 'pointer-events:none !important;z-index:2147483646 !important;'
    + 'overflow:visible !important;margin:0 !important;padding:0 !important;'
    + 'border:none !important;background:none !important;'
    + 'transform:none !important;opacity:1 !important;display:block !important;';
  doc.documentElement.appendChild(container);
  session.overlayContainer = container;
}

// ---------------------------------------------------------------------------
// Control bar
// ---------------------------------------------------------------------------

function injectControlBar(session: CleanerSession): void {
  // Inject toolbar into the PARENT document (reader chrome), not the snapshot
  // iframe. This avoids all position:fixed overlap issues because the toolbar
  // sits in the flex layout above the iframe and naturally pushes it down.
  const pdoc = session.parentDoc;

  // Inject toolbar styles into the parent document
  const style = pdoc.createElement('style');
  style.textContent = `
    #${TOOLBAR_ID} {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #e8e8e8;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      box-shadow: 0 3px 12px rgba(0,0,0,0.4);
      user-select: none;
      line-height: 1.4;
      flex-shrink: 0;
    }
    #${TOOLBAR_ID} button {
      padding: 5px 12px;
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 4px;
      background: rgba(255,255,255,0.1);
      color: #e8e8e8;
      cursor: pointer;
      font-size: 12px;
      font-family: inherit;
      white-space: nowrap;
    }
    #${TOOLBAR_ID} button:hover:not(:disabled) {
      background: rgba(255,255,255,0.2);
    }
    #${TOOLBAR_ID} button:disabled {
      opacity: 0.4;
      cursor: default;
    }
    #${TOOLBAR_ID} button.zr-save {
      background: rgba(46,204,113,0.3);
      border-color: rgba(46,204,113,0.5);
    }
    #${TOOLBAR_ID} button.zr-save:hover:not(:disabled) {
      background: rgba(46,204,113,0.5);
    }
    #${TOOLBAR_ID} button.zr-exit {
      background: rgba(231,76,60,0.3);
      border-color: rgba(231,76,60,0.5);
    }
    #${TOOLBAR_ID} button.zr-exit:hover {
      background: rgba(231,76,60,0.5);
    }
    #${TOOLBAR_ID} .zr-info {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: #aaa;
      font-size: 12px;
      font-family: "SF Mono", "Fira Code", Consolas, monospace;
    }
    #${TOOLBAR_ID} .zr-sep {
      width: 1px; height: 20px;
      background: rgba(255,255,255,0.2);
      margin: 0 4px;
    }
    #${TOOLBAR_ID} button.zr-mode-active {
      background: rgba(137, 180, 250, 0.3);
      border-color: rgba(137, 180, 250, 0.5);
      color: #fff;
    }
    #${TOOLBAR_ID} button.zr-preset {
      background: rgba(186, 146, 255, 0.3);
      border-color: rgba(186, 146, 255, 0.5);
    }
    #${TOOLBAR_ID} button.zr-preset:hover:not(:disabled) {
      background: rgba(186, 146, 255, 0.5);
    }
    #${TOOLBAR_ID} button.zr-preset.zr-preset-on {
      background: rgba(186, 146, 255, 0.5);
      box-shadow: inset 0 0 0 1px rgba(186, 146, 255, 0.8);
    }
    /* Grid layout on .primary-view: toolbar spans full width,
       iframe + CSS panel share the second row side by side.
       No iframe reparenting — all elements stay as direct children. */
    .primary-view.zutilore-grid-active {
      display: grid !important;
      grid-template-rows: auto 1fr;
      grid-template-columns: 1fr;
    }
    .primary-view.zutilore-grid-active.zutilore-panel-open {
      grid-template-columns: 1fr 320px;
    }
    .primary-view.zutilore-grid-active > #${TOOLBAR_ID} {
      grid-column: 1 / -1;
    }
    .primary-view.zutilore-grid-active > iframe {
      grid-row: 2;
      grid-column: 1;
      width: 100%;
      height: 100%;
      min-width: 0;
      min-height: 0;
    }
    /* CSS panel */
    #${CSS_PANEL_ID} {
      grid-row: 2;
      grid-column: 2;
      width: 320px;
      background: #1e1e2e;
      color: #cdd6f4;
      font-family: "SF Mono", "Fira Code", Consolas, monospace;
      font-size: 12px;
      overflow-y: auto;
      border-left: 1px solid rgba(255,255,255,0.1);
      display: none;
      line-height: 1.4;
    }
    #${CSS_PANEL_ID}.zr-panel-visible {
      display: block;
    }
    #${CSS_PANEL_ID} .zr-css-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      background: rgba(255,255,255,0.05);
      border-bottom: 1px solid rgba(255,255,255,0.1);
      font-weight: 600;
      font-size: 13px;
      color: #cdd6f4;
    }
    #${CSS_PANEL_ID} .zr-css-header button {
      background: none;
      border: none;
      color: #888;
      cursor: pointer;
      font-size: 18px;
      padding: 0 4px;
      line-height: 1;
    }
    #${CSS_PANEL_ID} .zr-css-header button:hover {
      color: #e74c3c;
    }
    #${CSS_PANEL_ID} .zr-css-selector {
      padding: 6px 12px;
      color: #f9e2af;
      font-size: 12px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    #${CSS_PANEL_ID} .zr-css-section {
      padding: 4px 0;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    #${CSS_PANEL_ID} .zr-css-section-title {
      padding: 4px 12px;
      color: #7f849c;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    #${CSS_PANEL_ID} .zr-css-row {
      display: flex;
      align-items: center;
      padding: 2px 12px;
    }
    #${CSS_PANEL_ID} .zr-css-row:hover {
      background: rgba(255,255,255,0.03);
    }
    #${CSS_PANEL_ID} .zr-css-name {
      width: 140px;
      flex-shrink: 0;
      color: #89b4fa;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    #${CSS_PANEL_ID} .zr-css-val {
      flex: 1;
      color: #a6e3a1;
      background: none;
      border: 1px solid transparent;
      border-radius: 2px;
      padding: 1px 4px;
      font-family: inherit;
      font-size: inherit;
      outline: none;
      min-width: 0;
    }
    #${CSS_PANEL_ID} .zr-css-val:hover {
      border-color: rgba(255,255,255,0.15);
    }
    #${CSS_PANEL_ID} .zr-css-val:focus {
      border-color: #89b4fa;
      background: rgba(255,255,255,0.08);
      color: #fff;
    }
    #${CSS_PANEL_ID} .zr-css-inline-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #f9e2af;
      margin-left: 4px;
      flex-shrink: 0;
    }
    #${CSS_PANEL_ID} .zr-css-empty {
      padding: 24px 12px;
      color: #585b70;
      text-align: center;
      font-style: italic;
    }
  `;
  pdoc.head.appendChild(style);
  session.toolbarStyleEl = style;

  const bar = pdoc.createElement('div');
  bar.id = TOOLBAR_ID;

  bar.innerHTML = `
    <span style="font-weight:600;color:#e74c3c;">HTML Editor</span>
    <span class="zr-sep"></span>
    <button id="zr-mode-remove" class="zr-mode-active" title="Element removal mode">Remove</button>
    <button id="zr-mode-css" title="CSS editing mode">CSS</button>
    <span class="zr-sep"></span>
    <button id="zr-preset" class="zr-preset" title="Apply preset layout to center content">Preset Layout</button>
    <span class="zr-sep"></span>
    <span class="zr-info" id="zr-info">Click element to remove. Scroll to navigate. Ctrl+Z/Y undo/redo.</span>
    <span class="zr-sep"></span>
    <button id="zr-undo" disabled>Undo (0)</button>
    <button id="zr-redo" disabled>Redo (0)</button>
    <span class="zr-sep"></span>
    <button id="zr-save" class="zr-save" disabled>Save</button>
    <button id="zr-exit" class="zr-exit">Exit</button>
  `;

  // Insert toolbar as a sibling before the iframe in .primary-view.
  // Switch container to CSS Grid so toolbar spans full width above,
  // and iframe + CSS panel share the second row side by side.
  // IMPORTANT: never reparent the iframe — Gecko reloads it on reparent.
  const container = session.iframeEl.parentElement!;
  container.classList.add('zutilore-grid-active');
  session.iframeEl.before(bar);
  session.toolbarEl = bar;

  // Restore container layout on cleanup
  session.cleanupFns.push(() => {
    container.classList.remove('zutilore-grid-active', 'zutilore-panel-open');
  });

  const btn = (id: string) => pdoc.getElementById(id)!;

  btn('zr-mode-remove').addEventListener('click', (e) => {
    e.stopPropagation();
    setMode(session, 'remove');
  });
  btn('zr-mode-css').addEventListener('click', (e) => {
    e.stopPropagation();
    setMode(session, 'css');
  });
  btn('zr-preset').addEventListener('click', (e) => {
    e.stopPropagation();
    applyPresetCSS(session);
  });
  btn('zr-undo').addEventListener('click', (e) => {
    e.stopPropagation();
    undoOne(session);
    refreshBar(session);
    refreshCSSPanelIfNeeded(session);
  });
  btn('zr-redo').addEventListener('click', (e) => {
    e.stopPropagation();
    redoOne(session);
    refreshBar(session);
    refreshCSSPanelIfNeeded(session);
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
  const doc = session.parentDoc;
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
  const info = session.parentDoc.getElementById('zr-info');
  if (!info) return;
  if (!el) {
    showModeInfo(session);
    return;
  }

  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const classes = el.className && typeof el.className === 'string'
    ? el.className.split(/\s+/)
        .filter(c => c && c !== HIGHLIGHT_CLASS && c !== SELECTED_CLASS)
        .map(c => '.' + c)
        .join('')
    : '';
  const dims = `${el.offsetWidth}\u00D7${el.offsetHeight}`;
  let label = `<${tag}${id}${classes}> ${dims}`;
  if (session.ancestorLevel > 0) {
    label += ` \u2191${session.ancestorLevel}`;
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

    if (session.mode === 'remove') {
      if (session.highlightedEl) {
        removeEl(session, session.highlightedEl);
        refreshBar(session);
        session.highlightedEl = null;
        session.baseElement = null;
        session.ancestorLevel = 0;
        showElementInfo(session, null);
      }
    } else if (session.mode === 'css') {
      if (session.highlightedEl) {
        // Deselect previous
        if (session.selectedEl) {
          session.selectedEl.classList.remove(SELECTED_CLASS);
        }
        session.selectedEl = session.highlightedEl;
        session.selectedEl.classList.add(SELECTED_CLASS);
        updateCSSPanel(session, session.selectedEl);
      }
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
    const target = e.target as HTMLElement;
    const inPanelInput = target?.tagName === 'INPUT' && isUI(target);
    const ctrl = e.ctrlKey || e.metaKey;

    // Let normal typing through in panel inputs
    if (inPanelInput && !ctrl && e.key !== 'Escape') return;

    if (ctrl && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      undoOne(session);
      refreshBar(session);
      refreshCSSPanelIfNeeded(session);
    } else if (ctrl && (e.key === 'y' || (e.shiftKey && (e.key === 'z' || e.key === 'Z')))) {
      e.preventDefault();
      redoOne(session);
      refreshBar(session);
      refreshCSSPanelIfNeeded(session);
    } else if (ctrl && e.key === 's') {
      e.preventDefault();
      if (session.undoStack.length > 0) saveChanges(session);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (inPanelInput) {
        (target as HTMLInputElement).blur();
      } else {
        doExit(session, true);
      }
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
    updateOverlay(session, el);
    showElementInfo(session, el);
    return;
  }
  session.highlightedEl = el;
  updateOverlay(session, el);
  showElementInfo(session, el);
}

/**
 * Draw Chrome DevTools-style box-model overlay on the highlighted element.
 * Uses position:fixed with viewport-relative coordinates and fully inline
 * styles to be immune to any page CSS interference.
 *
 * Layers (back to front): margin (orange), border (yellow),
 * padding (green), content (blue).
 */
function updateOverlay(session: CleanerSession, el: HTMLElement | null): void {
  const container = session.overlayContainer;
  if (!container) return;

  // Clear previous overlay
  while (container.firstChild) container.firstChild.remove();

  if (!el) return;

  const win = session.snapshotWin;
  const computed = win.getComputedStyle(el);
  const rect = el.getBoundingClientRect();

  // Parse box-model values
  const mt = parseFloat(computed.marginTop) || 0;
  const mr = parseFloat(computed.marginRight) || 0;
  const mb = parseFloat(computed.marginBottom) || 0;
  const ml = parseFloat(computed.marginLeft) || 0;

  const bt = parseFloat(computed.borderTopWidth) || 0;
  const brw = parseFloat(computed.borderRightWidth) || 0;
  const bb = parseFloat(computed.borderBottomWidth) || 0;
  const blw = parseFloat(computed.borderLeftWidth) || 0;

  const pt = parseFloat(computed.paddingTop) || 0;
  const pr = parseFloat(computed.paddingRight) || 0;
  const pb = parseFloat(computed.paddingBottom) || 0;
  const pl = parseFloat(computed.paddingLeft) || 0;

  // Viewport-relative positions (fixed positioning)
  const marginBox = {
    x: rect.left - ml,
    y: rect.top - mt,
    w: rect.width + ml + mr,
    h: rect.height + mt + mb,
  };

  const borderBox = {
    x: rect.left,
    y: rect.top,
    w: rect.width,
    h: rect.height,
  };

  const paddingBox = {
    x: borderBox.x + blw,
    y: borderBox.y + bt,
    w: borderBox.w - blw - brw,
    h: borderBox.h - bt - bb,
  };

  const contentBox = {
    x: paddingBox.x + pl,
    y: paddingBox.y + pt,
    w: paddingBox.w - pl - pr,
    h: paddingBox.h - pt - pb,
  };

  const doc = session.snapshotDoc;

  // Helper: create an overlay div with fully inline styles
  const makeBox = (box: { x: number; y: number; w: number; h: number }, bg: string) => {
    const div = doc.createElement('div');
    div.style.cssText = `position:fixed !important;`
      + `left:${box.x}px !important;top:${box.y}px !important;`
      + `width:${Math.max(0, box.w)}px !important;height:${Math.max(0, box.h)}px !important;`
      + `background:${bg} !important;pointer-events:none !important;`
      + `margin:0 !important;padding:0 !important;border:none !important;`
      + `box-sizing:border-box !important;transform:none !important;`
      + `opacity:1 !important;display:block !important;z-index:2147483646 !important;`;
    return div;
  };

  container.appendChild(makeBox(marginBox, 'rgba(246, 178, 107, 0.3)'));
  container.appendChild(makeBox(borderBox, 'rgba(255, 217, 102, 0.35)'));
  container.appendChild(makeBox(paddingBox, 'rgba(147, 196, 125, 0.4)'));
  container.appendChild(makeBox(contentBox, 'rgba(111, 168, 220, 0.35)'));
}

function removeEl(session: CleanerSession, el: HTMLElement): void {
  // Clear overlay since the element is being removed
  updateOverlay(session, null);
  session.undoStack.push({
    type: 'remove',
    element: el,
    previousDisplay: el.style.display || '',
  });
  session.redoStack = [];
  el.setAttribute(ATTR_REMOVED, 'true');
}

function undoOne(session: CleanerSession): void {
  const action = session.undoStack.pop();
  if (!action) return;
  switch (action.type) {
    case 'remove':
      action.element.removeAttribute(ATTR_REMOVED);
      action.element.style.display = action.previousDisplay;
      break;
    case 'css-change':
      if (action.oldValue) {
        action.element.style.setProperty(action.property, action.oldValue, 'important');
      } else {
        action.element.style.removeProperty(action.property);
      }
      break;
    case 'preset-css': {
      const block = session.snapshotDoc.getElementById(action.styleBlockId);
      if (block) block.remove();
      session.presetStyleEl = null;
      for (const { element, prev } of action.previousInlineStyles) {
        element.setAttribute('style', prev);
      }
      break;
    }
  }
  session.redoStack.push(action);
}

function redoOne(session: CleanerSession): void {
  const action = session.redoStack.pop();
  if (!action) return;
  switch (action.type) {
    case 'remove':
      action.element.setAttribute(ATTR_REMOVED, 'true');
      break;
    case 'css-change':
      action.element.style.setProperty(action.property, action.newValue, 'important');
      break;
    case 'preset-css': {
      const existing = session.snapshotDoc.getElementById(action.styleBlockId);
      if (!existing) {
        const style = buildPresetStyleBlock(session.snapshotDoc);
        session.snapshotDoc.head.appendChild(style);
        session.presetStyleEl = style;
      }
      for (const { element } of action.previousInlineStyles) {
        clearLayoutInlineStyles(element);
      }
      break;
    }
  }
  session.undoStack.push(action);
}

// ---------------------------------------------------------------------------
// Mode switching
// ---------------------------------------------------------------------------

function setMode(session: CleanerSession, mode: 'remove' | 'css'): void {
  if (session.mode === mode) return;
  session.mode = mode;

  const doc = session.parentDoc;
  const removeBtn = doc.getElementById('zr-mode-remove');
  const cssBtn = doc.getElementById('zr-mode-css');

  if (mode === 'remove') {
    removeBtn?.classList.add('zr-mode-active');
    cssBtn?.classList.remove('zr-mode-active');
    // Hide CSS panel
    hideCSSPanel(session);
    // Clear selected element
    if (session.selectedEl) {
      session.selectedEl.classList.remove(SELECTED_CLASS);
      session.selectedEl = null;
    }
    showModeInfo(session);
  } else {
    removeBtn?.classList.remove('zr-mode-active');
    cssBtn?.classList.add('zr-mode-active');
    // Show CSS panel (empty state)
    showCSSPanel(session);
    showModeInfo(session);
  }
}

function showModeInfo(session: CleanerSession): void {
  const info = session.parentDoc.getElementById('zr-info');
  if (!info) return;
  if (session.mode === 'remove') {
    info.textContent = 'Click element to remove. Scroll to navigate. Ctrl+Z/Y undo/redo.';
  } else {
    info.textContent = 'Click element to inspect styles. Scroll to navigate.';
  }
}

// ---------------------------------------------------------------------------
// Preset CSS
// ---------------------------------------------------------------------------

const PRESET_CSS = `
/* ZutiloRE Preset: Readable Layout */
html { overflow-x: hidden !important; }
body {
  max-width: 900px !important;
  margin-left: auto !important;
  margin-right: auto !important;
  padding-left: 16px !important;
  padding-right: 16px !important;
  width: auto !important;
  min-width: 0 !important;
}
main, article, [role="main"],
.content, #content, .post, .article, .entry-content {
  max-width: 100% !important;
  width: auto !important;
  margin-left: 0 !important;
  margin-right: 0 !important;
  padding-left: 0 !important;
  padding-right: 0 !important;
  float: none !important;
  position: static !important;
}
img, video, iframe, table, pre {
  max-width: 100% !important;
  height: auto !important;
}
`;

const LAYOUT_INLINE_PROPS = ['width', 'max-width', 'min-width', 'margin', 'margin-left', 'margin-right', 'padding', 'padding-left', 'padding-right'];

function buildPresetStyleBlock(doc: Document): HTMLElement {
  const style = doc.createElement('style');
  style.id = PRESET_STYLE_ID;
  style.textContent = PRESET_CSS;
  return style;
}

function clearLayoutInlineStyles(el: HTMLElement): void {
  for (const prop of LAYOUT_INLINE_PROPS) {
    el.style.removeProperty(prop);
  }
}

function getLayoutContainers(doc: Document): HTMLElement[] {
  const containers: HTMLElement[] = [];
  const body = doc.body;
  if (body) containers.push(body);

  const selectors = ['main', 'article', '[role="main"]', '.content', '#content', '.post', '.article', '.entry-content'];
  for (const sel of selectors) {
    const el = doc.querySelector(sel) as HTMLElement | null;
    if (el && !containers.includes(el)) {
      containers.push(el);
    }
  }
  return containers;
}

function applyPresetCSS(session: CleanerSession): void {
  const sdoc = session.snapshotDoc;
  const existing = sdoc.getElementById(PRESET_STYLE_ID);
  const presetBtn = session.parentDoc.getElementById('zr-preset');

  if (existing) {
    // Toggle off: remove preset and restore inline styles
    existing.remove();
    session.presetStyleEl = null;
    presetBtn?.classList.remove('zr-preset-on');
    return;
  }

  // Save current inline styles before modification
  const containers = getLayoutContainers(sdoc);
  const savedStyles: Array<{ element: HTMLElement; prev: string }> = [];
  for (const el of containers) {
    savedStyles.push({ element: el, prev: el.getAttribute('style') || '' });
  }

  // Inject <style> block (persistent — no data-zutilore-ui)
  const style = buildPresetStyleBlock(sdoc);
  sdoc.head.appendChild(style);
  session.presetStyleEl = style;

  // Clear conflicting inline styles on containers
  for (const el of containers) {
    clearLayoutInlineStyles(el);
  }

  // Push undo action
  session.undoStack.push({
    type: 'preset-css',
    styleBlockId: PRESET_STYLE_ID,
    previousInlineStyles: savedStyles,
  });
  session.redoStack = [];

  presetBtn?.classList.add('zr-preset-on');
  refreshBar(session);
}

// ---------------------------------------------------------------------------
// CSS Panel
// ---------------------------------------------------------------------------

const CSS_PROPERTY_GROUPS: Array<{ title: string; props: string[] }> = [
  {
    title: 'Box Model',
    props: [
      'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
      'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
      'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
      'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
    ],
  },
  {
    title: 'Layout',
    props: ['display', 'position', 'float', 'clear', 'overflow', 'box-sizing', 'z-index'],
  },
  {
    title: 'Flex / Grid',
    props: ['flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'gap'],
  },
  {
    title: 'Typography',
    props: ['font-family', 'font-size', 'font-weight', 'line-height', 'color', 'text-align'],
  },
  {
    title: 'Background',
    props: ['background-color', 'background-image'],
  },
];

function injectCSSPanel(session: CleanerSession): void {
  const pdoc = session.parentDoc;
  const panel = pdoc.createElement('div');
  panel.id = CSS_PANEL_ID;

  panel.innerHTML = `
    <div class="zr-css-header">
      <span>Computed Styles</span>
      <button id="zr-css-close" title="Close">\u00D7</button>
    </div>
    <div class="zr-css-selector" id="zr-css-selector"></div>
    <div class="zr-css-body" id="zr-css-body">
      <div class="zr-css-empty">Select an element to inspect</div>
    </div>
  `;

  // Place panel after the iframe as a sibling in .primary-view
  session.iframeEl.after(panel);
  session.cssPanelEl = panel;

  pdoc.getElementById('zr-css-close')!.addEventListener('click', (e) => {
    e.stopPropagation();
    hideCSSPanel(session);
    if (session.selectedEl) {
      session.selectedEl.classList.remove(SELECTED_CLASS);
      session.selectedEl = null;
    }
  });
}

function showCSSPanel(session: CleanerSession): void {
  session.cssPanelEl?.classList.add('zr-panel-visible');
  session.iframeEl.parentElement?.classList.add('zutilore-panel-open');
}

function hideCSSPanel(session: CleanerSession): void {
  session.cssPanelEl?.classList.remove('zr-panel-visible');
  session.iframeEl.parentElement?.classList.remove('zutilore-panel-open');
}

function updateCSSPanel(session: CleanerSession, el: HTMLElement): void {
  // Panel lives in parentDoc; element data comes from snapshotDoc
  const pdoc = session.parentDoc;
  const selectorEl = pdoc.getElementById('zr-css-selector');
  const bodyEl = pdoc.getElementById('zr-css-body');
  if (!selectorEl || !bodyEl) return;

  // Show panel
  showCSSPanel(session);

  // Update selector display
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const classes = el.className && typeof el.className === 'string'
    ? el.className.split(/\s+/)
        .filter(c => c && c !== HIGHLIGHT_CLASS && c !== SELECTED_CLASS)
        .map(c => '.' + c)
        .join('')
    : '';
  selectorEl.textContent = `${tag}${id}${classes}`;

  // Get computed styles
  const computed = session.snapshotWin.getComputedStyle(el);
  const display = computed.getPropertyValue('display');

  // Build property rows
  bodyEl.innerHTML = '';

  for (const group of CSS_PROPERTY_GROUPS) {
    // Skip flex/grid section if element isn't flex/grid
    if (group.title === 'Flex / Grid' && display !== 'flex' && display !== 'inline-flex' && display !== 'grid' && display !== 'inline-grid') {
      continue;
    }

    const section = pdoc.createElement('div');
    section.className = 'zr-css-section';

    const title = pdoc.createElement('div');
    title.className = 'zr-css-section-title';
    title.textContent = group.title;
    section.appendChild(title);

    for (const prop of group.props) {
      const computedVal = computed.getPropertyValue(prop);
      const inlineVal = el.style.getPropertyValue(prop);
      const row = pdoc.createElement('div');
      row.className = 'zr-css-row';

      const nameSpan = pdoc.createElement('span');
      nameSpan.className = 'zr-css-name';
      nameSpan.textContent = prop;

      const input = pdoc.createElement('input');
      input.className = 'zr-css-val';
      input.type = 'text';
      input.value = computedVal;
      input.dataset.prop = prop;
      input.dataset.original = computedVal;

      row.appendChild(nameSpan);
      row.appendChild(input);

      // Show inline override indicator
      if (inlineVal) {
        const dot = pdoc.createElement('span');
        dot.className = 'zr-css-inline-dot';
        dot.title = `Inline: ${inlineVal}`;
        row.appendChild(dot);
      }

      section.appendChild(row);

      // Wire up editing
      input.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          input.blur();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          input.value = input.dataset.original || '';
          input.blur();
        }
      });

      input.addEventListener('blur', () => {
        const newVal = input.value.trim();
        const prevInline = el.style.getPropertyValue(prop);
        if (newVal === input.dataset.original && !prevInline) return;
        if (newVal === prevInline) return;

        applyCSSChange(session, el, prop, newVal, prevInline);
        // Refresh the computed value
        const newComputed = session.snapshotWin.getComputedStyle(el).getPropertyValue(prop);
        input.value = newComputed;
        input.dataset.original = newComputed;
      });
    }

    bodyEl.appendChild(section);
  }
}

function applyCSSChange(session: CleanerSession, el: HTMLElement, property: string, newValue: string, oldValue: string): void {
  if (newValue) {
    el.style.setProperty(property, newValue, 'important');
  } else {
    el.style.removeProperty(property);
  }

  session.undoStack.push({
    type: 'css-change',
    element: el,
    property,
    oldValue,
    newValue,
  });
  session.redoStack = [];
  refreshBar(session);
}

function refreshCSSPanelIfNeeded(session: CleanerSession): void {
  if (session.mode === 'css' && session.selectedEl) {
    // Check if the selected element is still in the document
    if (!session.snapshotDoc.contains(session.selectedEl)) {
      session.selectedEl = null;
      const bodyEl = session.parentDoc.getElementById('zr-css-body');
      if (bodyEl) bodyEl.innerHTML = '<div class="zr-css-empty">Element was removed</div>';
      return;
    }
    updateCSSPanel(session, session.selectedEl);
  }
  // Update preset button state (button in parentDoc, style in snapshotDoc)
  const presetBtn = session.parentDoc.getElementById('zr-preset');
  const presetExists = !!session.snapshotDoc.getElementById(PRESET_STYLE_ID);
  if (presetBtn) {
    if (presetExists) {
      presetBtn.classList.add('zr-preset-on');
    } else {
      presetBtn.classList.remove('zr-preset-on');
    }
  }
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

    // Choose save strategy based on whether annotations exist and elements are removed
    const hasRemovals = session.undoStack.some(a => a.type === 'remove');
    const annotations = item.getAnnotations();
    let strategy: 'remove' | 'hide' | 'fix' = 'remove';

    if (hasRemovals && annotations.length > 0) {
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
    // Toolbar, CSS panel live in parentDoc; only styleEl + overlays in snapshotDoc.
    session.cssPanelEl?.remove();
    session.toolbarEl?.remove();
    session.toolbarStyleEl?.remove();
    const container = session.iframeEl.parentElement!;
    container.classList.remove('zutilore-grid-active', 'zutilore-panel-open');
    session.overlayContainer?.remove();
    session.styleEl?.remove();
    if (session.selectedEl) {
      session.selectedEl.classList.remove(SELECTED_CLASS);
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
    const parts: string[] = [];
    const cssChanges = session.undoStack.filter(a => a.type === 'css-change').length;
    const hasPreset = session.undoStack.some(a => a.type === 'preset-css');

    if (count > 0) {
      if (strategy === 'hide') {
        parts.push(`${count} element(s) hidden.`);
      } else if (strategy === 'fix' && fixResult) {
        parts.push(`${count} element(s) removed.`);
        if (fixResult.fixed > 0) parts.push(`${fixResult.fixed} annotation(s) fixed.`);
        if (fixResult.broken > 0) parts.push(`${fixResult.broken} annotation(s) broken.`);
      } else {
        parts.push(`${count} element(s) removed.`);
      }
    }
    if (hasPreset) parts.push('Preset layout applied.');
    if (cssChanges > 0) parts.push(`${cssChanges} CSS change(s).`);
    if (parts.length === 0) parts.push('Changes saved.');

    const msg = parts.join(' ');
    Zotero.debug(`ZutiloRE: Saved snapshot \u2013 ${msg}`);

    // --- Cleanup session ---
    // UI elements and grid classes were already removed above for serialization.
    session.undoStack = [];
    session.redoStack = [];
    // Don't run cleanupFns — teardown was already done
    session.cleanupFns = [];
    if (session.toggleButton) {
      session.toggleButton.classList.remove('active');
    }
    session.active = false;
    session.highlightedEl = null;
    session.selectedEl = null;
    session.cssPanelEl = null;
    sessions.delete(session.reader._instanceID);

    showNotification(session.snapshotDoc, msg);
  } catch (e) {
    Zotero.debug(`ZutiloRE: Failed to save snapshot: ${e}`);

    // Restore UI on failure — re-inject all elements
    if (session.styleEl) {
      session.snapshotDoc.head.appendChild(session.styleEl);
    }
    if (session.overlayContainer) {
      session.snapshotDoc.documentElement.appendChild(session.overlayContainer);
    }
    if (session.toolbarStyleEl) {
      session.parentDoc.head.appendChild(session.toolbarStyleEl);
    }
    const errContainer = session.iframeEl.parentElement!;
    errContainer.classList.add('zutilore-grid-active');
    if (session.toolbarEl) {
      session.iframeEl.before(session.toolbarEl);
    }
    if (session.cssPanelEl) {
      session.iframeEl.after(session.cssPanelEl);
    }

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
