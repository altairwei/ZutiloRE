/**
 * ZutiloRE - Item Creation Module
 * Creating book items from sections and vice versa
 */

import { getSelectedItems, showNotification } from './main';

/**
 * Create a book item from a selected book section
 */
export async function createBookFromSection(): Promise<void> {
  const items = getSelectedItems();
  if (items.length !== 1) {
    showNotification('Error', 'Select exactly 1 book section');
    return;
  }

  const section = items[0];
  if (section.itemTypeID !== Zotero.ItemTypes.getID('bookSection')) {
    showNotification('Error', 'Selected item is not a book section');
    return;
  }

  // Create new book
  const book = new Zotero.Item('book') as ZoteroItem;

  // Copy relevant fields
  const fieldsToCopy = ['title', 'publisher', 'place', 'date', 'ISBN', 'language'];
  for (const field of fieldsToCopy) {
    const value = section.getField(field);
    if (value) {
      book.setField(field, value);
    }
  }

  // Copy creators
  const creators = section.getCreators();
  for (const creator of creators) {
    book.addCreator(creator);
  }

  // Save the book
  const bookID = await book.saveTx();

  // Relate book to section
  section.addRelatedItem(book);
  await section.saveTx();

  showNotification('Book Created', 'New book item created from section');

  // Select the new book
  const zoteroPane = Zotero.getActiveZoteroPane();
  if (zoteroPane) {
    zoteroPane.selectItem(bookID);
  }
}

/**
 * Create a book section from a selected book
 */
export async function createSectionFromBook(): Promise<void> {
  const items = getSelectedItems();
  if (items.length !== 1) {
    showNotification('Error', 'Select exactly 1 book');
    return;
  }

  const book = items[0];
  if (book.itemTypeID !== Zotero.ItemTypes.getID('book')) {
    showNotification('Error', 'Selected item is not a book');
    return;
  }

  // Create new book section
  const section = new Zotero.Item('bookSection') as ZoteroItem;

  // Copy relevant fields
  const fieldsToCopy = ['title', 'publisher', 'place', 'date', 'ISBN', 'language'];
  for (const field of fieldsToCopy) {
    const value = book.getField(field);
    if (value) {
      section.setField(field, value);
    }
  }

  // Copy creators
  const creators = book.getCreators();
  for (const creator of creators) {
    section.addCreator(creator);
  }

  // Prompt for section title
  const title = prompt('Enter chapter/section title:');
  if (title) {
    section.setField('title', title);
  }

  // Save the section
  const sectionID = await section.saveTx();

  // Relate section to book
  section.addRelatedItem(book);
  await section.saveTx();

  showNotification('Section Created', 'New book section created');

  // Select the new section
  const zoteroPane = Zotero.getActiveZoteroPane();
  if (zoteroPane) {
    zoteroPane.selectItem(sectionID);
  }
}