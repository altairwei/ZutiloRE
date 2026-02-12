/**
 * ZutiloRE - Main Module
 * Zotero 8 Utility Plugin
 */

// Make zutiloRE available globally
var zutiloRE = {
    initialized: false,
    rootURI: null,
    
    // Logging helper
    log: function(msg) {
        dump("ZutiloRE: " + msg + "\n");
    },
    
    // Configuration
    config: {
        showInItemMenu: true,
        showInCollectionMenu: true,
        shortcutPrefix: 'ZutiloRE: '
    },
    
    /**
     * Initialize the plugin
     */
    init: async function() {
        this.log("init() called");
        
        this.registerPreferencePane();
        this.registerItemMenu();
        this.registerCollectionMenu();
        this.registerKeyboardShortcuts();
        
        this.initialized = true;
        this.log("init() completed");
    },
    
    /**
     * Register preference pane
     */
    registerPreferencePane: function() {
        if (!Zotero.PreferencePanes) return;
        
        Zotero.PreferencePanes.register({
            pluginID: 'zutilore@altairwei.github.io',
            src: 'chrome://zutilore/content/preferences.xhtml',
            scripts: ['chrome://zutilore/content/preferences.js'],
            stylesheets: ['chrome://zutilore/content/preferences.css']
        });
    },
    
    /**
     * Register item menu items
     */
    registerItemMenu: function() {
        // Use Zotero's menu API if available
        if (Zotero.ItemMenu) {
            this._registerItemMenuModern();
        } else {
            this._registerItemMenuLegacy();
        }
    },
    
    /**
     * Modern item menu registration (Zotero 7+)
     */
    _registerItemMenuModern: function() {
        // Tag operations
        Zotero.ItemMenu.addMenuItem({
            id: 'zutilore-copy-tags',
            label: 'Copy Tags to Clipboard',
            onCommand: () => this.copyTags()
        });
        
        Zotero.ItemMenu.addMenuItem({
            id: 'zutilore-paste-tags',
            label: 'Paste Tags from Clipboard',
            onCommand: () => this.pasteTags()
        });
        
        Zotero.ItemMenu.addMenuItem({
            id: 'zutilore-remove-tags',
            label: 'Remove All Tags',
            onCommand: () => this.removeTags()
        });
        
        // Attachment operations
        Zotero.ItemMenu.addMenuItem({
            id: 'zutilore-show-attachments',
            label: 'Show Attachments',
            onCommand: () => this.showAttachments()
        });
        
        Zotero.ItemMenu.addMenuItem({
            id: 'zutilore-copy-attachment-paths',
            label: 'Copy Attachment Paths',
            onCommand: () => this.copyAttachmentPaths()
        });
        
        // Item operations
        Zotero.ItemMenu.addMenuItem({
            id: 'zutilore-relate-items',
            label: 'Relate Items',
            onCommand: () => this.relateItems()
        });
        
        Zotero.ItemMenu.addMenuItem({
            id: 'zutilore-copy-item-fields',
            label: 'Copy Item Fields',
            onCommand: () => this.copyItemFields()
        });
        
        Zotero.ItemMenu.addMenuItem({
            id: 'zutilore-paste-item-fields',
            label: 'Paste Item Fields',
            onCommand: () => this.pasteItemFields()
        });
        
        // QuickCopy variants
        Zotero.ItemMenu.addMenuItem({
            id: 'zutilore-quickcopy-alt1',
            label: 'QuickCopy (Alt 1)',
            onCommand: () => this.quickCopy(1)
        });
        
        Zotero.ItemMenu.addMenuItem({
            id: 'zutilore-quickcopy-alt2',
            label: 'QuickCopy (Alt 2)',
            onCommand: () => this.quickCopy(2)
        });
    },
    
    /**
     * Legacy item menu registration
     */
    _registerItemMenuLegacy: function() {
        // Will be implemented with direct DOM manipulation
        console.log("ZutiloRE: Legacy menu registration not yet implemented");
    },
    
    /**
     * Register collection menu items
     */
    registerCollectionMenu: function() {
        // Collection-specific operations
    },
    
    /**
     * Register keyboard shortcuts
     */
    registerKeyboardShortcuts: function() {
        // Keyboard shortcuts via Zotero's system
    },
    
    // ==================== TAG OPERATIONS ====================
    
    /**
     * Copy tags from selected items to clipboard
     */
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
    
    /**
     * Paste tags from clipboard to selected items
     */
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
    
    /**
     * Remove all tags from selected items
     */
    removeTags: async function() {
        const items = this.getSelectedItems();
        if (!items.length) return;
        
        const confirmed = confirm(`Remove all tags from ${items.length} items?`);
        if (!confirmed) return;
        
        for (const item of items) {
            item.setTags([]);
            await item.saveTx();
        }
        
        this.showNotification('Tags Removed', `Removed all tags from ${items.length} items`);
    },
    
    // ==================== ATTACHMENT OPERATIONS ====================
    
    /**
     * Show attachments in file manager
     */
    showAttachments: function() {
        const items = this.getSelectedItems();
        const paths = [];
        
        items.forEach(item => {
            if (item.isAttachment()) {
                const path = item.getFilePath();
                if (path) paths.push(path);
            } else {
                const attachments = item.getAttachments();
                attachments.forEach(attId => {
                    const att = Zotero.Items.get(attId);
                    const path = att.getFilePath();
                    if (path) paths.push(path);
                });
            }
        });
        
        // Open file manager
        paths.forEach(path => {
            try {
                const file = Zotero.File.pathToFile(path);
                file.reveal();
            } catch (e) {
                console.error("ZutiloRE: Failed to reveal file", e);
            }
        });
    },
    
    /**
     * Copy attachment paths to clipboard
     */
    copyAttachmentPaths: function() {
        const items = this.getSelectedItems();
        const paths = [];
        
        items.forEach(item => {
            if (item.isAttachment()) {
                const path = item.getFilePath();
                if (path) paths.push(path);
            } else {
                const attachments = item.getAttachments();
                attachments.forEach(attId => {
                    const att = Zotero.Items.get(attId);
                    const path = att.getFilePath();
                    if (path) paths.push(path);
                });
            }
        });
        
        this.copyToClipboard(paths.join('\n'));
        this.showNotification('Paths Copied', `Copied ${paths.length} attachment paths`);
    },
    
    // ==================== ITEM RELATIONS ====================
    
    /**
     * Relate selected items to each other
     */
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
    
    // ==================== COPY/PASTE FIELDS ====================
    
    /**
     * Copy item fields to clipboard
     */
    copyItemFields: function() {
        const items = this.getSelectedItems();
        if (items.length !== 1) {
            this.showNotification('Error', 'Select exactly 1 item to copy fields');
            return;
        }
        
        const item = items[0];
        const fields = {};
        
        // Get all visible fields
        const fieldIDs = Zotero.ItemFields.getItemTypeFields(item.itemTypeID);
        fieldIDs.forEach(fieldID => {
            const fieldName = Zotero.ItemFields.getName(fieldID);
            const value = item.getField(fieldName);
            if (value) fields[fieldName] = value;
        });
        
        // Store in global variable for paste
        this._clipboardFields = fields;
        this._clipboardItemType = item.itemTypeID;
        
        // Also copy to system clipboard as JSON
        this.copyToClipboard(JSON.stringify(fields, null, 2));
        
        this.showNotification('Fields Copied', `Copied ${Object.keys(fields).length} fields`);
    },
    
    /**
     * Paste item fields to selected items
     */
    pasteItemFields: async function(mode = 'all') {
        if (!this._clipboardFields) {
            this.showNotification('Error', 'No fields in clipboard. Copy fields first.');
            return;
        }
        
        const items = this.getSelectedItems();
        let pastedCount = 0;
        
        for (const item of items) {
            // Check item type compatibility
            if (item.itemTypeID !== this._clipboardItemType) {
                continue;
            }
            
            let fieldsToPaste = this._clipboardFields;
            
            if (mode === 'empty') {
                // Only paste to empty fields
                fieldsToPaste = {};
                Object.entries(this._clipboardFields).forEach(([key, value]) => {
                    if (!item.getField(key)) {
                        fieldsToPaste[key] = value;
                    }
                });
            } else if (mode === 'nonempty') {
                // Only paste to non-empty fields (overwrite)
                fieldsToPaste = {};
                Object.entries(this._clipboardFields).forEach(([key, value]) => {
                    if (item.getField(key)) {
                        fieldsToPaste[key] = value;
                    }
                });
            }
            
            Object.entries(fieldsToPaste).forEach(([key, value]) => {
                item.setField(key, value);
            });
            
            await item.saveTx();
            pastedCount++;
        }
        
        this.showNotification('Fields Pasted', `Pasted fields to ${pastedCount} items`);
    },
    
    // ==================== QUICKCOPY ====================
    
    /**
     * Alternative QuickCopy methods
     */
    quickCopy: async function(variant) {
        const items = this.getSelectedItems();
        if (!items.length) return;
        
        // Get the alternative QuickCopy format from preferences
        const format = Zotero.Prefs.get(`extensions.zutilore.quickcopy.alt${variant}`);
        if (!format) {
            this.showNotification('Error', `QuickCopy Alt ${variant} not configured`);
            return;
        }
        
        try {
            // Use Zotero's QuickCopy
            const formatted = await Zotero.QuickCopy.getContentFromItems(items, format);
            this.copyToClipboard(formatted);
            this.showNotification('QuickCopy', `Copied ${items.length} items (Alt ${variant})`);
        } catch (e) {
            console.error("ZutiloRE: QuickCopy failed", e);
            this.showNotification('Error', 'QuickCopy failed');
        }
    },
    
    // ==================== UTILITY METHODS ====================
    
    /**
     * Get currently selected items
     */
    getSelectedItems: function() {
        const zoteroPane = Zotero.getActiveZoteroPane();
        if (!zoteroPane) return [];
        return zoteroPane.getSelectedItems();
    },
    
    /**
     * Copy text to clipboard
     */
    copyToClipboard: function(text) {
        const clipboard = Cc["@mozilla.org/widget/clipboardhelper;1"]
            .getService(Ci.nsIClipboardHelper);
        clipboard.copyString(text);
    },
    
    /**
     * Paste text from clipboard
     */
    pasteFromClipboard: function() {
        const clipboard = Cc["@mozilla.org/widget/clipboard;1"]
            .getService(Ci.nsIClipboard);
        const trans = Cc["@mozilla.org/widget/transferable;1"]
            .createInstance(Ci.nsITransferable);
        
        trans.addDataFlavor("text/unicode");
        clipboard.getData(trans, Ci.nsIClipboard.kGlobalClipboard);
        
        let str = {};
        try {
            trans.getTransferData("text/unicode", str);
            return str.value.QueryInterface(Ci.nsISupportsString).data;
        } catch (e) {
            return '';
        }
    },
    
    /**
     * Show a notification popup
     */
    showNotification: function(title, message) {
        try {
            const alertsService = Cc["@mozilla.org/alerts-service;1"]
                .getService(Ci.nsIAlertsService);
            alertsService.showAlertNotification(null, title, message, false, '', null);
        } catch (e) {
            console.log(`ZutiloRE: ${title} - ${message}`);
        }
    },
    
    /**
     * Cleanup when plugin is disabled/uninstalled
     */
    destroy: function() {
        console.log("ZutiloRE: Destroying...");
        this.initialized = false;
    }
};

// Auto-initialize if loaded directly
if (typeof Zotero !== 'undefined') {
    zutiloRE.init();
}
