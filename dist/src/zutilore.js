"use strict";
var zutiloRE = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/index.ts
  var index_exports = {};
  __export(index_exports, {
    onShutdown: () => onShutdown,
    onStartup: () => onStartup,
    zutiloRE: () => zutiloRE
  });

  // src/hooks.ts
  async function onStartup() {
    Zotero.debug("ZutiloRE: onStartup called");
    try {
      await Zotero.initializationPromise;
      Zotero.debug("ZutiloRE: Zotero initialized");
      await zutiloRE.init();
      for (const win of Zotero.getMainWindows()) {
        await onMainWindowLoad(win);
      }
      Zotero.debug("ZutiloRE: Startup complete");
    } catch (e) {
      Zotero.debug(`ZutiloRE: Startup error - ${e}`);
      throw e;
    }
  }
  async function onMainWindowLoad(win) {
    Zotero.debug("ZutiloRE: onMainWindowLoad called");
    try {
      if (win.document.readyState !== "complete") {
        await new Promise((resolve) => {
          win.document.addEventListener("readystatechange", () => {
            if (win.document.readyState === "complete") {
              resolve();
            }
          });
        });
      }
      Zotero.debug("ZutiloRE: Window ready");
    } catch (e) {
      Zotero.debug(`ZutiloRE: Window load error - ${e}`);
    }
  }
  function onShutdown() {
    Zotero.debug("ZutiloRE: onShutdown called");
    try {
      if (zutiloRE && zutiloRE.destroy) {
        zutiloRE.destroy();
      }
      try {
        Components.classes["@mozilla.org/intl/stringbundle;1"].getService(Components.interfaces.nsIStringBundleService).flushBundles();
      } catch (e) {
      }
      Zotero.debug("ZutiloRE: Shutdown complete");
    } catch (e) {
      Zotero.debug(`ZutiloRE: Shutdown error - ${e}`);
    }
  }

  // src/modules/main.ts
  function getSelectedItems() {
    const zoteroPane = Zotero.getActiveZoteroPane();
    if (!zoteroPane) return [];
    return zoteroPane.getSelectedItems();
  }
  function getSelectedCollection() {
    const zoteroPane = Zotero.getActiveZoteroPane();
    if (!zoteroPane) return null;
    const collectionTreeRow = zoteroPane.getCollectionTreeRow();
    if (!collectionTreeRow || !collectionTreeRow.isCollection()) return null;
    return collectionTreeRow.ref || collectionTreeRow.collection || null;
  }
  function copyToClipboard(text) {
    try {
      const clipboard = Components.classes["@mozilla.org/widget/clipboardhelper;1"].getService(Components.interfaces.nsIClipboardHelper);
      clipboard.copyString(text);
    } catch (e) {
      Zotero.debug(`ZutiloRE: Clipboard error - ${e}`);
    }
  }
  function showNotification(title, message) {
    try {
      const alertsService = Components.classes["@mozilla.org/alerts-service;1"].getService(Components.interfaces.nsIAlertsService);
      alertsService.showAlertNotification(null, title, message, false, "", null);
    } catch (e) {
      Zotero.debug(`ZutiloRE: ${title} - ${message}`);
    }
  }
  function registerMenus(win) {
    try {
      const doc = win.document;
      Zotero.debug("ZutiloRE: registerMenus called");
      const itemMenu = doc.getElementById("zotero-itemmenu");
      Zotero.debug("ZutiloRE: itemMenu found: " + !!itemMenu);
      if (itemMenu) {
        addItemMenuItems(itemMenu);
      }
      const collectionMenu = doc.getElementById("zotero-collectionmenu");
      Zotero.debug("ZutiloRE: collectionMenu found: " + !!collectionMenu);
      if (collectionMenu) {
        addCollectionMenuItems(collectionMenu);
      }
      Zotero.debug("ZutiloRE: Menus registered");
    } catch (e) {
      Zotero.debug(`ZutiloRE: Error registering menus - ${e}`);
    }
  }
  function addItemMenuItems(itemMenu) {
    const doc = itemMenu.ownerDocument;
    if (doc.getElementById("zutilore-itemmenu-separator")) {
      return;
    }
    const separator = doc.createXULElement("menuseparator");
    separator.id = "zutilore-itemmenu-separator";
    itemMenu.appendChild(separator);
    const items = [
      { id: "zutilore-copy-tags", label: "Copy Tags to Clipboard" },
      { id: "zutilore-paste-tags", label: "Paste Tags from Clipboard" },
      { id: "zutilore-remove-tags", label: "Remove All Tags" },
      { id: "zutilore-relate-items", label: "Relate Items" },
      { id: "zutilore-copy-select-link", label: "Copy Select Link" },
      { id: "zutilore-copy-item-id", label: "Copy Item ID" },
      { id: "zutilore-copy-item-uri", label: "Copy Zotero URI" }
    ];
    for (const item of items) {
      const menuitem = doc.createXULElement("menuitem");
      menuitem.id = item.id;
      menuitem.setAttribute("label", item.label);
      menuitem.setAttribute("oncommand", `Zotero.zutiloRE.handleMenuCommand('${item.id}')`);
      itemMenu.appendChild(menuitem);
    }
  }
  function addCollectionMenuItems(collectionMenu) {
    const doc = collectionMenu.ownerDocument;
    if (doc.getElementById("zutilore-collectionmenu-separator")) {
      return;
    }
    const separator = doc.createXULElement("menuseparator");
    separator.id = "zutilore-collectionmenu-separator";
    collectionMenu.appendChild(separator);
    const items = [
      { id: "zutilore-copy-collection-link", label: "Copy Collection Link" },
      { id: "zutilore-copy-collection-path", label: "Copy Collection Path" }
    ];
    for (const item of items) {
      const menuitem = doc.createXULElement("menuitem");
      menuitem.id = item.id;
      menuitem.setAttribute("label", item.label);
      menuitem.setAttribute("oncommand", `Zotero.zutiloRE.handleMenuCommand('${item.id}')`);
      collectionMenu.appendChild(menuitem);
    }
  }

  // src/modules/tags.ts
  var copiedTags = [];
  function copyTags() {
    const items = getSelectedItems();
    if (!items.length) return;
    const allTags = /* @__PURE__ */ new Set();
    for (const item of items) {
      const tags = item.getTags();
      for (const tagObj of tags) {
        allTags.add(tagObj.tag);
      }
    }
    const tagString = Array.from(allTags).join("\n");
    copyToClipboard(tagString);
    copiedTags = Array.from(allTags);
    showNotification("Tags Copied", `Copied ${allTags.size} unique tags`);
  }
  async function pasteTags() {
    if (!copiedTags || !copiedTags.length) {
      showNotification("Error", "No tags copied. Use Copy Tags first.");
      return;
    }
    const items = getSelectedItems();
    if (!items.length) {
      showNotification("Error", "No items selected");
      return;
    }
    for (const item of items) {
      for (const tag of copiedTags) {
        item.addTag(tag);
      }
      await item.saveTx();
    }
    showNotification("Tags Pasted", `Added ${copiedTags.length} tags to ${items.length} items`);
  }
  async function removeTags() {
    const items = getSelectedItems();
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
    showNotification("Tags Removed", `Removed all tags from ${items.length} items`);
  }

  // src/modules/items.ts
  async function relateItems() {
    const items = getSelectedItems();
    if (items.length < 2) {
      showNotification("Error", "Select at least 2 items to relate");
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
    showNotification("Items Related", `Related ${items.length} items to each other`);
  }
  function copyZoteroSelectLink() {
    const items = getSelectedItems();
    if (!items.length) {
      showNotification("Error", "No items selected");
      return;
    }
    const links = [];
    for (const item of items) {
      const libraryType = Zotero.Libraries.get(item.libraryID).libraryType;
      let path;
      switch (libraryType) {
        case "group":
          path = Zotero.URI.getLibraryPath(item.libraryID);
          break;
        case "user":
        default:
          path = "library";
          break;
      }
      links.push(`zotero://select/${path}/items/${item.key}`);
    }
    copyToClipboard(links.join("\r\n"));
    showNotification("Links Copied", `Copied ${links.length} select link(s)`);
  }
  function copyZoteroItemID() {
    const items = getSelectedItems();
    if (!items.length) {
      showNotification("Error", "No items selected");
      return;
    }
    const ids = items.map((item) => item.key);
    copyToClipboard(ids.join("\r\n"));
    showNotification("IDs Copied", `Copied ${ids.length} item ID(s)`);
  }
  function copyZoteroItemURI() {
    const items = getSelectedItems();
    if (!items.length) {
      showNotification("Error", "No items selected");
      return;
    }
    let username = null;
    try {
      if (Zotero.Users && Zotero.Users.getCurrentUsername) {
        username = Zotero.Users.getCurrentUsername();
      }
    } catch (e) {
    }
    const uris = [];
    for (const item of items) {
      const uri = Zotero.URI.getItemURI(item);
      const match = uri.match(/http:\/\/zotero\.org\/(users\/(\d+)|groups\/(\d+))\/items\/(.+)/);
      if (match) {
        const isGroup = match[3] !== void 0;
        const itemKey = match[4];
        if (isGroup) {
          const groupID = match[3];
          uris.push(`https://www.zotero.org/groups/${groupID}/items/${itemKey}`);
        } else {
          if (username) {
            uris.push(`https://www.zotero.org/${username}/items/${itemKey}`);
          } else {
            const userID = match[2];
            uris.push(`https://www.zotero.org/users/${userID}/items/${itemKey}`);
          }
        }
        continue;
      }
      const match2 = uri.match(/zotero:\/\/([^/]+)\/items\/(.+)/);
      if (match2) {
        const libraryID = match2[1];
        const itemKey = match2[2];
        if (libraryID.startsWith("groups/")) {
          const groupID = libraryID.replace("groups/", "");
          uris.push(`https://www.zotero.org/groups/${groupID}/items/${itemKey}`);
        } else {
          if (username) {
            uris.push(`https://www.zotero.org/${username}/items/${itemKey}`);
          } else {
            uris.push("https://www.zotero.org/users/USER_ID/items/" + itemKey);
          }
        }
        continue;
      }
      const match3 = uri.match(/zotero:\/\/select\/(.+)/);
      if (match3) {
        const selectPath = match3[1];
        if (selectPath.includes("/items/")) {
          const parts = selectPath.split("/items/");
          if (parts.length === 2) {
            const libPath = parts[0];
            const key = parts[1];
            if (libPath.startsWith("groups/")) {
              const groupID = libPath.replace("groups/", "");
              uris.push(`https://www.zotero.org/groups/${groupID}/items/${key}`);
            } else if (username) {
              uris.push(`https://www.zotero.org/${username}/items/${key}`);
            } else {
              uris.push("https://www.zotero.org/users/USER_ID/items/" + key);
            }
          }
        }
      }
    }
    copyToClipboard(uris.join("\r\n"));
    showNotification("URIs Copied", `Copied ${uris.length} Zotero URI(s)`);
  }

  // src/modules/collections.ts
  function copyCollectionLink() {
    const collection = getSelectedCollection();
    if (!collection) return;
    const libraryID = collection.libraryID;
    const key = collection.key;
    const uri = `zotero://select/library/${libraryID}/collections/${key}`;
    copyToClipboard(uri);
    showNotification("Link Copied", "Collection link copied to clipboard");
  }
  function copyCollectionPath() {
    const collection = getSelectedCollection();
    if (!collection) return;
    const parts = [];
    let current = collection;
    while (current) {
      parts.unshift(current.name);
      if (!current.parentID) break;
      current = Zotero.Collections.get(current.parentID);
    }
    const fullPath = parts.join(" / ");
    copyToClipboard(fullPath);
    showNotification("Path Copied", fullPath);
  }

  // src/modules/creation.ts
  async function createBookFromSection() {
    const items = getSelectedItems();
    if (items.length !== 1) {
      showNotification("Error", "Select exactly 1 book section");
      return;
    }
    const section = items[0];
    if (section.itemTypeID !== Zotero.ItemTypes.getID("bookSection")) {
      showNotification("Error", "Selected item is not a book section");
      return;
    }
    const book = new Zotero.Item("book");
    const fieldsToCopy = ["title", "publisher", "place", "date", "ISBN", "language"];
    for (const field of fieldsToCopy) {
      const value = section.getField(field);
      if (value) {
        book.setField(field, value);
      }
    }
    const creators = section.getCreators();
    for (const creator of creators) {
      book.addCreator(creator);
    }
    const bookID = await book.saveTx();
    section.addRelatedItem(book);
    await section.saveTx();
    showNotification("Book Created", "New book item created from section");
    const zoteroPane = Zotero.getActiveZoteroPane();
    if (zoteroPane) {
      zoteroPane.selectItem(bookID);
    }
  }
  async function createSectionFromBook() {
    const items = getSelectedItems();
    if (items.length !== 1) {
      showNotification("Error", "Select exactly 1 book");
      return;
    }
    const book = items[0];
    if (book.itemTypeID !== Zotero.ItemTypes.getID("book")) {
      showNotification("Error", "Selected item is not a book");
      return;
    }
    const section = new Zotero.Item("bookSection");
    const fieldsToCopy = ["title", "publisher", "place", "date", "ISBN", "language"];
    for (const field of fieldsToCopy) {
      const value = book.getField(field);
      if (value) {
        section.setField(field, value);
      }
    }
    const creators = book.getCreators();
    for (const creator of creators) {
      section.addCreator(creator);
    }
    const title = prompt("Enter chapter/section title:");
    if (title) {
      section.setField("title", title);
    }
    const sectionID = await section.saveTx();
    section.addRelatedItem(book);
    await section.saveTx();
    showNotification("Section Created", "New book section created");
    const zoteroPane = Zotero.getActiveZoteroPane();
    if (zoteroPane) {
      zoteroPane.selectItem(sectionID);
    }
  }

  // src/index.ts
  var zutiloRE = {
    initialized: false,
    // Expose registerMenus for bootstrap.js call
    registerMenus,
    /**
     * Initialize the plugin
     */
    async init() {
      Zotero.debug("ZutiloRE: init() called");
      await Promise.all([
        Zotero.initializationPromise,
        Zotero.unlockPromise,
        Zotero.uiReadyPromise
      ]);
      for (const win of Zotero.getMainWindows()) {
        await this.onWindowLoad(win);
      }
      this.initialized = true;
      Zotero.debug("ZutiloRE: Initialized successfully");
    },
    /**
     * Called when a main window loads
     */
    async onWindowLoad(win) {
      Zotero.debug("ZutiloRE: onWindowLoad called");
      await new Promise((resolve) => {
        if (win.document.readyState === "complete") {
          resolve();
        } else {
          win.document.addEventListener("readystatechange", () => {
            if (win.document.readyState === "complete") {
              resolve();
            }
          });
        }
      });
      Zotero.debug("ZutiloRE: Window ready, calling registerMenus");
      registerMenus(win);
    },
    /**
     * Handle menu commands
     */
    handleMenuCommand(commandId) {
      switch (commandId) {
        case "zutilore-copy-tags":
          copyTags();
          break;
        case "zutilore-paste-tags":
          pasteTags();
          break;
        case "zutilore-remove-tags":
          removeTags();
          break;
        case "zutilore-relate-items":
          relateItems();
          break;
        case "zutilore-copy-collection-link":
          copyCollectionLink();
          break;
        case "zutilore-copy-collection-path":
          copyCollectionPath();
          break;
        case "zutilore-copy-select-link":
          copyZoteroSelectLink();
          break;
        case "zutilore-copy-item-id":
          copyZoteroItemID();
          break;
        case "zutilore-copy-item-uri":
          copyZoteroItemURI();
          break;
        case "zutilore-create-book-from-section":
          createBookFromSection();
          break;
        case "zutilore-create-section-from-book":
          createSectionFromBook();
          break;
      }
    },
    /**
     * Get selected items from active window
     */
    getSelectedItems() {
      const zoteroPane = Zotero.getActiveZoteroPane();
      if (!zoteroPane) return [];
      return zoteroPane.getSelectedItems();
    },
    /**
     * Get selected collection
     */
    getSelectedCollection() {
      const zoteroPane = Zotero.getActiveZoteroPane();
      if (!zoteroPane) return null;
      const collectionTreeRow = zoteroPane.getCollectionTreeRow();
      if (!collectionTreeRow || !collectionTreeRow.isCollection()) return null;
      return collectionTreeRow.ref || collectionTreeRow.collection || null;
    },
    /**
     * Copy text to clipboard
     */
    copyToClipboard(text) {
      try {
        const clipboard = Components.classes["@mozilla.org/widget/clipboardhelper;1"].getService(Components.interfaces.nsIClipboardHelper);
        clipboard.copyString(text);
      } catch (e) {
        Zotero.debug(`ZutiloRE: Clipboard error: ${e}`);
      }
    },
    /**
     * Show notification
     */
    showNotification(title, message) {
      try {
        const alertsService = Components.classes["@mozilla.org/alerts-service;1"].getService(Components.interfaces.nsIAlertsService);
        alertsService.showAlertNotification(null, title, message, false, "", null);
      } catch (e) {
        Zotero.debug(`ZutiloRE: ${title} - ${message}`);
      }
    },
    /**
     * Destroy the plugin
     */
    destroy() {
      Zotero.debug("ZutiloRE: Destroying...");
      this.initialized = false;
    },
    /**
     * Development reload function
     */
    devReload() {
      Zotero.debug("ZutiloRE: Development reload triggered");
      return "Reload initiated";
    }
  };
  if (typeof Zotero !== "undefined") {
    Zotero.zutiloRE = zutiloRE;
  }
  return __toCommonJS(index_exports);
})();
//# sourceMappingURL=zutilore.js.map
