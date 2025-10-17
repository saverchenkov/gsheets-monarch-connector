import app from './proxy_server.js';

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Monarch proxy server listening at http://localhost:${port}`);
});