/**
 * ZutiloRE Preferences
 */

document.addEventListener('DOMContentLoaded', function() {
    initQuickCopyMenus();
    initShortcuts();
});

function initQuickCopyMenus() {
    // Populate QuickCopy format menus
    const formats = Zotero.QuickCopy.getFormats();
    
    ['zutilore-quickcopy-alt1-menupopup', 'zutilore-quickcopy-alt2-menupopup'].forEach(id => {
        const popup = document.getElementById(id);
        if (!popup) return;
        
        // Add default option
        const defaultItem = document.createXULElement('menuitem');
        defaultItem.setAttribute('label', 'Default');
        defaultItem.setAttribute('value', '');
        popup.appendChild(defaultItem);
        
        // Add formats
        formats.forEach(format => {
            const item = document.createXULElement('menuitem');
            item.setAttribute('label', format.name);
            item.setAttribute('value', format.id);
            popup.appendChild(item);
        });
    });
}

function initShortcuts() {
    // Initialize keyboard shortcut configuration
    const container = document.getElementById('zutilore-shortcuts-container');
    if (!container) return;
    
    const shortcuts = [
        { id: 'copyTags', label: 'Copy Tags' },
        { id: 'pasteTags', label: 'Paste Tags' },
        { id: 'removeTags', label: 'Remove Tags' },
        { id: 'relateItems', label: 'Relate Items' },
        { id: 'copyItemFields', label: 'Copy Item Fields' },
        { id: 'pasteItemFields', label: 'Paste Item Fields' },
        { id: 'quickCopyAlt1', label: 'QuickCopy Alt 1' },
        { id: 'quickCopyAlt2', label: 'QuickCopy Alt 2' }
    ];
    
    shortcuts.forEach(shortcut => {
        const hbox = document.createXULElement('hbox');
        hbox.setAttribute('align', 'center');
        hbox.setAttribute('class', 'zutilore-shortcut-row');
        
        const label = document.createXULElement('label');
        label.setAttribute('value', shortcut.label + ':');
        label.setAttribute('style', 'width: 150px;');
        
        const textbox = document.createXULElement('textbox');
        textbox.setAttribute('preference', `extensions.zutilore.shortcut.${shortcut.id}`);
        textbox.setAttribute('placeholder', 'e.g., Ctrl+Alt+T');
        
        hbox.appendChild(label);
        hbox.appendChild(textbox);
        container.appendChild(hbox);
    });
}
