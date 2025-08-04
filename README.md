# Monarch Money Google Sheets Integration

This project provides a solution to automatically fetch transaction totals from your Monarch Money account directly into a Google Sheet. It uses a custom Google Apps Script function, `=GET_MONARCH_TOTAL()`, which can parse a `HYPERLINK` formula pointing to a Monarch Money transaction search.

## The Challenge: Cloudflare Blocking

Direct API calls from Google Apps Script to the Monarch Money API are blocked by Cloudflare's security measures. To solve this, this project uses a local proxy server that runs on your machine. The Google Sheet communicates with the proxy, and the proxy communicates with the Monarch API.

## Architecture

1.  **Google Apps Script (`MonarchApi.gs`):** The script in your Google Sheet. It contains the custom function and your configuration.
2.  **Ngrok:** A tool that creates a secure, public URL for your local proxy server, allowing the Google Sheet to reach it.
3.  **Local Proxy Server (`proxy_server.js`):** A Node.js server that runs on your machine. It receives requests from the script, fetches data from the Monarch API, and returns it.
4.  **Test Suite (`proxy_server.test.js`):** A Jest test suite to ensure the proxy server is working correctly.

---

## Setup Instructions

### Prerequisites

*   [Node.js](https://nodejs.org/) installed on your computer.
*   [Homebrew](https://brew.sh/) installed on your Mac (for installing ngrok).
*   An [ngrok](https://ngrok.com/) account (a free account is sufficient).

### Step 1: Get Your Monarch Money API Token

1.  Open your web browser (Chrome is recommended) and log in to your Monarch Money account at `https://app.monarchmoney.com`.
2.  Open the Developer Tools by pressing `F12` or `Cmd+Opt+I` on a Mac.
3.  Click on the **Network** tab.
4.  Perform an action in the Monarch app (e.g., refresh the page).
5.  Find a request named `graphql`, click on it, and go to the **Headers** tab.
6.  In the **Request Headers**, find the `authorization` header.
7.  Copy the long string of characters *after* `Token ` (do not include "Token" or the space). This is your API token.

### Step 2: Install Ngrok

1.  Open your terminal and run:
    ```bash
    brew install ngrok
    ```
2.  Connect ngrok to your account. Go to the [ngrok Dashboard](https://dashboard.ngrok.com/get-started/your-authtoken), copy your authtoken command, and run it in your terminal.

### Step 3: Configure the Google Apps Script

1.  Open your Google Sheet and go to **Extensions > Apps Script**.
2.  Copy the entire content of the `MonarchApi.gs` file and paste it into the script editor.
3.  You will see a **CONFIGURATION** section at the top of the script.
4.  Replace `'YOUR_MONARCH_TOKEN_HERE'` with the token you copied in Step 1.
5.  Leave the `NGROK_URL` for now. We will get this in the next step. Save the script.

### Step 4: Run the Local Proxy

This requires two separate terminal windows.

**In Terminal 1 (Start the Proxy Server):**

1.  Navigate to the project directory (`/Users/sergeya/ai/auto_bills`).
2.  Run `npm install` to install all dependencies.
3.  Run `npm start` to start the server.
4.  You should see `Monarch proxy server listening at http://localhost:3000`. Leave this running.

**In Terminal 2 (Start Ngrok):**

1.  Run `ngrok http 3000`.
2.  Ngrok will provide a public "Forwarding" URL (e.g., `https://random-string.ngrok.io`). **Copy this URL.**

### Step 5: Final Configuration

1.  Go back to the Apps Script editor.
2.  Replace `'YOUR_NGROK_URL_HERE'` with the URL you copied from ngrok.
3.  Save the script.

---

## Usage in Google Sheets

1.  Create a cell with a `HYPERLINK` formula that points to a Monarch Money transaction search.
    *   **Example:** `=HYPERLINK("https://app.monarchmoney.com/transactions?categories=123...&startDate="&TEXT($B$3,"YYYY-MM-DD"), "Link")`
2.  In another cell, use the custom function, passing the address of the hyperlink cell as a string.
    *   **Example:** `=GET_MONARCH_TOTAL("D30")`
3.  To make the formula draggable, use the `ROW()` function:
    *   **Example:** `=GET_MONARCH_TOTAL("D" & ROW())`

### Forcing a Refresh with a Button

Google Sheets caches the results of custom functions. To force a recalculation of all your Monarch totals at once, you can create a "Refresh" button.

**Step 1: Add a Reference Cell to Your Formulas**

1.  Decide on a cell that will act as your refresh trigger (e.g., `A1` on your 'July' sheet).
2.  Modify all your `=GET_MONARCH_TOTAL()` formulas to include a reference to this cell.
    *   **Example:** `=GET_MONARCH_TOTAL("D" & ROW(), July!A1)`
    *   **Important:** Make sure to use an absolute reference (`$A$1`) if you plan to drag the formula across different columns or sheets, or if your refresh cell is on a different sheet.

**Step 2: Create the Button**

1.  In your Google Sheet, go to **Insert > Drawing**.
2.  Create a shape that will be your button (e.g., a rounded rectangle). Add text like "Refresh".
3.  Click **Save and Close**. The drawing will appear on your sheet. You can move and resize it as needed.

**Step 3: Assign the Script**

1.  Click on the drawing you just created.
2.  Click the three-dot menu icon that appears in the top-right corner of the drawing.
3.  Select **Assign script**.
4.  In the dialog box that appears, type the name of our new function: `refreshSheet`
5.  Click **OK**.

Now, every time you click the button, it will run the `refreshSheet` function, which updates the value in your trigger cell (`A1`). This change will force all the formulas that reference that cell to recalculate and fetch the latest data from Monarch.

## Testing the Proxy Server

You can run a suite of automated tests to ensure the proxy server is working correctly.

1.  In your terminal, navigate to the project directory.
2.  Run the command:
    ```bash
    npm test