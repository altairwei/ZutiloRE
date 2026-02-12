/**
 * ZutiloRE - Main Module
 * Zotero 8 Utility Plugin
 */

var zutiloRE = {
  initialized: false,
  windows: new Set(),

  log: function(msg) {
    dump("ZutiloRE: " + msg + "\n");
    if (typeof Zotero !== 'undefined' && Zotero.debug) {
      Zotero.debug("ZutiloRE: " + msg);
    }
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
      { id: "zutilore-relate-items", label: "Relate Items" }
    ];

    var self = this;
    items.forEach(function(item) {
      var menuitem = doc.createXULElement("menuitem");
      menuitem.id = item.id;
      menuitem.setAttribute("label", item.label);
      menuitem.setAttribute("oncommand", "zutiloRE.handleMenuCommand('" + item.id + "')");
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
    menuitem.setAttribute("oncommand", "zutiloRE.handleMenuCommand('zutilore-copy-collection-link')");
    collectionMenu.appendChild(menuitem);
  },

  handleMenuCommand: function(commandId) {
    dump("ZutiloRE: handleMenuCommand called: " + commandId + "\n");
    var self = this;
    switch (commandId) {
      case "zutilore-copy-tags":
        dump("ZutiloRE: Executing copyTags\n");
        this.copyTags();
        break;
      case "zutilore-paste-tags":
        dump("ZutiloRE: Executing pasteTags\n");
        this.pasteTags().catch(function(e) {
          dump("ZutiloRE: Error in pasteTags: " + e + "\n");
        });
        break;
      case "zutilore-remove-tags":
        dump("ZutiloRE: Executing removeTags\n");
        this.removeTags().catch(function(e) {
          dump("ZutiloRE: Error in removeTags: " + e + "\n");
        });
        break;
      case "zutilore-relate-items":
        dump("ZutiloRE: Executing relateItems\n");
        this.relateItems().catch(function(e) {
          dump("ZutiloRE: Error in relateItems: " + e + "\n");
        });
        break;
      case "zutilore-copy-collection-link":
        dump("ZutiloRE: Executing copyCollectionLink\n");
        this.copyCollectionLink();
        break;
      default:
        dump("ZutiloRE: Unknown command: " + commandId + "\n");
    }
  },

  copyTags: function() {
    dump("ZutiloRE: copyTags() started\n");
    var items = this.getSelectedItems();
    dump("ZutiloRE: Selected items: " + items.length + "\n");
    if (!items.length) {
      dump("ZutiloRE: No items selected\n");
      return;
    }

    var allTags = new Set();
    items.forEach(function(item) {
      var tags = item.getTags();
      tags.forEach(function(tag) {
        allTags.add(tag.tag);
      });
    });

    var tagString = Array.from(allTags).join("\n");
    dump("ZutiloRE: Copying tags: " + tagString + "\n");
    this.copyToClipboard(tagString);
    this.showNotification("Tags Copied", "Copied " + allTags.size + " unique tags");
    dump("ZutiloRE: copyTags() completed\n");
  },

  pasteTags: async function() {
    this.log("pasteTags() started");
    
    var tagString = this.pasteFromClipboard();
    this.log("Pasted from clipboard: '" + tagString + "'");
    
    if (!tagString || !tagString.trim()) {
      this.log("Clipboard empty, showing error");
      this.showNotification("Error", "Clipboard is empty or no text found");
      return;
    }

    var tags = tagString.split(/[\n,;]/).map(function(t) {
      return t.trim();
    }).filter(function(t) {
      return t;
    });

    this.log("Parsed tags: " + tags.join(", "));

    if (tags.length === 0) {
      this.showNotification("Error", "No valid tags found in clipboard");
      return;
    }

    var items = this.getSelectedItems();
    this.log("Selected items: " + items.length);
    
    if (!items.length) {
      this.showNotification("Error", "No items selected");
      return;
    }

    this.log("Starting to add tags...");
    for (var i = 0; i < items.length; i++) {
      for (var j = 0; j < tags.length; j++) {
        items[i].addTag(tags[j]);
      }
      await items[i].saveTx();
    }

    this.showNotification("Tags Pasted", "Added " + tags.length + " tags to " + items.length + " items");
    this.log("pasteTags() completed");
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

    return collectionTreeRow.getObject();
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
      var strLen = {};
      trans.getTransferData("text/unicode", str, strLen);
      
      if (str.value) {
        var result = str.value.QueryInterface(Components.interfaces.nsISupportsString).data;
        this.log("Clipboard content: '" + result + "'");
        return result;
      }
      return "";
    } catch (e) {
      this.log("Error reading clipboard: " + e);
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
