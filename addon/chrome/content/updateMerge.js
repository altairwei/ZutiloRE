/**
 * ZutiloRE - Update Metadata Merge Dialog
 * Field-level merge UI using Zotero's built-in info-box in fieldmerge mode.
 * Loaded by updateMerge.xhtml in a modal dialog window.
 */

/* globals Zotero, window, document */

var ZutiloRE_MergeDialog = new function () {
	var _io = null;
	var _itembox = null;
	var _existingItem = null;
	var _fetchedData = null;
	var _hasCreatorDifferences = false;

	/** Fields eligible for metadata update (excludes user-specific data) */
	var METADATA_FIELDS = [
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

	this.init = function () {
		_io = window.arguments[0];
		if (_io.wrappedJSObject) {
			_io = _io.wrappedJSObject;
		}

		_existingItem = _io.dataIn.item;
		_fetchedData = _io.dataIn.fetchedData;

		_itembox = document.getElementById('merge-info-box');

		// Build field alternatives: { fieldName: [currentVal, fetchedVal] }
		var alternatives = {};
		var hasDifferences = false;

		for (var field of METADATA_FIELDS) {
			try {
				var currentVal = _existingItem.getField(field);
				currentVal = (currentVal !== undefined && currentVal !== null)
					? currentVal.toString() : '';
			}
			catch (e) {
				continue; // Field not valid for this item type
			}

			var fetchedVal = _fetchedData[field];
			if (fetchedVal === undefined || fetchedVal === null) {
				continue;
			}
			fetchedVal = fetchedVal.toString();

			if (fetchedVal && currentVal !== fetchedVal) {
				alternatives[field] = [currentVal, fetchedVal];
				hasDifferences = true;
			}
		}

		if (!hasDifferences) {
			// No field differences — close dialog and report no changes
			_io.dataOut = null;
			window.close();
			return;
		}

		// Check for creator differences
		_hasCreatorDifferences = _checkCreatorDifferences();
		if (_hasCreatorDifferences) {
			var creatorsRow = document.getElementById('creators-row');
			creatorsRow.hidden = false;
		}

		// Set up the info-box in fieldmerge mode
		var displayItem = _existingItem.clone();

		_itembox.open = true; // Required: render() checks _section.open
		_itembox.mode = 'fieldmerge';
		_itembox.hiddenFields = ['dateAdded', 'dateModified', 'accessDate'];
		_itembox.fieldAlternatives = alternatives;
		_itembox.item = displayItem;
		_itembox._forceRenderAll();

		// Set dialog title with item info
		var title = _existingItem.getField('title');
		if (title) {
			var titleStr = title.toString();
			if (titleStr.length > 80) {
				titleStr = titleStr.substring(0, 77) + '...';
			}
			document.title = 'Update Metadata - ' + titleStr;
		}

		// Resize window to fit content
		window.sizeToContent();
	};

	this.onApply = function () {
		// Get the modified item data from info-box
		var mergedItem = _itembox.item;

		// Collect only fields that differ from the original
		var updatedFields = {};
		for (var field of METADATA_FIELDS) {
			try {
				var originalVal = _existingItem.getField(field);
				originalVal = (originalVal !== undefined && originalVal !== null)
					? originalVal.toString() : '';
				var mergedVal = mergedItem.getField(field);
				mergedVal = (mergedVal !== undefined && mergedVal !== null)
					? mergedVal.toString() : '';

				if (originalVal !== mergedVal) {
					updatedFields[field] = mergedVal;
				}
			}
			catch (e) {
				// Skip invalid fields
			}
		}

		var updateCreators = false;
		if (_hasCreatorDifferences) {
			var checkbox = document.getElementById('update-creators');
			updateCreators = checkbox.checked;
		}

		_io.dataOut = {
			fields: updatedFields,
			updateCreators: updateCreators,
			creators: updateCreators ? _fetchedData.creators : null,
		};

		window.close();
	};

	this.onCancel = function () {
		_io.dataOut = null;
		window.close();
	};

	function _checkCreatorDifferences() {
		if (!_fetchedData.creators || !Array.isArray(_fetchedData.creators)
			|| _fetchedData.creators.length === 0) {
			return false;
		}

		var existingCreators = _existingItem.getCreators();
		var fetchedCreators = _fetchedData.creators;

		// Quick length check
		if (existingCreators.length !== fetchedCreators.length) {
			return true;
		}

		// Compare each creator
		for (var i = 0; i < existingCreators.length; i++) {
			var a = existingCreators[i];
			var b = fetchedCreators[i];
			if (!a || !b) return true;

			var aFirst = a.firstName || '';
			var aLast = a.lastName || '';
			var aName = a.name || '';
			var bFirst = b.firstName || '';
			var bLast = b.lastName || '';
			var bName = b.name || '';

			if (aFirst !== bFirst || aLast !== bLast || aName !== bName) {
				return true;
			}
		}

		return false;
	}
};
