/**
 * ZutiloRE - Tags Module
 * Tag operations: copy, paste, remove
 */

import { getSelectedItems, copyToClipboard, showNotification } from './main';

// Internal storage for tags (to avoid macOS clipboard issues)
let copiedTags: string[] = [];

/**
 * Copy tags from selected items to clipboard
 */
export function copyTags(): void {
  const items = getSelectedItems();
  if (!items.length) return;

  const allTags = new Set<string>();
  for (const item of items) {
    const tags = item.getTags();
    for (const tagObj of tags) {
      allTags.add(tagObj.tag);
    }
  }

  const tagString = Array.from(allTags).join('\n');

  // Copy to system clipboard
  copyToClipboard(tagString);

  // Store internally for paste function
  copiedTags = Array.from(allTags);

  showNotification('Tags Copied', `Copied ${allTags.size} unique tags`);
}

/**
 * Paste tags from internal storage to selected items
 */
export async function pasteTags(): Promise<void> {
  if (!copiedTags || !copiedTags.length) {
    showNotification('Error', 'No tags copied. Use Copy Tags first.');
    return;
  }

  const items = getSelectedItems();
  if (!items.length) {
    showNotification('Error', 'No items selected');
    return;
  }

  for (const item of items) {
    for (const tag of copiedTags) {
      item.addTag(tag);
    }
    await item.saveTx();
  }

  showNotification('Tags Pasted', `Added ${copiedTags.length} tags to ${items.length} items`);
}

/**
 * Remove all tags from selected items
 */
export async function removeTags(): Promise<void> {
  const items = getSelectedItems();
  if (!items.length) return;

  const confirmed = Services.prompt.confirm(
    null,
    'Remove All Tags',
    `Remove all tags from ${items.length} items?`
  );
  if (!confirmed) return;

  for (const item of items) {
    item.setTags([]);
    await item.saveTx();
  }

  showNotification('Tags Removed', `Removed all tags from ${items.length} items`);
}

/**
 * Get copied tags (for external access)
 */
export function getCopiedTags(): string[] {
  return [...copiedTags];
}

/**
 * Set copied tags (for external access)
 */
export function setCopiedTags(tags: string[]): void {
  copiedTags = [...tags];
}