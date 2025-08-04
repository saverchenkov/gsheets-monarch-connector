import request from 'supertest';
import app from './proxy_server.js';
import { getTransactionsSummary, setToken } from 'monarch-money-api';

// Mock the monarch-money-api module
jest.mock('monarch-money-api', () => ({
  setToken: jest.fn(),
  getTransactionsSummary: jest.fn(),
}));

describe('Proxy Server', () => {
  beforeEach(() => {
    // Reset mocks before each test
    getTransactionsSummary.mockClear();
    setToken.mockClear();
  });

  it('should return a 401 error if no token is provided in the header', async () => {
    const response = await request(app).post('/get-transactions').send({ filters: {} });
    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Authorization header with a Token is required.');
  });

  it('should return a 400 error if filters are not provided in the body', async () => {
    const response = await request(app)
      .post('/get-transactions')
      .set('Authorization', 'Token fake-token')
      .send({});
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Missing "filters" in request body.');
  });

  it('should call getTransactionsSummary with the correct filters and return the result', async () => {
    const mockFilters = { startDate: '2024-01-01' };
    const mockResponse = { data: { aggregates: { summary: { sumExpense: -123.45 } } } };
    const fakeToken = 'my-secret-token';
    
    getTransactionsSummary.mockResolvedValue(mockResponse);

    const response = await request(app)
      .post('/get-transactions')
      .set('Authorization', `Token ${fakeToken}`)
      .send({ filters: mockFilters });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(mockResponse);
    expect(setToken).toHaveBeenCalledWith(fakeToken);
    expect(getTransactionsSummary).toHaveBeenCalledWith(mockFilters);
  });

  it('should handle errors from the Monarch API', async () => {
    const mockFilters = { startDate: '2024-01-01' };
    const errorMessage = 'Monarch API is down';
    
    getTransactionsSummary.mockRejectedValue(new Error(errorMessage));

    const response = await request(app)
      .post('/get-transactions')
      .set('Authorization', 'Token fake-token')
      .send({ filters: mockFilters });

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('An internal server error occurred.');
    expect(response.body.details).toBe(errorMessage);
  });
});