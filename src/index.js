const express = require('express');
const config = require('./config');
const queryRouter = require('./routes/query');

const app = express();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Query endpoint
app.use('/', queryRouter);

app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
  console.log('Endpoints:');
  console.log(`  GET /health - Health check`);
  console.log(`  GET /query?q=... - Query Mixpanel with natural language`);
});
