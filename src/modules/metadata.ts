/**
 * ZutiloRE - Metadata Update Module
 * Fetch and update item metadata from public data sources (Crossref, PubMed, etc.)
 * using Zotero's built-in Translate.Search API (same as "Add Item by Identifier").
 */

import { getSelectedItems, showNotification } from './main';

/** Fields to update from fetched metadata (excludes user-specific data) */
const METADATA_FIELDS = [
  'title',
  'abstractNote',
  'date',
  'publicationTitle',
  'volume',
  'issue',
  'pages',
  'DOI',
  'ISSN',
  'ISBN',
  'url',
  'language',
  'publisher',
  'place',
  'journalAbbreviation',
  'series',
  'seriesTitle',
  'seriesText',
  'edition',
  'section',
  'type',
  'rights',
  'archive',
  'archiveLocation',
  'callNumber',
  'numPages',
  'numberOfVolumes',
  'shortTitle',
  'conferenceName',
  'proceedingsTitle',
  'university',
  'institution',
  'reportType',
  'thesisType',
  'websiteTitle',
  'blogTitle',
  'forumTitle',
  'encyclopediaTitle',
  'dictionaryTitle',
  'programTitle',
  'network',
  'episodeNumber',
  'audioRecordingFormat',
  'videoRecordingFormat',
  'artworkMedium',
  'artworkSize',
  'runningTime',
  'scale',
  'medium',
  'system',
  'company',
  'distributor',
  'studio',
  'label',
  'genre',
  'country',
  'court',
  'legislativeBody',
  'session',
  'history',
  'legalStatus',
];

/**
 * Extract a DOI from a Zotero item.
 * Checks DOI field, URL field (doi.org links), and Extra field.
 */
function extractDOI(item: ZoteroItem): string | null {
  // 1. DOI field
  try {
    const doi = item.getField('DOI');
    if (doi) return doi.toString().trim();
  } catch (_e) {
    // Field may not exist for this item type
  }

  // 2. URL field - check for doi.org links
  try {
    const url = item.getField('url');
    if (url) {
      const urlStr = url.toString();
      const doiMatch = urlStr.match(/doi\.org\/(.+)/i);
      if (doiMatch) {
        return doiMatch[1].replace(/\/$/, '');
      }
    }
  } catch (_e) {
    // Ignore
  }

  // 3. Extra field - look for DOI: prefix
  try {
    const extra = item.getField('extra');
    if (extra) {
      const extraStr = extra.toString();
      const doiMatch = extraStr.match(/DOI:\s*(.+)/i);
      if (doiMatch) {
        return doiMatch[1].trim();
      }
    }
  } catch (_e) {
    // Ignore
  }

  return null;
}

/**
 * Extract an ISBN from a Zotero item.
 */
function extractISBN(item: ZoteroItem): string | null {
  try {
    const isbn = item.getField('ISBN');
    if (isbn) return isbn.toString().trim();
  } catch (_e) {
    // Field may not exist
  }
  return null;
}

/**
 * Build an identifier object for Zotero.Translate.Search from an item.
 * Tries DOI first, then ISBN.
 */
function buildIdentifier(item: ZoteroItem): { DOI?: string; ISBN?: string } | null {
  const doi = extractDOI(item);
  if (doi) return { DOI: doi };

  const isbn = extractISBN(item);
  if (isbn) return { ISBN: isbn };

  return null;
}

/**
 * Fetch metadata for a given identifier using Zotero.Translate.Search.
 * Returns translated item JSON (not saved to library).
 */
async function fetchMetadata(identifier: { DOI?: string; ISBN?: string }): Promise<any | null> {
  const translate = new Zotero.Translate.Search();
  translate.setIdentifier(identifier);

  const translators = await translate.getTranslators();
  if (!translators.length) {
    Zotero.debug('ZutiloRE: No translators found for identifier');
    return null;
  }

  translate.setTranslator(translators);

  try {
    const results = await translate.translate({
      libraryID: false,
      saveAttachments: false,
    });

    if (results && results.length > 0) {
      return results[0];
    }
  } catch (e) {
    Zotero.debug(`ZutiloRE: Translation error - ${e}`);
  }

  return null;
}

/**
 * Apply fetched metadata to an existing item.
 * Updates metadata fields and creators, preserves tags/notes/attachments/collections.
 */
function applyMetadata(item: ZoteroItem, data: any): boolean {
  let updated = false;

  // Update standard fields
  for (const field of METADATA_FIELDS) {
    if (data[field] !== undefined && data[field] !== null && data[field] !== '') {
      try {
        const oldValue = item.getField(field);
        const newValue = data[field].toString();
        if (oldValue !== newValue) {
          item.setField(field, newValue);
          updated = true;
        }
      } catch (_e) {
        // Field may not be valid for this item type, skip silently
      }
    }
  }

  // Update creators if available
  if (data.creators && Array.isArray(data.creators) && data.creators.length > 0) {
    item.setCreators(data.creators);
    updated = true;
  }

  return updated;
}

/**
 * Update metadata for selected items from public data sources.
 * Uses DOI or ISBN to look up metadata via Zotero's Translate.Search API.
 */
export async function updateMetadata(): Promise<void> {
  const items = getSelectedItems();
  if (!items.length) {
    showNotification('Error', 'No items selected');
    return;
  }

  // Filter out non-regular items (attachments, notes, etc.)
  const regularItems = items.filter((item) => item.isRegularItem && item.isRegularItem());
  if (!regularItems.length) {
    showNotification('Error', 'No regular items selected (attachments/notes excluded)');
    return;
  }

  let successCount = 0;
  let failCount = 0;
  let noIdCount = 0;

  for (const item of regularItems) {
    const identifier = buildIdentifier(item);
    if (!identifier) {
      noIdCount++;
      Zotero.debug(`ZutiloRE: No DOI/ISBN found for item ${item.key}`);
      continue;
    }

    const idStr = identifier.DOI || identifier.ISBN;
    Zotero.debug(`ZutiloRE: Fetching metadata for ${idStr}`);

    try {
      const metadata = await fetchMetadata(identifier);
      if (metadata) {
        const updated = applyMetadata(item, metadata);
        if (updated) {
          await item.saveTx();
          successCount++;
          Zotero.debug(`ZutiloRE: Updated metadata for item ${item.key}`);
        } else {
          Zotero.debug(`ZutiloRE: No changes needed for item ${item.key}`);
          successCount++; // Still counts as success (metadata was fetched)
        }
      } else {
        failCount++;
        Zotero.debug(`ZutiloRE: No metadata found for ${idStr}`);
      }
    } catch (e) {
      failCount++;
      Zotero.debug(`ZutiloRE: Error updating item ${item.key}: ${e}`);
    }
  }

  // Build result message
  const parts: string[] = [];
  if (successCount > 0) parts.push(`${successCount} updated`);
  if (failCount > 0) parts.push(`${failCount} failed`);
  if (noIdCount > 0) parts.push(`${noIdCount} no DOI/ISBN`);

  const message = parts.join(', ') || 'No items processed';
  showNotification('Update Metadata', message);
}
