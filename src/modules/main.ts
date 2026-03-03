/**
 * ZutiloRE - Main Module
 * Core helper functions and menu registration
 */

import type { ZoteroItem, ZoteroCollection } from '../typings';

/**
 * Get selected items from the active Zotero pane
 */
export function getSelectedItems(): ZoteroItem[] {
  const zoteroPane = Zotero.getActiveZoteroPane();
  if (!zoteroPane) return [];
  return zoteroPane.getSelectedItems() as ZoteroItem[];
}

/**
 * Get selected collection from the active Zotero pane
 */
export function getSelectedCollection(): ZoteroCollection | null {
  const zoteroPane = Zotero.getActiveZoteroPane();
  if (!zoteroPane) return null;

  const collectionTreeRow = zoteroPane.getCollectionTreeRow();
  if (!collectionTreeRow || !collectionTreeRow.isCollection()) return null;

  // Zotero 8 uses .ref property instead of getObject()
  return collectionTreeRow.ref || collectionTreeRow.collection || null;
}

/**
 * Copy text to clipboard using Zotero's clipboard helper
 */
export function copyToClipboard(text: string): void {
  try {
    const clipboard = Components.classes['@mozilla.org/widget/clipboardhelper;1']
      .getService(Components.interfaces.nsIClipboardHelper);
    clipboard.copyString(text);
  } catch (e) {
    Zotero.debug(`ZutiloRE: Clipboard error - ${e}`);
  }
}

/**
 * Read text from clipboard
 */
export function pasteFromClipboard(): string {
  try {
    const clipboard = Components.classes['@mozilla.org/widget/clipboard;1']
      .getService(Components.interfaces.nsIClipboard);
    const trans = Components.classes['@mozilla.org/widget/transferable;1']
      .createInstance(Components.interfaces.nsITransferable);

    trans.addDataFlavor('text/unicode');
    clipboard.getData(trans, Components.interfaces.nsIClipboard.kGlobalClipboard);

    const str: any = {};
    try {
      trans.getTransferData('text/unicode', str);
      return str.value.QueryInterface(Components.interfaces.nsISupportsString).data;
    } catch (e) {
      return '';
    }
  } catch (e) {
    return '';
  }
}

/**
 * Show a system notification
 */
export function showNotification(title: string, message: string): void {
  try {
    const alertsService = Components.classes['@mozilla.org/alerts-service;1']
      .getService(Components.interfaces.nsIAlertsService);
    alertsService.showAlertNotification(null, title, message, false, '', null);
  } catch (e) {
    // Fallback to console
    Zotero.debug(`ZutiloRE: ${title} - ${message}`);
  }
}

/**
 * Register context menus for items and collections
 * Called directly when window loads (menu elements exist in DOM)
 */
export function registerMenus(win: Window): void {
  try {
    const doc = win.document;
    Zotero.debug('ZutiloRE: registerMenus called');

    // Get existing menu elements
    const itemMenu = doc.getElementById('zotero-itemmenu');
    Zotero.debug('ZutiloRE: itemMenu found: ' + !!itemMenu);

    if (itemMenu) {
      addItemMenuItems(itemMenu);
    }

    const collectionMenu = doc.getElementById('zotero-collectionmenu');
    Zotero.debug('ZutiloRE: collectionMenu found: ' + !!collectionMenu);

    if (collectionMenu) {
      addCollectionMenuItems(collectionMenu);
    }

    Zotero.debug('ZutiloRE: Menus registered');
  } catch (e) {
    Zotero.debug(`ZutiloRE: Error registering menus - ${e}`);
  }
}

/**
 * Add menu items to item context menu
 */
function addItemMenuItems(itemMenu: Element): void {
  const doc = itemMenu.ownerDocument;

  // Check if already added
  if (doc.getElementById('zutilore-itemmenu-separator')) {
    return;
  }

  // Add separator
  const separator = doc.createXULElement('menuseparator');
  separator.id = 'zutilore-itemmenu-separator';
  itemMenu.appendChild(separator);

  // Menu items
  const items = [
    { id: 'zutilore-copy-tags', label: 'Copy Tags to Clipboard' },
    { id: 'zutilore-paste-tags', label: 'Paste Tags from Clipboard' },
    { id: 'zutilore-remove-tags', label: 'Remove All Tags' },
    { id: 'zutilore-relate-items', label: 'Relate Items' },
    { id: 'zutilore-copy-select-link', label: 'Copy Select Link' },
    { id: 'zutilore-copy-item-id', label: 'Copy Item ID' },
    { id: 'zutilore-copy-item-uri', label: 'Copy Zotero URI' },
  ];

  for (const item of items) {
    const menuitem = doc.createXULElement('menuitem');
    menuitem.id = item.id;
    menuitem.setAttribute('label', item.label);
    menuitem.setAttribute('oncommand', `Zotero.zutiloRE.handleMenuCommand('${item.id}')`);
    itemMenu.appendChild(menuitem);
  }
}

/**
 * Add menu items to collection context menu
 */
function addCollectionMenuItems(collectionMenu: Element): void {
  const doc = collectionMenu.ownerDocument;

  // Check if already added
  if (doc.getElementById('zutilore-collectionmenu-separator')) {
    return;
  }

  // Add separator
  const separator = doc.createXULElement('menuseparator');
  separator.id = 'zutilore-collectionmenu-separator';
  collectionMenu.appendChild(separator);

  // Add menu item
  const menuitem = doc.createXULElement('menuitem');
  menuitem.id = 'zutilore-copy-collection-link';
  menuitem.setAttribute('label', 'Copy Collection Link');
  menuitem.setAttribute('oncommand', "Zotero.zutiloRE.handleMenuCommand('zutilore-copy-collection-link')");
  collectionMenu.appendChild(menuitem);
}