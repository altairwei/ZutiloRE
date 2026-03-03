/**
 * ZutiloRE - Collections Module
 * Collection operations
 */

import { getSelectedCollection, copyToClipboard, showNotification } from './main';

/**
 * Copy zotero://select link for the selected collection
 */
export function copyCollectionLink(): void {
  const collection = getSelectedCollection();
  if (!collection) return;

  const libraryID = collection.libraryID;
  const key = collection.key;
  const uri = `zotero://select/library/${libraryID}/collections/${key}`;

  copyToClipboard(uri);
  showNotification('Link Copied', 'Collection link copied to clipboard');
}