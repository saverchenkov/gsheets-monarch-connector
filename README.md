# Monarch Money Google Sheets Integration

This project provides a solution to automatically fetch transaction totals from your Monarch Money account directly into a Google Sheet. It uses a custom Google Apps Script function, `=GET_MONARCH_TOTAL()`, which can parse a `HYPERLINK` formula pointing to a Monarch Money transaction search.

## The Challenge: Cloudflare Blocking

Direct API calls from Google Apps Script to the Monarch Money API are blocked by Cloudflare's security measures. To solve this, this project uses a proxy server. While the original implementation used a local proxy, this guide now details how to deploy a permanent, secure proxy to Google Cloud Run.

## Architecture

1.  **Google Apps Script (`MonarchApi.gs`):** The script in your Google Sheet. It contains the custom function and your configuration.
2.  **Google Cloud Run:** A serverless platform that runs our proxy server in a scalable and secure environment.
3.  **Google Cloud Secret Manager:** Securely stores the API key for the proxy server.
4.  **Proxy Server (`proxy_server.js`):** A Node.js server that runs on Cloud Run. It receives requests from the script, fetches data from the Monarch API, and returns it.
5.  **Test Suite (`proxy_server.test.js`):** A Jest test suite to ensure the proxy server is working correctly.

---

## Deployment to Google Cloud Run

This is the recommended setup for a permanent and reliable integration.

### Prerequisites

*   A Google Cloud Platform (GCP) project with billing enabled.
*   The [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) installed and authenticated.

### Step 1: Get Your Monarch Money API Token

1.  Open your web browser and log in to your Monarch Money account.
2.  Open the Developer Tools (F12 or `Cmd+Opt+I`).
3.  Go to the **Network** tab, find a `graphql` request, and go to the **Headers** tab.
4.  In the **Request Headers**, find the `authorization` header.
5.  Copy the long string of characters *after* `Token ` (do not include "Token" or the space). This is your API token.

### Step 2: Configure the Google Apps Script

1.  Open your Google Sheet and go to **Extensions > Apps Script**.
2.  Copy the entire content of `MonarchApi.gs` into the script editor.
3.  Replace `'YOUR_MONARCH_TOKEN_HERE'` with the token you just copied.
4.  Generate a strong, random string to use as your proxy server's API key.
5.  Replace `'YOUR_NEW_API_KEY_HERE'` with the API key you just generated.
6.  Leave the `NGROK_URL` for now. We will replace this with the Cloud Run URL later. Save the script.

### Step 3: Deploy the Proxy Server

1.  Open your terminal and navigate to the project directory.
2.  Run the following command to create a secret in Google Cloud Secret Manager. Replace `[YOUR_SECRET_API_KEY]` with the same key you used in the Apps Script.
    ```bash
    echo -n "[YOUR_SECRET_API_KEY]" | gcloud secrets create monarch-proxy-api-key --data-file=-
    ```
3.  Grant the default Cloud Build service account permission to access secrets.
    ```bash
    gcloud projects add-iam-policy-binding [YOUR_PROJECT_ID] --member="serviceAccount:[PROJECT_NUMBER]-compute@developer.gserviceaccount.com" --role="roles/secretmanager.secretAccessor"
    ```
4.  Deploy the service to Cloud Run. This command will build the Docker image, push it to the Artifact Registry, and deploy it.
    ```bash
    gcloud run deploy monarch-proxy --source . --platform managed --region us-west1 --allow-unauthenticated --update-secrets=PROXY_API_KEY=monarch-proxy-api-key:latest
    ```
5.  The command will output a **Service URL**. Copy this URL.

### Step 4: Final Configuration

1.  Go back to the Apps Script editor.
2.  Replace the entire `NGROK_URL` variable and its value with the **Service URL** you just copied.
3.  Save the script. Your integration is now live!

---

## Usage in Google Sheets

1.  Create a cell with a `HYPERLINK` formula that points to a Monarch Money transaction search.
    *   **Example:** `=HYPERLINK("https://app.monarchmoney.com/transactions?categories=123...&startDate="&TEXT($B$3,"YYYY-MM-DD"), "Link")`
2.  In another cell, use the custom function, passing the address of the hyperlink cell as a string.
    *   **Example:** `=GET_MONARCH_TOTAL("D30")`
3.  To make the formula draggable, use the `ROW()` function:
    *   **Example:** `=GET_MONARCH_TOTAL("D" & ROW())`

### Forcing a Refresh with a Button

Google Sheets caches the results of custom functions. To force a recalculation, you can create a "Refresh" button.

**Step 1: Add a Reference Cell to Your Formulas**

1.  Choose a cell to act as a refresh trigger (e.g., `A1` on your 'July' sheet).
2.  Modify your `=GET_MONARCH_TOTAL()` formulas to include a reference to this cell.
    *   **Example:** `=GET_MONARCH_TOTAL("D" & ROW(), July!A1)`

**Step 2: Create and Assign the Button**

1.  Go to **Insert > Drawing**, create a button shape, and save it.
2.  Click the three-dot menu on the drawing and select **Assign script**.
3.  Enter `refreshSheet` and click **OK**.

Now, clicking the button will update the trigger cell and refresh all your Monarch totals.

## Testing the Proxy Server

You can run a suite of automated tests to ensure the proxy server is working correctly.

1.  In your terminal, navigate to the project directory.
2.  Run the command:
    ```bash
    npm test