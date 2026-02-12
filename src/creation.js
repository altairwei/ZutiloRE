/**
 * ZutiloRE - Item Creation Module
 * Creating items from other items
 */

zutiloRE.itemCreation = {
    
    /**
     * Create book item from book section
     */
    createBookFromSection: async function() {
        const items = zutiloRE.getSelectedItems();
        if (items.length !== 1) {
            zutiloRE.showNotification('Error', 'Select exactly 1 book section');
            return;
        }
        
        const section = items[0];
        if (section.itemTypeID !== Zotero.ItemTypes.getID('bookSection')) {
            zutiloRE.showNotification('Error', 'Selected item is not a book section');
            return;
        }
        
        // Create new book
        const book = new Zotero.Item('book');
        
        // Copy relevant fields
        const fieldsToCopy = ['title', 'publisher', 'place', 'date', 'ISBN', 'language'];
        fieldsToCopy.forEach(field => {
            const value = section.getField(field);
            if (value) book.setField(field, value);
        });
        
        // Copy creators (editors become authors for the book)
        const creators = section.getCreators();
        creators.forEach(creator => {
            book.addCreator(creator);
        });
        
        // Save the book
        const bookID = await book.saveTx();
        
        // Relate book to section
        section.addRelatedItem(book);
        await section.saveTx();
        
        zutiloRE.showNotification('Book Created', 'New book item created from section');
        
        // Select the new book
        const zoteroPane = Zotero.getActiveZoteroPane();
        if (zoteroPane) {
            zoteroPane.selectItem(bookID);
        }
    },
    
    /**
     * Create book section from book
     */
    createSectionFromBook: async function() {
        const items = zutiloRE.getSelectedItems();
        if (items.length !== 1) {
            zutiloRE.showNotification('Error', 'Select exactly 1 book');
            return;
        }
        
        const book = items[0];
        if (book.itemTypeID !== Zotero.ItemTypes.getID('book')) {
            zutiloRE.showNotification('Error', 'Selected item is not a book');
            return;
        }
        
        // Create new book section
        const section = new Zotero.Item('bookSection');
        
        // Copy relevant fields
        const fieldsToCopy = ['title', 'publisher', 'place', 'date', 'ISBN', 'language'];
        fieldsToCopy.forEach(field => {
            const value = book.getField(field);
            if (value) section.setField(field, value);
        });
        
        // Copy creators
        const creators = book.getCreators();
        creators.forEach(creator => {
            section.addCreator(creator);
        });
        
        // Prompt for section title
        const title = prompt('Enter chapter/section title:', '');
        if (title) {
            section.setField('title', title);
        }
        
        // Save the section
        const sectionID = await section.saveTx();
        
        // Relate section to book
        section.addRelatedItem(book);
        await section.saveTx();
        
        zutiloRE.showNotification('Section Created', 'New book section created');
        
        // Select the new section
        const zoteroPane = Zotero.getActiveZoteroPane();
        if (zoteroPane) {
            zoteroPane.selectItem(sectionID);
        }
    }
};
