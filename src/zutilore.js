/**
 * ZutiloRE - Main Module
 * Zotero 8 Utility Plugin
 */

var zutiloRE = {
  initialized: false,
  windows: new Set(),
  
  /**
   * Initialize the plugin
   */
  init: async function() {
    dump("ZutiloRE: Initializing...\n");
    
    // Wait for all Zotero promises
    await Promise.all([
      Zotero.initializationPromise,
      Zotero.unlockPromise,
      Zotero.uiReadyPromise,
    ]);
    
    // Initialize existing windows
    await Promise.all(
      Zotero.getMainWindows().map((win) => this.onWindowLoad(win))
    );
    
    this.initialized = true;
    dump("ZutiloRE: Initialized successfully\n");
  },
  
  /**
   * Called when a main window loads
   */
  onWindowLoad: async function(window) {
    if (this.windows.has(window)) {
      return;
    }
    this.windows.add(window);
    
    // Wait for document to be ready
    await new Promise((resolve) => {
      if (window.document.readyState === "complete") {
        resolve();
      } else {
        window.document.addEventListener("readystatechange", () => {
          if (window.document.readyState === "complete") {
            resolve();
          }
        });
      }
    });
    
    // Register menus
    this.registerMenus(window);
  },
  
  /**
   * Register menus in a window
   */
  registerMenus: function(window) {
    try {
      const doc = window.document;
      
      // Register item menu popup
      const itemMenu = doc.getElementById("zotero-itemmenu");
      if (itemMenu) {
        this.addItemMenuItems(itemMenu);
      }
      
      // Register collection menu popup
      const collectionMenu = doc.getElementById("zotero-collectionmenu");
      if (collectionMenu) {
        this.addCollectionMenuItems(collectionMenu);
      }
      
      dump("ZutiloRE: Menus registered\n");
    } catch (e) {
      dump("ZutiloRE: Error registering menus: " + e + "\n");
    }
  },
  
  /**
   * Add items to the item context menu
   */
  addItemMenuItems: function(itemMenu) {
    const doc = itemMenu.ownerDocument;
    
    // Create ZutiloRE submenu or separator
    const separator = doc.createXULElement("menuseparator");
    separator.id = "zutilore-itemmenu-separator";
    itemMenu.appendChild(separator);
    
    // Add menu items
    const items = [
      { id: "zutilore-copy-tags", label: "Copy Tags to Clipboard", onCommand: () => this.copyTags() },
      { id: "zutilore-paste-tags", label: "Paste Tags from Clipboard", onCommand: () => this.pasteTags() },
      { id: "zutilore-remove-tags", label: "Remove All Tags", onCommand: () => this.removeTags() },
      { id: "zutilore-relate-items", label: "Relate Items", onCommand: () => this.relateItems() },
    ];
    
    items.forEach(item => {
      const menuitem = doc.createXULElement("menuitem");
      menuitem.id = item.id;
      menuitem.setAttribute("label", item.label);
      menuitem.addEventListener("command", item.onCommand);
      itemMenu.appendChild(menuitem);
    });
  },
  
  /**
   * Add items to the collection context menu
   */
  addCollectionMenuItems: function(collectionMenu) {
    const doc = collectionMenu.ownerDocument;
    
    const separator = doc.createXULElement("menuseparator");
    separator.id = "zutilore-collectionmenu-separator";
    collectionMenu.appendChild(separator);
    
    const items = [
      { id: "zutilore-copy-collection-link", label: "Copy Collection Link", onCommand: () => this.copyCollectionLink() },
    ];
    
    items.forEach(item => {
      const menuitem = doc.createXULElement("menuitem");
      menuitem.id = item.id;
      menuitem.setAttribute("label", item.label);
      menuitem.addEventListener("command", item.onCommand);
      collectionMenu.appendChild(menuitem);
    });
  },
  
  // ==================== TAG OPERATIONS ====================
  
  copyTags: function() {
    const items = this.getSelectedItems();
    if (!items.length) return;
    
    const allTags = new Set();
    items.forEach(item => {
      const tags = item.getTags();
      tags.forEach(tag => allTags.add(tag.tag));
    });
    
    const tagString = Array.from(allTags).join('\n');
    this.copyToClipboard(tagString);
    
    this.showNotification('Tags Copied', `Copied ${allTags.size} unique tags`);
  },
  
  pasteTags: async function() {
    const tagString = this.pasteFromClipboard();
    if (!tagString) return;
    
    const tags = tagString.split(/[\n,;]/).map(t => t.trim()).filter(t => t);
    const items = this.getSelectedItems();
    
    for (const item of items) {
      for (const tag of tags) {
        item.addTag(tag);
      }
      await item.saveTx();
    }
    
    this.showNotification('Tags Pasted', `Added ${tags.length} tags to ${items.length} items`);
  },
  
  removeTags: async function() {
    const items = this.getSelectedItems();
    if (!items.length) return;
    
    const confirmed = Services.prompt.confirm(
      null,
      "Remove All Tags",
      `Remove all tags from ${items.length} items?`
    );
    if (!confirmed) return;
    
    for (const item of items) {
      item.setTags([]);
      await item.saveTx();
    }
    
    this.showNotification('Tags Removed', `Removed all tags from ${items.length} items`);
  },
  
  // ==================== ITEM RELATIONS ====================
  
  relateItems: async function() {
    const items = this.getSelectedItems();
    if (items.length < 2) {
      this.showNotification('Error', 'Select at least 2 items to relate');
      return;
    }
    
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        items[i].addRelatedItem(items[j]);
        items[j].addRelatedItem(items[i]);
      }
    }
    
    for (const item of items) {
      await item.saveTx();
    }
    
    this.showNotification('Items Related', `Related ${items.length} items to each other`);
  },
  
  // ==================== COLLECTION OPERATIONS ====================
  
  copyCollectionLink: function() {
    const collection = this.getSelectedCollection();
    if (!collection) return;
    
    const libraryID = collection.libraryID;
    const key = collection.key;
    const uri = `zotero://select/library/${libraryID}/collections/${key}`;
    
    this.copyToClipboard(uri);
    this.showNotification('Link Copied', 'Collection link copied to clipboard');
  },
  
  // ==================== UTILITY METHODS ====================
  
  getSelectedItems: function() {
    const zoteroPane = Zotero.getActiveZoteroPane();
    if (!zoteroPane) return [];
    return zoteroPane.getSelectedItems();
  },
  
  getSelectedCollection: function() {
    const zoteroPane = Zotero.getActiveZoteroPane();
    if (!zoteroPane) return null;
    
    const collectionTreeRow = zoteroPane.getCollectionTreeRow();
    if (!collectionTreeRow || !collectionTreeRow.isCollection()) return null;
    
    return collectionTreeRow.getObject();
  },
  
  copyToClipboard: function(text) {
    const clipboard = Components.classes["@mozilla.org/widget/clipboardhelper;1"]
      .getService(Components.interfaces.nsIClipboardHelper);
    clipboard.copyString(text);
  },
  
  pasteFromClipboard: function() {
    const clipboard = Components.classes["@mozilla.org/widget/clipboard;1"]
      .getService(Components.interfaces.nsIClipboard);
    const trans = Components.classes["@mozilla.org/widget/transferable;1"]
      .createInstance(Components.interfaces.nsITransferable);
    
    trans.addDataFlavor("text/unicode");
    clipboard.getData(trans, Components.interfaces.nsIClipboard.kGlobalClipboard);
    
    let str = {};
    try {
      trans.getTransferData("text/unicode", str);
      return str.value.QueryInterface(Components.interfaces.nsISupportsString).data;
    } catch (e) {
      return '';
    }
  },
  
  showNotification: function(title, message) {
    try {
      const alertsService = Components.classes["@mozilla.org/alerts-service;1"]
        .getService(Components.interfaces.nsIAlertsService);
      alertsService.showAlertNotification(null, title, message, false, '', null);
    } catch (e) {
      dump(`ZutiloRE: ${title} - ${message}\n`);
    }
  },
  
  /**
   * Cleanup when plugin is disabled/uninstalled
   */
  destroy: function() {
    dump("ZutiloRE: Destroying...\n");
    this.initialized = false;
    this.windows.clear();
  }
};
