/**
 * ZutiloRE - Main Module
 * Zotero 8 Utility Plugin
 */

var zutiloRE = {
  initialized: false,

  log: function(msg) {
    if (typeof Zotero !== 'undefined' && Zotero.debug) {
      Zotero.debug("ZutiloRE: " + msg);
    }
  },

  init: async function() {
    this.log("init() called");

    await Promise.all([
      Zotero.initializationPromise,
      Zotero.unlockPromise,
      Zotero.uiReadyPromise
    ]);

    this.registerMenus();

    this.initialized = true;
    this.log("init() completed");
  },

  registerMenus: function() {
    this.log("Registering menus via MenuManager");

    // Register item menu (右键文献菜单)
    Zotero.MenuManager.registerMenu({
      menuID: "zutilore-itemmenu",
      pluginID: "zutilore@altairwei.github.io",
      target: "main/library/item",
      menus: [
        {
          menuType: "menuitem",
          label: "Copy Tags to Clipboard",
          onCommand: (event, context) => {
            this.log("Copy Tags clicked");
            this.copyTags(context.items);
          }
        },
        {
          menuType: "menuitem",
          label: "Paste Tags from Clipboard",
          onCommand: (event, context) => {
            this.log("Paste Tags clicked");
            this.pasteTags(context.items);
          }
        },
        {
          menuType: "menuitem",
          label: "Remove All Tags",
          onCommand: (event, context) => {
            this.log("Remove Tags clicked");
            this.removeTags(context.items);
          }
        },
        {
          menuType: "menuitem",
          label: "Relate Items",
          onCommand: (event, context) => {
            this.log("Relate Items clicked");
            this.relateItems(context.items);
          }
        }
      ]
    });

    // Register collection menu (右键集合菜单)
    Zotero.MenuManager.registerMenu({
      menuID: "zutilore-collectionmenu",
      pluginID: "zutilore@altairwei.github.io",
      target: "main/library/collection",
      menus: [
        {
          menuType: "menuitem",
          label: "Copy Collection Link",
          onCommand: (event, context) => {
            this.log("Copy Collection Link clicked");
            this.copyCollectionLink(context.collection);
          }
        }
      ]
    });

    this.log("Menus registered");
  },

  copyTags: function(items) {
    if (!items || !items.length) {
      this.showNotification("Error", "No items selected");
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
    this.copyToClipboard(tagString);
    this.showNotification("Tags Copied", "Copied " + allTags.size + " unique tags");
  },

  pasteTags: async function(items) {
    if (!items || !items.length) {
      this.showNotification("Error", "No items selected");
      return;
    }

    var tagString = this.pasteFromClipboard();
    this.log("Pasted from clipboard: '" + tagString + "'");

    if (!tagString || !tagString.trim()) {
      this.showNotification("Error", "Clipboard is empty");
      return;
    }

    var tags = tagString.split(/[\n,;]/).map(function(t) {
      return t.trim();
    }).filter(function(t) {
      return t;
    });

    this.log("Parsed tags: " + tags.join(", "));

    if (tags.length === 0) {
      this.showNotification("Error", "No valid tags found");
      return;
    }

    for (var i = 0; i < items.length; i++) {
      for (var j = 0; j < tags.length; j++) {
        items[i].addTag(tags[j]);
      }
      await items[i].saveTx();
    }

    this.showNotification("Tags Pasted", "Added " + tags.length + " tags to " + items.length + " items");
  },

  removeTags: async function(items) {
    if (!items || !items.length) {
      this.showNotification("Error", "No items selected");
      return;
    }

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

  relateItems: async function(items) {
    if (!items || items.length < 2) {
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

  copyCollectionLink: function(collection) {
    if (!collection) {
      this.showNotification("Error", "No collection selected");
      return;
    }

    var libraryID = collection.libraryID;
    var key = collection.key;
    var uri = "zotero://select/library/" + libraryID + "/collections/" + key;

    this.copyToClipboard(uri);
    this.showNotification("Link Copied", "Collection link copied to clipboard");
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
      this.log(title + " - " + message);
    }
  },

  destroy: function() {
    this.log("Destroying...");
    this.initialized = false;
  }
};
