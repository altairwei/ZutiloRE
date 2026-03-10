/**
 * ZutiloRE - Metadata Update Module
 * Fetch and update item metadata from public data sources (Crossref, PubMed, etc.)
 * using Zotero's built-in Translate.Search API (same as "Add Item by Identifier").
 * Opens a field-level merge dialog so users can choose which fields to update.
 */

import { getSelectedItems, showNotification } from './main';

/** Fields eligible for metadata update (excludes user-specific data) */
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
 * Preprocess URL to extract identifiers that Zotero's Translate.Search can't handle directly.
 * Returns extracted identifier or null if not matched.
 */
function preprocessURL(url: string): Record<string, string> | null {
  try {
    // PMC (PubMed Central) - e.g., https://pmc.ncbi.nlm.nih.gov/articles/PMC10814449/
    // PMC IDs are NOT the same as PMID. Translate.Search can't handle PMC IDs directly.
    // Return null to trigger Translate.Web fallback instead.
    const pmcMatch = url.match(/pmc\.ncbi\.nlm\.nih\.gov\/articles\/(PMC\d+)/i);
    if (pmcMatch) {
      Zotero.debug(`ZutiloRE: Detected PMC URL, will use web translation: ${pmcMatch[1]}`);
      return null;  // Fall through to web translation
    }

    // arXiv preprint - e.g., https://arxiv.org/abs/xxxx.xxxxx
    const arxivMatch = url.match(/arxiv\.org\/abs\/([^\/\?]+)/i);
    if (arxivMatch) {
      return { arXiv: arxivMatch[1] };
    }

    // DOI from various domains
    const doiMatch = url.match(/(?:doi\.org\/|doi\.org\/abs\/|dx\.doi\.org\/)([^\/\?]+)/i);
    if (doiMatch) {
      return { DOI: doiMatch[1] };
    }

    // PubMed - e.g., https://pubmed.ncbi.nlm.nih.gov/12345678/
    const pubmedMatch = url.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/i);
    if (pubmedMatch) {
      return { PMID: pubmedMatch[1] };
    }

    // ISBN from various book retailer URLs
    const isbnMatch = url.match(/(?:isbn|isbn13|asin)=?(\d{10,13})/i);
    if (isbnMatch) {
      return { ISBN: isbnMatch[1] };
    }
  } catch (_e) {
    // Ignore parsing errors
  }

  return null;
}

/**
 * Build an identifier object for Zotero.Translate.Search from an item.
 * Priority: DOI → ISBN → identifiers extracted from URL → identifiers extracted from Extra.
 * Supports DOI, ISBN, arXiv, and PMID.
 */
function buildIdentifier(item: ZoteroItem): Record<string, string> | null {
  const doi = extractDOI(item);
  if (doi) return { DOI: doi };

  const isbn = extractISBN(item);
  if (isbn) return { ISBN: isbn };

  // First: try Zotero's built-in extraction (handles many cases)
  for (const field of ['url', 'extra']) {
    try {
      const value = item.getField(field);
      if (!value) continue;
      const found = Zotero.Utilities.extractIdentifiers(value.toString());
      if (found.length > 0) {
        const id = found[0];
        if (id.DOI) return { DOI: id.DOI };
        if (id.arXiv) return { arXiv: id.arXiv };
        if (id.PMID) return { PMID: id.PMID };
        if (id.ISBN) return { ISBN: id.ISBN };
      }
    } catch (_e) {
      // Field may not exist for this item type
    }
  }

  // Second: try our custom URL preprocessing for sites that Zotero doesn't handle
  for (const field of ['url', 'extra']) {
    try {
      const value = item.getField(field);
      if (!value) continue;
      const extracted = preprocessURL(value.toString());
      if (extracted) {
        Zotero.debug(`ZutiloRE: Extracted identifier from URL: ${JSON.stringify(extracted)}`);
        return extracted;
      }
    } catch (_e) {
      // Ignore
    }
  }

  return null;
}

/**
 * Fetch metadata for a given identifier using Zotero.Translate.Search.
 * If that fails, optionally try Zotero.Translate.Web with a URL as fallback.
 * Returns translated item JSON (not saved to library).
 */
async function fetchMetadata(identifier: Record<string, string>, fallbackURL?: string): Promise<any | null> {
  // First try: Translate.Search with identifier (skip if identifier is empty)
  const hasIdentifier = Object.keys(identifier).length > 0;

  if (hasIdentifier) {
    const translate = new Zotero.Translate.Search();
    translate.setIdentifier(identifier);

    const translators = await translate.getTranslators();
    if (translators.length) {
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
        Zotero.debug(`ZutiloRE: Translate.Search error - ${e}`);
      }
    }
  } else {
    Zotero.debug(`ZutiloRE: No identifier provided, skipping Translate.Search`);
  }

  // Fallback: Try Translate.Web with URL if available
  if (fallbackURL) {
    Zotero.debug(`ZutiloRE: Search failed, trying web translation for ${fallbackURL}`);
    try {
      const webTranslate = new Zotero.Translate.Web();
      webTranslate.setURI(fallbackURL);

      const webTranslators = await webTranslate.getTranslators();
      if (webTranslators.length) {
        webTranslate.setTranslator(webTranslators);

        const webResults = await webTranslate.translate({
          libraryID: false,
          saveAttachments: false,
        });

        if (webResults && webResults.length > 0) {
          Zotero.debug(`ZutiloRE: Web translation succeeded`);
          return webResults[0];
        }
      }
    } catch (e) {
      Zotero.debug(`ZutiloRE: Translate.Web error - ${e}`);
    }

    // Try PMC-specific API as last resort
    const pmcMatch = fallbackURL?.match(/pmc\.ncbi\.nlm\.nih\.gov\/articles\/(PMC\d+)/i);
    if (pmcMatch) {
      Zotero.debug(`ZutiloRE: Trying NCBI API for PMC ${pmcMatch[1]}`);
      const pmcData = await fetchPMCMetadata(pmcMatch[1]);
      if (pmcData) {
        return pmcData;
      }
    }
  }

  return null;
}

/**
 * Fetch metadata for PMC article using NCBI E-utilities API.
 * This is a fallback when Translate.Search fails for PMC URLs.
 */
async function fetchPMCMetadata(pmcId: string): Promise<any | null> {
  try {
    // Use NCBI E-utilities to fetch article metadata
    const pmcNum = pmcId.replace('PMC', '');
    const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pmc&id=${pmcNum}&retmode=json`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`NCBI API returned ${response.status}`);
    }

    const data = await response.json();
    const result = data.result?.[pmcNum];

    if (!result) {
      throw new Error('No data returned from NCBI');
    }

    // Extract DOI from articleids (best option)
    const doi = result.articleids?.find((id: any) => id.idtype === 'doi')?.value;
    if (doi) {
      Zotero.debug(`ZutiloRE: Found DOI ${doi} for PMC ${pmcId}, fetching via Translate.Search`);
      const doiData = await fetchMetadata({ DOI: doi });
      if (doiData) {
        return doiData;
      }
    }

    // Fallback: try PMID
    const pubmedId = result.articleids?.find((id: any) => id.idtype === 'pmid')?.value;
    if (pubmedId) {
      Zotero.debug(`ZutiloRE: Found PMID ${pubmedId} for PMC ${pmcId}, fetching via Translate.Search`);
      const pubmedData = await fetchMetadata({ PMID: pubmedId.toString() });
      if (pubmedData) {
        return pubmedData;
      }
    }

    // Last resort: construct basic metadata from PMC data
    Zotero.debug(`ZutiloRE: No DOI/PMID found, constructing basic metadata from PMC data`);
    const authors = result.authors || [];
    const creators = authors.map((author: any) => {
      const name = author.name || author;
      const parts = (typeof name === 'string' ? name : '').split(' ');
      return {
        firstName: parts.slice(0, -1).join(' '),
        lastName: parts.pop() || '',
        creatorTypeID: 1, // author
      };
    });

    return {
      title: result.title || '',
      creators: creators,
      date: result.pubdate || '',
      publicationTitle: result.source || '',
      volume: result.volume || '',
      issue: result.issue || '',
      pages: result.pages || '',
      DOI: result.doi || '',
      url: `https://www.ncbi.nlm.nih.gov/pmc/articles/${pmcId}/`,
    };
  } catch (e) {
    Zotero.debug(`ZutiloRE: PMC fetch error - ${e}`);
    return null;
  }
}

/**
 * Check if there are any field differences between an item and fetched metadata.
 */
function hasFieldDifferences(item: ZoteroItem, fetchedData: any): boolean {
  for (const field of METADATA_FIELDS) {
    try {
      const currentVal = item.getField(field)?.toString() || '';
      const fetchedVal = fetchedData[field]?.toString() || '';
      if (fetchedVal && currentVal !== fetchedVal) {
        return true;
      }
    } catch (_e) {
      // Field not valid for this item type
    }
  }

  // Also check creators
  if (fetchedData.creators && Array.isArray(fetchedData.creators) && fetchedData.creators.length > 0) {
    const existingCreators = item.getCreators();
    if (existingCreators.length !== fetchedData.creators.length) {
      return true;
    }
    for (let i = 0; i < existingCreators.length; i++) {
      const a = existingCreators[i];
      const b = fetchedData.creators[i];
      if (!a || !b) return true;
      if ((a.firstName || '') !== (b.firstName || '') ||
          (a.lastName || '') !== (b.lastName || '') ||
          (a.name || '') !== (b.name || '')) {
        return true;
      }
    }
  }

  return false;
}

interface MergeResult {
  fields: Record<string, string>;
  updateCreators: boolean;
  creators: any[] | null;
}

/**
 * Open the field-level merge dialog for a single item.
 * Returns the merge result if the user clicked Apply, or null if cancelled.
 */
function openMergeDialog(item: ZoteroItem, fetchedData: any): MergeResult | null {
  const io: any = {
    dataIn: {
      item: item,
      fetchedData: fetchedData,
    },
    dataOut: null,
  };

  const win = (Zotero as any).getMainWindow() || Zotero.getMainWindows()[0];
  win.openDialog(
    'chrome://zutilore/content/updateMerge.xhtml',
    '',
    'chrome,dialog,modal,centerscreen,resizable',
    io
  );

  return io.dataOut as MergeResult | null;
}

/**
 * Apply the merge result to an item.
 */
function applyMergeResult(item: ZoteroItem, result: MergeResult): boolean {
  let updated = false;

  // Apply selected field changes
  for (const [field, value] of Object.entries(result.fields)) {
    try {
      item.setField(field, value);
      updated = true;
    } catch (_e) {
      // Field may not be valid for this item type
    }
  }

  // Apply creators if opted in
  if (result.updateCreators && result.creators) {
    item.setCreators(result.creators);
    updated = true;
  }

  return updated;
}

/**
 * Update metadata for selected items from public data sources.
 * Opens a field-level merge dialog for each item with differences,
 * allowing users to choose which fields to update.
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
  let skipCount = 0;
  let lastError = '';

  for (const item of regularItems) {
    // Get URL first - we'll use it for web translation as fallback
    let itemURL = '';
    try {
      itemURL = item.getField('url')?.toString() || '';
    } catch (_e) { /* ignore */ }

    const identifier = buildIdentifier(item);

    // If no identifier but we have a URL, we'll try web translation directly
    // Only fail if there's absolutely no way to get metadata
    if (!identifier && !itemURL) {
      noIdCount++;
      const title = item.getField('title')?.toString() || item.key;
      showNotification('No Identifier', `Item "${title.substring(0, 50)}" has no DOI/ISBN/PMID or URL`);
      Zotero.debug(`ZutiloRE: No identifier or URL found for item ${item.key}`);
      continue;
    }

    // If we have URL but no identifier, prepare for web translation
    let useWebOnly = !identifier && !!itemURL;
    if (useWebOnly) {
      Zotero.debug(`ZutiloRE: No standard identifier, will try web translation for ${itemURL}`);
    }

    const idStr = identifier ? (identifier.DOI || identifier.ISBN || identifier.arXiv || identifier.PMID) : '(web only)';
    Zotero.debug(`ZutiloRE: Fetching metadata for ${idStr}`);

    try {
      // If using web only, pass empty identifier - fetchMetadata will skip search and use web directly
      const metadata = await fetchMetadata(identifier || {}, useWebOnly ? itemURL : itemURL || undefined);
      if (metadata) {
        // Check if there are any differences
        if (!hasFieldDifferences(item, metadata)) {
          Zotero.debug(`ZutiloRE: No differences found for item ${item.key}`);
          successCount++;
          continue;
        }

        // Open merge dialog for user to select fields
        const result = openMergeDialog(item, metadata);
        if (result) {
          const updated = applyMergeResult(item, result);
          if (updated) {
            await item.saveTx();
            successCount++;
            showNotification('Updated', `Metadata updated for "${item.getField('title')?.toString().substring(0, 30) || item.key}"`);
            Zotero.debug(`ZutiloRE: Updated metadata for item ${item.key}`);
          } else {
            Zotero.debug(`ZutiloRE: No changes applied for item ${item.key}`);
            successCount++;
          }
        } else {
          skipCount++;
          Zotero.debug(`ZutiloRE: User cancelled merge for item ${item.key}`);
        }
      } else {
        failCount++;
        lastError = `No metadata found for ${idStr}`;
        showNotification('Not Found', `No metadata found for identifier: ${idStr}`);
        Zotero.debug(`ZutiloRE: No metadata found for ${idStr}`);
      }
    } catch (e) {
      failCount++;
      lastError = e.toString();
      showNotification('Error', `Failed to update: ${e.toString()}`);
      Zotero.debug(`ZutiloRE: Error updating item ${item.key}: ${e}`);
    }
  }

  // Build result summary message (only if multiple items processed)
  if (regularItems.length > 1) {
    const parts: string[] = [];
    if (successCount > 0) parts.push(`${successCount} updated`);
    if (skipCount > 0) parts.push(`${skipCount} skipped`);
    if (failCount > 0) parts.push(`${failCount} failed`);
    if (noIdCount > 0) parts.push(`${noIdCount} no identifier`);

    const message = parts.join(', ');
    if (message) {
      showNotification('Update Metadata', message);
    }
  }
}
