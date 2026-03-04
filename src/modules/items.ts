/**
 * ZutiloRE - Items Module
 * Item operations: relate items, copy links, copy IDs
 */

import { getSelectedItems, copyToClipboard, showNotification } from './main';

/**
 * Relate selected items to each other
 */
export async function relateItems(): Promise<void> {
  const items = getSelectedItems();
  if (items.length < 2) {
    showNotification('Error', 'Select at least 2 items to relate');
    return;
  }

  // Relate each item to every other item
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      items[i].addRelatedItem(items[j]);
      items[j].addRelatedItem(items[i]);
    }
  }

  // Save all items
  for (const item of items) {
    await item.saveTx();
  }

  showNotification('Items Related', `Related ${items.length} items to each other`);
}

/**
 * Copy zotero://select links for selected items
 */
export function copyZoteroSelectLink(): void {
  const items = getSelectedItems();
  if (!items.length) {
    showNotification('Error', 'No items selected');
    return;
  }

  const links: string[] = [];
  for (const item of items) {
    const libraryType = Zotero.Libraries.get(item.libraryID).libraryType;
    let path: string;

    switch (libraryType) {
      case 'group':
        path = Zotero.URI.getLibraryPath(item.libraryID);
        break;
      case 'user':
      default:
        path = 'library';
        break;
    }

    links.push(`zotero://select/${path}/items/${item.key}`);
  }

  copyToClipboard(links.join('\r\n'));
  showNotification('Links Copied', `Copied ${links.length} select link(s)`);
}

/**
 * Copy item keys (IDs) for selected items
 */
export function copyZoteroItemID(): void {
  const items = getSelectedItems();
  if (!items.length) {
    showNotification('Error', 'No items selected');
    return;
  }

  const ids = items.map((item) => item.key);
  copyToClipboard(ids.join('\r\n'));
  showNotification('IDs Copied', `Copied ${ids.length} item ID(s)`);
}

/**
 * Copy Zotero web URIs for selected items
 */
export function copyZoteroItemURI(): void {
  const items = getSelectedItems();
  if (!items.length) {
    showNotification('Error', 'No items selected');
    return;
  }

  // Try to get current username
  let username: string | null = null;
  try {
    if (Zotero.Users && Zotero.Users.getCurrentUsername) {
      username = Zotero.Users.getCurrentUsername();
    }
  } catch (e) {
    // Ignore and continue
  }

  const uris: string[] = [];
  for (const item of items) {
    const uri = Zotero.URI.getItemURI(item);

    // Pattern 1: http://zotero.org/users/USERID/items/KEY
    const match = uri.match(/http:\/\/zotero\.org\/(users\/(\d+)|groups\/(\d+))\/items\/(.+)/);
    if (match) {
      const isGroup = match[3] !== undefined;
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

    // Pattern 2: zotero://library/items/KEY
    const match2 = uri.match(/zotero:\/\/([^/]+)\/items\/(.+)/);
    if (match2) {
      const libraryID = match2[1];
      const itemKey = match2[2];
      if (libraryID.startsWith('groups/')) {
        const groupID = libraryID.replace('groups/', '');
        uris.push(`https://www.zotero.org/groups/${groupID}/items/${itemKey}`);
      } else {
        if (username) {
          uris.push(`https://www.zotero.org/${username}/items/${itemKey}`);
        } else {
          uris.push('https://www.zotero.org/users/USER_ID/items/' + itemKey);
        }
      }
      continue;
    }

    // Pattern 3: zotero://select/ format
    const match3 = uri.match(/zotero:\/\/select\/(.+)/);
    if (match3) {
      const selectPath = match3[1];
      if (selectPath.includes('/items/')) {
        const parts = selectPath.split('/items/');
        if (parts.length === 2) {
          const libPath = parts[0];
          const key = parts[1];
          if (libPath.startsWith('groups/')) {
            const groupID = libPath.replace('groups/', '');
            uris.push(`https://www.zotero.org/groups/${groupID}/items/${key}`);
          } else if (username) {
            uris.push(`https://www.zotero.org/${username}/items/${key}`);
          } else {
            uris.push('https://www.zotero.org/users/USER_ID/items/' + key);
          }
        }
      }
    }
  }

  copyToClipboard(uris.join('\r\n'));
  showNotification('URIs Copied', `Copied ${uris.length} Zotero URI(s)`);
}

/**
 * Get all attachments from selected items
 * Includes both file attachments and URL attachments
 */
function getSelectedAttachments(): ZoteroItem[] {
  const items = getSelectedItems();
  const attachments: ZoteroItem[] = [];

  for (const item of items) {
    // Get child attachments
    const children = item.getAttachments();
    if (children && children.length > 0) {
      for (const childID of children) {
        const child = Zotero.Items.get(childID);
        if (child && child.isAttachment()) {
          attachments.push(child);
        }
      }
    }
    // Also check if the item itself is an attachment
    if (item.isAttachment()) {
      attachments.push(item);
    }
  }

  return attachments;
}

/**
 * Copy attachment file paths to clipboard
 */
export function copyAttachmentPaths(): void {
  const attachments = getSelectedAttachments();

  if (!attachments.length) {
    showNotification('Error', 'No attachments found in selected items');
    return;
  }

  const paths: string[] = [];
  for (const attachment of attachments) {
    // Get file path for file attachments
    const filePath = attachment.getFilePath();
    if (filePath) {
      paths.push(filePath);
    }
  }

  if (paths.length === 0) {
    showNotification('Error', 'No file paths found for attachments');
    return;
  }

  copyToClipboard(paths.join('\r\n'));
  showNotification('Paths Copied', `Copied ${paths.length} attachment path(s)`);
}

/**
 * Copy creators (authors) to clipboard
 * Format: "lastName\tfirstName" per line, unique values only
 */
export function copyCreators(): void {
  const items = getSelectedItems();

  if (!items.length) {
    showNotification('Error', 'No items selected');
    return;
  }

  const creatorsSet = new Set<string>();

  for (const item of items) {
    const creators = item.getCreators();
    for (const creator of creators) {
      const creatorStr = `${creator.lastName}\t${creator.firstName}`;
      creatorsSet.add(creatorStr);
    }
  }

  if (creatorsSet.size === 0) {
    showNotification('Error', 'No creators found');
    return;
  }

  const creatorText = Array.from(creatorsSet).join('\r\n');
  copyToClipboard(creatorText);
  showNotification('Creators Copied', `Copied ${creatorsSet.size} creator(s)`);
}