# Mixpanel Natural Language Query Server

A lightweight HTTP server that accepts natural language questions about analytics data, queries Mixpanel, and returns results in JSON format.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy the example config and fill in your values:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```
OPENAI_API_KEY=sk-your-openai-key
MIXPANEL_SERVICE_ACCOUNT_USERNAME=your-service-account-username
MIXPANEL_SERVICE_ACCOUNT_SECRET=your-service-account-secret
MIXPANEL_PROJECT_ID=your-project-id
PORT=3000
```

### 3. Get Mixpanel Service Account Credentials

1. Go to your Mixpanel project
2. Navigate to **Settings** → **Project Settings** → **Service Accounts**
3. Click **Create Service Account** (or use an existing one)
4. Copy the **username** and **secret**
5. Your **Project ID** is in the URL: `mixpanel.com/project/YOUR_PROJECT_ID`

### 4. Run the server

Development (with auto-reload):
```bash
npm run dev
```

Production:
```bash
npm start
```

## Usage

### Health Check

```bash
curl http://localhost:3000/health
```

Response:
```json
{"status":"ok"}
```

### Query Mixpanel

```bash
curl "http://localhost:3000/query?q=How%20many%20users%20signed%20up%20last%20week"
```

Response:
```json
{
  "success": true,
  "question": "How many users signed up last week",
  "summary": "Last week, 1,247 users signed up...",
  "data": { ... },
  "mixpanel_link": "https://mixpanel.com/project/..."
}
```

## Example Questions

- "How many users signed up last week?"
- "What are the top events in my project?"
- "Show me daily active users for the past month"
- "What's the user retention rate?"
- "How many purchases were made yesterday?"

## API Reference

### GET /health

Health check endpoint.

### GET /query?q=\<question\>

Query Mixpanel with a natural language question.

**Parameters:**
- `q` (required): Natural language question (max 500 characters)

**Response:**
```json
{
  "success": true,
  "question": "original question",
  "summary": "natural language summary of results",
  "data": { /* raw Mixpanel data */ },
  "mixpanel_link": "https://mixpanel.com/..."
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "error message",
  "details": "additional details"
}
```

## Architecture

```
[HTTP GET Request]
       ↓
   [Server]
       ↓
   [OpenAI] → interprets question → generates Mixpanel query
       ↓
   [Mixpanel API] → fetches data
       ↓
   [OpenAI] → summarizes results
       ↓
   [JSON Response]
```

## Files

```
mixpanel-query-server/
├── .env.example      # Environment template
├── .env              # Your credentials (not committed)
├── PRD.md            # Product requirements
├── PROGRESS.md       # Implementation progress
├── README.md         # This file
├── package.json
└── src/
    ├── index.js      # Server entry point
    ├── config.js     # Environment config
    ├── routes/
    │   └── query.js  # Query endpoint
    └── services/
        ├── mixpanel.js  # Mixpanel API client
        └── openai.js    # OpenAI client
```

## Rate Limits

- **Mixpanel**: 60 queries/hour, 5 concurrent queries
- **OpenAI**: Depends on your plan

## Security

- Never commit `.env` (it's in `.gitignore`)
- Use service account credentials, not project secrets
- Run locally or on a private network (no auth built-in)
