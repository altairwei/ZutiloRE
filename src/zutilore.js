/**
 * ZutiloRE - Main Module
 * Zotero 8 Utility Plugin
 */

var zutiloRE = {
  initialized: false,
  windows: new Set(),
  copiedTags: [], // Internal storage for tags

  log: function(msg) {
    dump("ZutiloRE: " + msg + "\n");
  },

  config: {
    showInItemMenu: true,
    showInCollectionMenu: true,
    shortcutPrefix: "ZutiloRE: "
  },

  init: async function() {
    this.log("init() called");

    await Promise.all([
      Zotero.initializationPromise,
      Zotero.unlockPromise,
      Zotero.uiReadyPromise
    ]);

    await Promise.all(
      Zotero.getMainWindows().map(function(win) {
        return this.onWindowLoad(win);
      }.bind(this))
    );

    this.initialized = true;
    this.log("init() completed");
  },

  onWindowLoad: async function(window) {
    if (this.windows.has(window)) {
      return;
    }
    this.windows.add(window);

    await new Promise(function(resolve) {
      if (window.document.readyState === "complete") {
        resolve();
      } else {
        window.document.addEventListener("readystatechange", function() {
          if (window.document.readyState === "complete") {
            resolve();
          }
        });
      }
    });

    this.registerMenus(window);
  },

  registerMenus: function(window) {
    try {
      var doc = window.document;

      var itemMenu = doc.getElementById("zotero-itemmenu");
      if (itemMenu) {
        this.addItemMenuItems(itemMenu);
      }

      var collectionMenu = doc.getElementById("zotero-collectionmenu");
      if (collectionMenu) {
        this.addCollectionMenuItems(collectionMenu);
      }

      this.log("Menus registered");
    } catch (e) {
      this.log("Error registering menus: " + e);
    }
  },

  addItemMenuItems: function(itemMenu) {
    var doc = itemMenu.ownerDocument;

    // Check if already added
    if (doc.getElementById("zutilore-itemmenu-separator")) {
      return;
    }

    var separator = doc.createXULElement("menuseparator");
    separator.id = "zutilore-itemmenu-separator";
    itemMenu.appendChild(separator);

    var items = [
      { id: "zutilore-copy-tags", label: "Copy Tags to Clipboard" },
      { id: "zutilore-paste-tags", label: "Paste Tags from Clipboard" },
      { id: "zutilore-remove-tags", label: "Remove All Tags" },
      { id: "zutilore-relate-items", label: "Relate Items" },
      { id: "zutilore-copy-select-link", label: "Copy Select Link" },
      { id: "zutilore-copy-item-id", label: "Copy Item ID" },
      { id: "zutilore-copy-item-uri", label: "Copy Zotero URI" }
    ];

    var self = this;
    items.forEach(function(item) {
      var menuitem = doc.createXULElement("menuitem");
      menuitem.id = item.id;
      menuitem.setAttribute("label", item.label);
      menuitem.setAttribute("oncommand", "Zotero.zutiloRE.handleMenuCommand('" + item.id + "')");
      itemMenu.appendChild(menuitem);
    });
  },

  addCollectionMenuItems: function(collectionMenu) {
    var doc = collectionMenu.ownerDocument;

    // Check if already added
    if (doc.getElementById("zutilore-collectionmenu-separator")) {
      return;
    }

    var separator = doc.createXULElement("menuseparator");
    separator.id = "zutilore-collectionmenu-separator";
    collectionMenu.appendChild(separator);

    var menuitem = doc.createXULElement("menuitem");
    menuitem.id = "zutilore-copy-collection-link";
    menuitem.setAttribute("label", "Copy Collection Link");
    menuitem.setAttribute("oncommand", "Zotero.zutiloRE.handleMenuCommand('zutilore-copy-collection-link')");
    collectionMenu.appendChild(menuitem);
  },

  handleMenuCommand: function(commandId) {
    switch (commandId) {
      case "zutilore-copy-tags":
        this.copyTags();
        break;
      case "zutilore-paste-tags":
        this.pasteTags();
        break;
      case "zutilore-remove-tags":
        this.removeTags();
        break;
      case "zutilore-relate-items":
        this.relateItems();
        break;
      case "zutilore-copy-collection-link":
        this.copyCollectionLink();
        break;
      case "zutilore-copy-select-link":
        this.copyZoteroSelectLink();
        break;
      case "zutilore-copy-item-id":
        this.copyZoteroItemID();
        break;
      case "zutilore-copy-item-uri":
        this.copyZoteroItemURI();
        break;
    }
  },

  copyTags: function() {
    var items = this.getSelectedItems();
    if (!items.length) return;

    var allTags = new Set();
    items.forEach(function(item) {
      var tags = item.getTags();
      tags.forEach(function(tag) {
        allTags.add(tag.tag);
      });
    });

    var tagString = Array.from(allTags).join("\n");
    
    // 1. Copy to system clipboard (original functionality)
    this.copyToClipboard(tagString);
    
    // 2. Store internally for pasteTags
    this.copiedTags = Array.from(allTags);
    
    this.showNotification("Tags Copied", "Copied " + allTags.size + " unique tags");
  },

  pasteTags: async function() {
    // Use internal storage instead of clipboard
    if (!this.copiedTags || !this.copiedTags.length) {
      this.showNotification("Error", "No tags copied. Use Copy Tags first.");
      return;
    }

    var items = this.getSelectedItems();
    if (!items.length) {
      this.showNotification("Error", "No items selected");
      return;
    }

    for (var i = 0; i < items.length; i++) {
      for (var j = 0; j < this.copiedTags.length; j++) {
        items[i].addTag(this.copiedTags[j]);
      }
      await items[i].saveTx();
    }

    this.showNotification("Tags Pasted", "Added " + this.copiedTags.length + " tags to " + items.length + " items");
  },

  removeTags: async function() {
    var items = this.getSelectedItems();
    if (!items.length) return;

    var confirmed = Services.prompt.confirm(
      null,
      "Remove All Tags",
      "Remove all tags from " + items.length + " items?"
    );
    if (!confirmed) return;

    for (var i = 0; i < items.length; i++) {
      items[i].setTags([]);
      await items[i].saveTx();
    }

    this.showNotification("Tags Removed", "Removed all tags from " + items.length + " items");
  },

  relateItems: async function() {
    var items = this.getSelectedItems();
    if (items.length < 2) {
      this.showNotification("Error", "Select at least 2 items to relate");
      return;
    }

    for (var i = 0; i < items.length; i++) {
      for (var j = i + 1; j < items.length; j++) {
        items[i].addRelatedItem(items[j]);
        items[j].addRelatedItem(items[i]);
      }
    }

    for (var i = 0; i < items.length; i++) {
      await items[i].saveTx();
    }

    this.showNotification("Items Related", "Related " + items.length + " items to each other");
  },

  copyCollectionLink: function() {
    var collection = this.getSelectedCollection();
    if (!collection) return;

    var libraryID = collection.libraryID;
    var key = collection.key;
    var uri = "zotero://select/library/" + libraryID + "/collections/" + key;

    this.copyToClipboard(uri);
    this.showNotification("Link Copied", "Collection link copied to clipboard");
  },

  getSelectedItems: function() {
    var zoteroPane = Zotero.getActiveZoteroPane();
    if (!zoteroPane) return [];
    return zoteroPane.getSelectedItems();
  },

  getSelectedCollection: function() {
    var zoteroPane = Zotero.getActiveZoteroPane();
    if (!zoteroPane) return null;

    var collectionTreeRow = zoteroPane.getCollectionTreeRow();
    if (!collectionTreeRow || !collectionTreeRow.isCollection()) return null;

    // Zotero 8 uses .ref property instead of getObject()
    return collectionTreeRow.ref || collectionTreeRow.collection || null;
  },

  copyZoteroSelectLink: function() {
    var items = this.getSelectedItems();
    if (!items.length) {
      this.showNotification("Error", "No items selected");
      return;
    }

    var links = [];
    for (var i = 0; i < items.length; i++) {
      var libraryType = Zotero.Libraries.get(items[i].libraryID).libraryType;
      var path;
      
      switch (libraryType) {
        case 'group':
          path = Zotero.URI.getLibraryPath(items[i].libraryID);
          break;
        case 'user':
        default:
          path = 'library';
          break;
      }
      
      links.push('zotero://select/' + path + '/items/' + items[i].key);
    }

    var clipboardText = links.join('\r\n');
    this.copyToClipboard(clipboardText);
    this.showNotification("Links Copied", "Copied " + links.length + " select link(s)");
  },

  copyZoteroItemID: function() {
    var items = this.getSelectedItems();
    if (!items.length) {
      this.showNotification("Error", "No items selected");
      return;
    }

    var ids = [];
    for (var i = 0; i < items.length; i++) {
      ids.push(items[i].key);
    }

    var clipboardText = ids.join('\r\n');
    this.copyToClipboard(clipboardText);
    this.showNotification("IDs Copied", "Copied " + ids.length + " item ID(s)");
  },

  copyZoteroItemURI: function() {
    var items = this.getSelectedItems();
    if (!items.length) {
      this.showNotification("Error", "No items selected");
      return;
    }

    // 使用 notification 显示调试信息
    var debugInfo = "Debug: Processing " + items.length + " items\n";
    
    var uris = [];
    for (var i = 0; i < items.length; i++) {
      var uri = Zotero.URI.getItemURI(items[i]);
      debugInfo += "Item " + (i+1) + " URI: " + uri + "\n";
      
      // Try different patterns to match Zotero URI
      // Pattern 1: http://zotero.org/users/USERID/items/KEY (web format)
      var match = uri.match(/http:\/\/zotero\.org\/(users\/\d+|groups\/\d+)\/items\/(.+)/);
      if (match) {
        debugInfo += "  -> Matched pattern 1 (web format)\n";
        var libraryPath = match[1];
        var itemKey = match[2];
        if (libraryPath.startsWith('groups/')) {
          var groupID = libraryPath.replace('groups/', '');
          uris.push('https://www.zotero.org/groups/' + groupID + '/items/' + itemKey);
        } else {
          // User library - already has user ID
          var userID = libraryPath.replace('users/', '');
          uris.push('https://www.zotero.org/users/' + userID + '/items/' + itemKey);
        }
      } else {
        // Pattern 2: zotero://library/items/KEY (local format)
        var match2 = uri.match(/zotero:\/\/([^/]+)\/items\/(.+)/);
        if (match2) {
          debugInfo += "  -> Matched pattern 2 (local format)\n";
          var libraryID = match2[1];
          var itemKey = match2[2];
          if (libraryID.startsWith('groups/')) {
            var groupID = libraryID.replace('groups/', '');
            uris.push('https://www.zotero.org/groups/' + groupID + '/items/' + itemKey);
          } else {
            // User library - need user ID, use placeholder
            uris.push('https://www.zotero.org/users/USER_ID/items/' + itemKey);
          }
        } else {
          // Pattern 3: Try matching zotero://select/ format
          var match3 = uri.match(/zotero:\/\/select\/(.+)/);
          if (match3) {
            debugInfo += "  -> Matched pattern 3 (select format)\n";
            var selectPath = match3[1];
            if (selectPath.includes('/items/')) {
              var parts = selectPath.split('/items/');
              if (parts.length === 2) {
                var libPath = parts[0];
                var key = parts[1];
                if (libPath.startsWith('groups/')) {
                  var groupID = libPath.replace('groups/', '');
                  uris.push('https://www.zotero.org/groups/' + groupID + '/items/' + key);
                } else {
                  uris.push('https://www.zotero.org/users/USER_ID/items/' + key);
                }
              }
            }
          } else {
            debugInfo += "  -> No pattern matched!\n";
          }
        }
      }
    }

    debugInfo += "Generated " + uris.length + " URIs";
    
    // 先显示调试信息
    this.showNotification("Debug Info", debugInfo);
    
    // 然后复制到剪贴板
    var clipboardText = uris.join('\r\n');
    this.copyToClipboard(clipboardText);
    
    // 最后显示结果
    this.showNotification("URIs Copied", "Copied " + uris.length + " Zotero URI(s)");
  },

  copyToClipboard: function(text) {
    var clipboard = Components.classes["@mozilla.org/widget/clipboardhelper;1"]
      .getService(Components.interfaces.nsIClipboardHelper);
    clipboard.copyString(text);
  },

  pasteFromClipboard: function() {
    try {
      var clipboard = Components.classes["@mozilla.org/widget/clipboard;1"]
        .getService(Components.interfaces.nsIClipboard);
      var trans = Components.classes["@mozilla.org/widget/transferable;1"]
        .createInstance(Components.interfaces.nsITransferable);

      trans.addDataFlavor("text/unicode");
      clipboard.getData(trans, Components.interfaces.nsIClipboard.kGlobalClipboard);

      var str = {};
      try {
        trans.getTransferData("text/unicode", str);
        return str.value.QueryInterface(Components.interfaces.nsISupportsString).data;
      } catch (e) {
        return "";
      }
    } catch (e) {
      return "";
    }
  },

  showNotification: function(title, message) {
    try {
      var alertsService = Components.classes["@mozilla.org/alerts-service;1"]
        .getService(Components.interfaces.nsIAlertsService);
      alertsService.showAlertNotification(null, title, message, false, "", null);
    } catch (e) {
      dump("ZutiloRE: " + title + " - " + message + "\n");
    }
  },

  destroy: function() {
    this.log("Destroying...");
    this.initialized = false;
    this.windows.clear();
  }
};

// Expose to Zotero for oncommand access
if (typeof Zotero !== 'undefined') {
  Zotero.zutiloRE = zutiloRE;
}
