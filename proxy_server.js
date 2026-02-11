import express from 'express';
import bodyParser from 'body-parser';
import { GraphQLClient, gql } from 'graphql-request';

const app = express();
const port = 3000;
const GRAPHQL_URL = 'https://api.monarch.com/graphql';

app.use(bodyParser.json());

const PROXY_API_KEY = process.env.PROXY_API_KEY;

app.post('/get-transactions', async (req, res) => {
  console.log(`[${new Date().toISOString()}] Received request for /get-transactions`);
  
  // 1. Check for Proxy API Key
  const apiKey = req.headers['x-api-key'];
  if (!PROXY_API_KEY || apiKey !== PROXY_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing API Key.' });
  }

  // 2. Extract token from header
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Token ')) {
    return res.status(401).json({ error: 'Authorization header with a Token is required.' });
  }
  const token = authHeader.split(' ')[1];

  // 2. Extract filters from body
  const filters = req.body.filters;
  if (!filters) {
    console.log('Request rejected: Missing "filters" in body.');
    return res.status(400).json({ error: 'Missing "filters" in request body.' });
  }
  console.log('Processing with filters:', JSON.stringify(filters, null, 2));

  // 3. Construct and send the direct GraphQL request
  try {
    const client = new GraphQLClient(GRAPHQL_URL, {
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json',
        'Client-Platform': 'web',
      },
    });

    const query = gql`
      query Web_GetTransactionsPage($filters: TransactionFilterInput) {
        aggregates(filters: $filters) {
          summary {
            ...TransactionsSummaryFields
            __typename
          }
          __typename
        }
      }
      fragment TransactionsSummaryFields on TransactionsSummary {
        avg count max maxExpense sum sumIncome sumExpense first last __typename
      }
    `;

    const variables = { filters };
    const data = await client.request(query, variables);
    
    console.log('Successfully fetched data from Monarch API.');
    res.json(data);

  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ error: 'An internal server error occurred.', details: error.message });
  }
});

export default app;