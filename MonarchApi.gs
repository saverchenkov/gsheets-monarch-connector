/**
 * @OnlyCurrentDoc
 */

// --- CONFIGURATION ---
// 1. Replace this with your deployed proxy server URL
const PROXY_SERVER_URL = 'YOUR_PROXY_SERVER_URL_HERE';

// 2. Replace this with your Monarch Money API Token
const MONARCH_TOKEN = 'YOUR_MONARCH_TOKEN_HERE';

// 3. Add the secret API key for your proxy server
const PROXY_API_KEY = 'YOUR_NEW_API_KEY_HERE';

// 4. Set the cell location for your refresh checkbox (e.g., "E1")
const REFRESH_CELL = 'E1';
// ---------------------


/**
 * A custom function that calculates the total amount of transactions from a Monarch Money search URL.
 *
 * @param {string} cellReference The cell reference (e.g., "C2") containing the HYPERLINK formula.
 * @param {string} refreshTrigger (optional) The cell reference (e.g., "C3") containing the refresh trigger cell (a checkbox that will trigger an update and recalculation)
 * @return The total amount of transactions.
 * @customfunction
 */
function GET_MONARCH_TOTAL(cellReference, refreshTrigger) {
  // Input validation
  if (typeof cellReference !== 'string' || !/^[A-Z]+[0-9]+$/i.test(cellReference)) {
    return 'Error: Input must be a cell reference in quotes, e.g., "D30".';
  }
  if (PROXY_SERVER_URL === 'YOUR_PROXY_SERVER_URL_HERE' || MONARCH_TOKEN === 'YOUR_MONARCH_TOKEN_HERE') {
    return "Error: Please set your Proxy Server URL and Monarch Token in the MonarchApi.gs script.";
  }

  // The refreshTrigger parameter is not directly used, but its presence in the formula
  // ensures that the function recalculates when the trigger cell's value changes.
  // This forces a fresh call to the API, bypassing the cache.
  let total = null;
  total = _getFromMonarchCache(`${cellReference}`);

  // Cache hit
  if (total !== undefined && refreshTrigger === undefined) {
    return total;
  }
  total = 0;

  const url = _getURLFromCell(cellReference);
  if (!url) {
    return 0; // Return 0 if no hyperlink is found, preventing errors.
  }

  const filters = _getFiltersFromUrl(url);
  const apiResponse = _callProxyServer(filters);

  if (apiResponse && apiResponse.error) {
    Logger.log("Error from proxy server: " + JSON.stringify(apiResponse));
    return "Proxy Error: " + apiResponse.error;
  }

  // Log the entire response to debug calculation issues
  Logger.log(`API Response for ${cellReference}: ${JSON.stringify(apiResponse, null, 2)}`);

  
  if (apiResponse && apiResponse.aggregates && apiResponse.aggregates[0] && apiResponse.aggregates[0].summary) {
    const summary = apiResponse.aggregates[0].summary;
    const sumExpense = summary.sumExpense || 0;
    const sumIncome = summary.sumIncome || 0;
    total = sumExpense + sumIncome;
  }

  _addToMonarchCache(`${cellReference}`, total);
  return total;
}

/**
 * Calls the local proxy server to get transaction data.
 * @private
 */
function _callProxyServer(filters) {
  const proxyUrl = PROXY_SERVER_URL + '/get-transactions';
  const payload = { filters: filters };
  const options = {
    'method': 'post',
    'contentType': 'application/json',
    'headers': {
      'Authorization': 'Token ' + MONARCH_TOKEN,
      'X-API-Key': PROXY_API_KEY
    },
    'payload': JSON.stringify(payload),
    'muteHttpExceptions': true
  };

  try {
    const response = UrlFetchApp.fetch(proxyUrl, options);
    return JSON.parse(response.getContentText());
  } catch (e) {
    Logger.log("Failed to call proxy server: " + e.toString());
    return { error: "Failed to connect to proxy server. Is it running?" };
  }
}

/**
 * Extracts the URL from a cell's HYPERLINK formula.
 * @private
 */
function _getURLFromCell(cellReference) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const cell = sheet.getRange(cellReference);
  const richText = cell.getRichTextValue();
  return richText ? richText.getLinkUrl() : null;
}

/**
 * Parses the Monarch Money URL to extract filter parameters.
 * @private
 */
function _getFiltersFromUrl(url) {
  const filters = {};
  const queryString = url.split('?')[1];
  if (queryString) {
    const pairs = queryString.split('&');
    for (const pair of pairs) {
      const [key, value] = pair.split('=');
      const decodedKey = decodeURIComponent(key);
      const decodedValue = decodeURIComponent(value || '');
      
      if (decodedKey === 'categories' || decodedKey === 'tags') {
        filters[decodedKey] = decodedValue.split(',');
      } else {
        filters[decodedKey] = decodedValue;
      }
    }
  }
  return filters;
}

/**
 * A custom function that returns the name of the current sheet.
 * @return The name of the active sheet.
 * @customfunction
 */
function getSheetName() {
  return SpreadsheetApp.getActiveSpreadsheet().getActiveSheet().getName();
}

/**
 * Adds a cache key to a centralized registry for the active sheet.
 * @private
 */
function _addToMonarchCache(key, value) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const cache = CacheService.getScriptCache();
  const registryKey = `monarch_${sheet.getName()}`;

  const sheetCacheJson = cache.get(registryKey);
  let sheetCache = sheetCacheJson ? JSON.parse(sheetCacheJson) : {};

  sheetCache[key] = value
  cache.put(registryKey, JSON.stringify(sheetCache), 31536000); // Store for 1 year
}

/**
 * Gets a value from Monarch cache for the active sheet.
 * @private
 */
function _getFromMonarchCache(key) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const cache = CacheService.getScriptCache();
  const registryKey = `monarch_${sheet.getName()}`;

  const sheetCacheJson = cache.get(registryKey);
  let sheetCache = sheetCacheJson ? JSON.parse(sheetCacheJson) : {};

  return sheetCache[key]; // will be undefined on cache miss
}

/**
 * Clears the cache for all Monarch-related cells on the current sheet using the registry.
 */
function _clearSheetMonarchCache() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const cache = CacheService.getScriptCache();
  const registryKey = `monarch_${sheet.getName()}`;
  const keysJson = cache.get(registryKey);

  if (keysJson) {
    cache.remove(registryKey);
    Logger.log(`Successfully cleared cached items for sheet '${sheet.getName()}'.`);
  } else {
    Logger.log("Cache registry is empty. Nothing to clear.");
  }
}

/**
 * An installable trigger that runs automatically when a user edits the spreadsheet.
 *
 * @param {Object} e The event object.
 */
function onEdit(e) {
  const range = e.range;
  
  // Check if the edited cell is our refresh checkbox.
  if (range.getA1Notation() === REFRESH_CELL) {
    // Clear the cache for the current sheet whenever the refresh cell is edited.
    _clearSheetMonarchCache();
    SpreadsheetApp.flush(); // Ensures changes are applied immediately.
  }
}