/**
 * @OnlyCurrentDoc
 */

// --- CONFIGURATION ---
// 1. Replace this with your actual ngrok URL
const NGROK_URL = 'YOUR_NGROK_URL_HERE';

// 2. Replace this with your Monarch Money API Token
const MONARCH_TOKEN = 'YOUR_MONARCH_TOKEN_HERE';

// 3. Add the secret API key for your proxy server
const PROXY_API_KEY = 'YOUR_NEW_API_KEY_HERE';
// ---------------------


/**
 * A custom function that calculates the total amount of transactions from a Monarch Money search URL.
 *
 * @param {string} cellReference The cell reference (e.g., "C2") containing the HYPERLINK formula.
 * @return The total amount of transactions.
 * @customfunction
 */
function GET_MONARCH_TOTAL(cellReference, refreshTrigger) {
  const sheetName = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet().getName();
  const cache = CacheService.getScriptCache();
  const cacheKey = `monarch_total_${sheetName}_${cellReference}`;
  const cachedValue = cache.get(cacheKey);

  // If we have a cached value, return it immediately.
  if (cachedValue !== null) {
    return parseFloat(cachedValue);
  }

  // Input validation
  if (typeof cellReference !== 'string' || !/^[A-Z]+[0-9]+$/i.test(cellReference)) {
    return 'Error: Input must be a cell reference in quotes, e.g., "D30".';
  }
  if (NGROK_URL === 'YOUR_NGROK_URL_HERE' || MONARCH_TOKEN === 'YOUR_MONARCH_TOKEN_HERE') {
    return "Error: Please set your ngrok URL and Monarch Token in the MonarchApi.gs script.";
  }

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

  let total = 0;
  if (apiResponse && apiResponse.aggregates && apiResponse.aggregates[0] && apiResponse.aggregates[0].summary) {
    const summary = apiResponse.aggregates[0].summary;
    const sumExpense = summary.sumExpense || 0;
    const sumIncome = summary.sumIncome || 0;
    // In Monarch, expenses are positive and income is negative in the API response.
    // To get a meaningful total for a category, we often want the absolute sum.
    // For this use case, we will sum the absolute values.
    total = Math.abs(sumExpense) + Math.abs(sumIncome);
  }

  // Store the new value in the cache for 6 hours.
  cache.put(cacheKey, total.toString(), 21600);
  return total;
}

/**
 * A new test function to debug a specific URL from the sheet by calling the main function.
 * Instructions:
 * 1. Set the `cellToTest` variable to the cell you want to debug (e.g., "D32").
 * 2. Run this function from the Apps Script editor.
 * 3. Check the logs to see the final result.
 */
function debugSpecificUrl() {
  const cellToTest = "D32"; // <--- SET THIS TO THE CELL YOU WANT TO TEST
  
  Logger.log(`--- Testing GET_MONARCH_TOTAL with cell: "${cellToTest}" ---`);

  const result = GET_MONARCH_TOTAL(cellToTest);
  
  Logger.log(`Result: ${result}`);
  
  Logger.log("--- Test Complete ---");
}


/**
 * Calls the local proxy server to get transaction data.
 * @private
 */
function _callProxyServer(filters) {
  const proxyUrl = NGROK_URL + '/get-transactions';
  const payload = {
    filters: filters
  };
  
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
 * A test function to verify the proxy integration.
 */
function testMonarchApi() {
  const testFilters = {
    startDate: "2024-01-01",
    endDate: "2024-01-31",
    categories: ["160556687721490945"]
  };
  
  Logger.log("Calling proxy with filters: " + JSON.stringify(testFilters, null, 2));
  const response = _callProxyServer(testFilters);
  Logger.log("Proxy Response: " + JSON.stringify(response, null, 2));
}

/**
 * A function to be assigned to a button in the sheet.
 * It updates a cell with the current time to force a refresh of all formulas
 * that reference it.
 */
function refreshSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const sheetName = sheet.getName();
  const cache = CacheService.getScriptCache();
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  const keysToRemove = [];

  // Find all cache keys associated with the current sheet.
  for (let i = 0; i < values.length; i++) {
    for (let j = 0; j < values[i].length; j++) {
      const cellReference = dataRange.getCell(i + 1, j + 1).getA1Notation();
      keysToRemove.push(`monarch_total_${sheetName}_${cellReference}`);
    }
  }

  // Remove all keys for the current sheet in a single batch operation.
  if (keysToRemove.length > 0) {
    cache.removeAll(keysToRemove);
  }
}
/**
 * A custom function that returns the name of the current sheet.
 *
 * @return The name of the active sheet.
 * @customfunction
 */
function getSheetName() {
  return SpreadsheetApp.getActiveSpreadsheet().getActiveSheet().getName();
}