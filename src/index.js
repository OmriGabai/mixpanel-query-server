const express = require('express');
const path = require('path');
const config = require('./config');
const queryRouter = require('./routes/query');
const schemaRouter = require('./routes/schema');

const app = express();

// Parse JSON bodies
app.use(express.json());

// Serve static files from public folder
app.use(express.static(path.join(__dirname, '..', 'public')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Schema management routes
app.use('/api/schema', schemaRouter);

// Query endpoint
app.use('/', queryRouter);

app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
  console.log('Endpoints:');
  console.log(`  GET /              - Test UI`);
  console.log(`  GET /health        - Health check`);
  console.log(`  GET /query?q=      - Query Mixpanel with natural language`);
  console.log(`  GET /schema        - Schema management UI`);
  console.log(`  GET /api/schema/*  - Schema API endpoints`);
});
