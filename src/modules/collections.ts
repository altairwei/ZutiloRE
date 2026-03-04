/**
 * ZutiloRE - Collections Module
 * Collection operations
 */

import { getSelectedCollection, copyToClipboard, showNotification } from './main';
import type { ZoteroCollection } from '../../typings';

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

/**
 * Copy the full path from root to the selected collection
 * e.g. "Research / Papers / 2024"
 */
export function copyCollectionPath(): void {
  const collection = getSelectedCollection();
  if (!collection) return;

  const parts: string[] = [];
  let current: ZoteroCollection | null = collection;

  while (current) {
    parts.unshift(current.name);
    if (!current.parentID) break;
    current = Zotero.Collections.get(current.parentID);
  }

  const fullPath = parts.join(' / ');
  copyToClipboard(fullPath);
  showNotification('Path Copied', fullPath);
}