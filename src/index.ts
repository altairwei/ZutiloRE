/**
 * ZutiloRE - Main Entry Point
 * Zotero 7/8 Utility Plugin
 */

import { onStartup, onShutdown } from './hooks';
import { registerMenus } from './modules/main';
import { copyTags, pasteTags, removeTags } from './modules/tags';
import { relateItems, copyZoteroSelectLink, copyZoteroItemID, copyZoteroItemURI } from './modules/items';
import { copyCollectionLink } from './modules/collections';
import { createBookFromSection, createSectionFromBook } from './modules/creation';

// Export plugin API for Zotero
const zutiloRE = {
  initialized: false,

  // Expose registerMenus for bootstrap.js call
  registerMenus,

  /**
   * Initialize the plugin
   */
  async init(): Promise<void> {
    Zotero.debug('ZutiloRE: init() called');

    await Promise.all([
      Zotero.initializationPromise,
      Zotero.unlockPromise,
      Zotero.uiReadyPromise,
    ]);

    // Register menus in all main windows
    for (const win of Zotero.getMainWindows()) {
      await this.onWindowLoad(win);
    }

    this.initialized = true;
    Zotero.debug('ZutiloRE: Initialized successfully');
  },

  /**
   * Called when a main window loads
   */
  async onWindowLoad(win: Window): Promise<void> {
    Zotero.debug('ZutiloRE: onWindowLoad called');

    await new Promise<void>((resolve) => {
      if (win.document.readyState === 'complete') {
        resolve();
      } else {
        win.document.addEventListener('readystatechange', () => {
          if (win.document.readyState === 'complete') {
            resolve();
          }
        });
      }
    });

    Zotero.debug('ZutiloRE: Window ready, calling registerMenus');
    registerMenus(win);
  },

  /**
   * Handle menu commands
   */
  handleMenuCommand(commandId: string): void {
    switch (commandId) {
      case 'zutilore-copy-tags':
        copyTags();
        break;
      case 'zutilore-paste-tags':
        pasteTags();
        break;
      case 'zutilore-remove-tags':
        removeTags();
        break;
      case 'zutilore-relate-items':
        relateItems();
        break;
      case 'zutilore-copy-collection-link':
        copyCollectionLink();
        break;
      case 'zutilore-copy-select-link':
        copyZoteroSelectLink();
        break;
      case 'zutilore-copy-item-id':
        copyZoteroItemID();
        break;
      case 'zutilore-copy-item-uri':
        copyZoteroItemURI();
        break;
      case 'zutilore-create-book-from-section':
        createBookFromSection();
        break;
      case 'zutilore-create-section-from-book':
        createSectionFromBook();
        break;
    }
  },

  /**
   * Get selected items from active window
   */
  getSelectedItems(): ZoteroItem[] {
    const zoteroPane = Zotero.getActiveZoteroPane();
    if (!zoteroPane) return [];
    return zoteroPane.getSelectedItems() as ZoteroItem[];
  },

  /**
   * Get selected collection
   */
  getSelectedCollection(): ZoteroCollection | null {
    const zoteroPane = Zotero.getActiveZoteroPane();
    if (!zoteroPane) return null;

    const collectionTreeRow = zoteroPane.getCollectionTreeRow();
    if (!collectionTreeRow || !collectionTreeRow.isCollection()) return null;

    return collectionTreeRow.ref || collectionTreeRow.collection || null;
  },

  /**
   * Copy text to clipboard
   */
  copyToClipboard(text: string): void {
    try {
      const clipboard = Components.classes['@mozilla.org/widget/clipboardhelper;1']
        .getService(Components.interfaces.nsIClipboardHelper);
      clipboard.copyString(text);
    } catch (e) {
      Zotero.debug(`ZutiloRE: Clipboard error: ${e}`);
    }
  },

  /**
   * Show notification
   */
  showNotification(title: string, message: string): void {
    try {
      const alertsService = Components.classes['@mozilla.org/alerts-service;1']
        .getService(Components.interfaces.nsIAlertsService);
      alertsService.showAlertNotification(null, title, message, false, '', null);
    } catch (e) {
      Zotero.debug(`ZutiloRE: ${title} - ${message}`);
    }
  },

  /**
   * Destroy the plugin
   */
  destroy(): void {
    Zotero.debug('ZutiloRE: Destroying...');
    this.initialized = false;
  },

  /**
   * Development reload function
   */
  devReload(): string {
    Zotero.debug('ZutiloRE: Development reload triggered');
    return 'Reload initiated';
  },
};

// Expose to Zotero global
if (typeof Zotero !== 'undefined') {
  (Zotero as any).zutiloRE = zutiloRE;
}

// Export for hooks
export { zutiloRE, onStartup, onShutdown };