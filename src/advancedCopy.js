/**
 * ZutiloRE - Advanced Copy Module
 * Enhanced copy/paste operations
 */

zutiloRE.advancedCopy = {
    
    /**
     * Copy selected item links
     */
    copySelectItemLink: function() {
        const items = zutiloRE.getSelectedItems();
        const links = items.map(item => {
            return `zotero://select/library/${item.libraryID}/items/${item.key}`;
        });
        
        zutiloRE.copyToClipboard(links.join('\n'));
        zutiloRE.showNotification('Links Copied', `Copied ${items.length} item links`);
    },
    
    /**
     * Copy Zotero URIs
     */
    copyZoteroURI: function() {
        const items = zutiloRE.getSelectedItems();
        const uris = items.map(item => item.getDisplayTitle() + '\n' + item.uri);
        
        zutiloRE.copyToClipboard(uris.join('\n\n'));
        zutiloRE.showNotification('URIs Copied', `Copied ${items.length} URIs`);
    },
    
    /**
     * Copy creators/authors
     */
    copyCreators: function() {
        const items = zutiloRE.getSelectedItems();
        const creatorsList = [];
        
        items.forEach(item => {
            const creators = item.getCreators();
            creators.forEach(creator => {
                const name = creator.firstName ? 
                    `${creator.firstName} ${creator.lastName}` : 
                    creator.lastName;
                creatorsList.push(name);
            });
        });
        
        // Remove duplicates and sort
        const uniqueCreators = [...new Set(creatorsList)].sort();
        
        zutiloRE.copyToClipboard(uniqueCreators.join('\n'));
        zutiloRE.showNotification('Creators Copied', `Copied ${uniqueCreators.length} unique creators`);
    },
    
    /**
     * Copy item as Markdown citation
     */
    copyAsMarkdownCitation: function() {
        const items = zutiloRE.getSelectedItems();
        const citations = items.map(item => {
            const title = item.getField('title');
            const creators = item.getCreators();
            const year = item.getField('date')?.substring(0, 4);
            
            let authorText = '';
            if (creators.length > 0) {
                if (creators.length === 1) {
                    authorText = creators[0].lastName;
                } else if (creators.length === 2) {
                    authorText = `${creators[0].lastName} & ${creators[1].lastName}`;
                } else {
                    authorText = `${creators[0].lastName} et al.`;
                }
            }
            
            return `[@${authorText}${year ? year : ''}]`;
        });
        
        zutiloRE.copyToClipboard(citations.join(' '));
        zutiloRE.showNotification('Citation Copied', 'Markdown citation copied');
    },
    
    /**
     * Copy item as formatted reference
     */
    copyAsFormattedReference: async function() {
        const items = zutiloRE.getSelectedItems();
        if (!items.length) return;
        
        try {
            // Use a simple APA-like format
            const refs = items.map(item => {
                const creators = item.getCreators();
                const title = item.getField('title');
                const year = item.getField('date')?.substring(0, 4);
                const publication = item.getField('publicationTitle') || item.getField('publisher');
                
                let authorText = '';
                if (creators.length > 0) {
                    const names = creators.map(c => {
                        if (c.firstName) {
                            return `${c.lastName}, ${c.firstName.charAt(0)}.`;
                        }
                        return c.lastName;
                    });
                    authorText = names.join(', ');
                }
                
                return `${authorText} (${year}). ${title}. ${publication}.`;
            });
            
            zutiloRE.copyToClipboard(refs.join('\n\n'));
            zutiloRE.showNotification('Reference Copied', 'Formatted reference copied');
        } catch (e) {
            console.error("ZutiloRE: Reference copy failed", e);
        }
    }
};
