/**
 * @OnlyCurrentDoc
 */

// --- CONFIGURATION ---
// 1. Replace this with your actual ngrok URL
const NGROK_URL = 'YOUR_NGROK_URL_HERE';

// 2. Replace this with your Monarch Money API Token
const MONARCH_TOKEN = 'YOUR_MONARCH_TOKEN_HERE';
// ---------------------


/**
 * A custom function that calculates the total amount of transactions from a Monarch Money search URL.
 *
 * @param {string} cellReference The cell reference (e.g., "C2") containing the HYPERLINK formula.
 * @return The total amount of transactions.
 * @customfunction
 */
function GET_MONARCH_TOTAL(cellReference) {
  // Input validation to ensure the user provides a string reference like "D30"
  if (typeof cellReference !== 'string' || !/^[A-Z]+[0-9]+$/i.test(cellReference)) {
    return 'Error: Input must be a cell reference in quotes, e.g., "D30".';
  }

  if (NGROK_URL === 'YOUR_NGROK_URL_HERE' || MONARCH_TOKEN === 'YOUR_MONARCH_TOKEN_HERE') {
    return "Error: Please set your ngrok URL and Monarch Token in the MonarchApi.gs script.";
  }

  const url = _getURLFromCell(cellReference);
  if (!url) {
    return "Error: Could not find a valid HYPERLINK in the cell.";
  }

  const filters = _getFiltersFromUrl(url);
  const apiResponse = _callProxyServer(filters);

  // Improved Error Handling: Check for a specific error message from the proxy
  if (apiResponse && apiResponse.error) {
    Logger.log("Error from proxy server: " + JSON.stringify(apiResponse));
    // Try to extract a more specific message from the GraphQL error details
    if (apiResponse.details && apiResponse.details.includes("Variable \\\"$filters\\\" got invalid value")) {
      return "Error: Invalid date or filter in HYPERLINK formula.";
    }
    return "Proxy Error: " + apiResponse.error;
  }

  // The API returns the summary inside an array, so we need to access the first element.
  if (apiResponse && apiResponse.aggregates && apiResponse.aggregates[0] && apiResponse.aggregates[0].summary) {
    // If a summary exists, return the sum of expenses (which will be 0 if there are no transactions).
    return apiResponse.aggregates[0].summary.sumExpense;
  } else if (apiResponse && apiResponse.aggregates) {
    // If the aggregates array exists but is empty or has no summary, it means no transactions were found.
    return 0;
  }
  else {
    Logger.log("Error: Could not retrieve a valid summary from the proxy. Response: " + JSON.stringify(apiResponse));
    return "Error: Could not retrieve transactions.";
  }
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
      'Authorization': 'Token ' + MONARCH_TOKEN
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