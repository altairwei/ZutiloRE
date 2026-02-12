/**
 * ZutiloRE - Collection Menu Module
 * Collection-specific operations
 */

zutiloRE.collectionOperations = {
    
    /**
     * Copy collection link to clipboard
     */
    copyCollectionLink: function() {
        const collection = this.getSelectedCollection();
        if (!collection) return;
        
        const libraryID = collection.libraryID;
        const key = collection.key;
        const uri = `zotero://select/library/${libraryID}/collections/${key}`;
        
        zutiloRE.copyToClipboard(uri);
        zutiloRE.showNotification('Link Copied', 'Collection link copied to clipboard');
    },
    
    /**
     * Copy collection as bibliography
     */
    copyCollectionBibliography: async function() {
        const collection = this.getSelectedCollection();
        if (!collection) return;
        
        const items = collection.getChildItems();
        if (!items.length) {
            zutiloRE.showNotification('Error', 'Collection is empty');
            return;
        }
        
        try {
            const formatted = await Zotero.QuickCopy.getContentFromItems(items);
            zutiloRE.copyToClipboard(formatted);
            zutiloRE.showNotification('Bibliography Copied', `Copied ${items.length} items`);
        } catch (e) {
            console.error("ZutiloRE: Bibliography copy failed", e);
            zutiloRE.showNotification('Error', 'Failed to copy bibliography');
        }
    },
    
    /**
     * Export collection metadata
     */
    exportCollectionMetadata: async function() {
        const collection = this.getSelectedCollection();
        if (!collection) return;
        
        const items = collection.getChildItems();
        const metadata = items.map(item => ({
            title: item.getField('title'),
            creators: item.getCreators().map(c => `${c.firstName} ${c.lastName}`).join(', '),
            date: item.getField('date'),
            itemType: Zotero.ItemTypes.getName(item.itemTypeID),
            key: item.key
        }));
        
        const json = JSON.stringify(metadata, null, 2);
        zutiloRE.copyToClipboard(json);
        zutiloRE.showNotification('Metadata Copied', `Exported ${items.length} items`);
    },
    
    /**
     * Get selected collection
     */
    getSelectedCollection: function() {
        const zoteroPane = Zotero.getActiveZoteroPane();
        if (!zoteroPane) return null;
        
        const collectionTreeRow = zoteroPane.getCollectionTreeRow();
        if (!collectionTreeRow || !collectionTreeRow.isCollection()) return null;
        
        return collectionTreeRow.getObject();
    }
};
