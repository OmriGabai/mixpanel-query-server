# PRD: Mixpanel Natural Language Query Server

## Overview

A lightweight HTTP server that accepts natural language questions about analytics data, queries Mixpanel, and returns results in JSON format.

## Goals

- Enable quick, conversational access to Mixpanel data
- No UI complexity - simple HTTP GET interface
- Easy local setup for internal use
- Secure configuration management

## Non-Goals (MVP)

- Authentication
- Query history
- Caching
- Multi-project support
- Web UI

## Architecture

```
[HTTP GET Request]
       ↓
   [Server]
       ↓
   [OpenAI] → interprets question → generates Mixpanel query
       ↓
   [Mixpanel MCP/API] → fetches data
       ↓
   [JSON Response] → summary + data + Mixpanel link
```

## API

### `GET /query?q=<natural language question>`

**Request:**
```
GET /query?q=How many users signed up last week?
```

**Response:**
```json
{
  "success": true,
  "question": "How many users signed up last week?",
  "summary": "Last week, 1,247 users signed up, a 12% increase from the previous week.",
  "data": { ... },
  "mixpanel_link": "https://mixpanel.com/report/..."
}
```

### `GET /health`

Health check endpoint.

**Response:**
```json
{
  "status": "ok"
}
```

## Configuration & Security

### Approach
- Config stored in `.env` file (never committed)
- `.env` added to `.gitignore` before any commits
- `.env.example` provided as template (no real values)
- Use environment variables at runtime

### Config File Structure

**`.env.example`** (committed - template only):
```
OPENAI_API_KEY=your-openai-key-here
MIXPANEL_API_SECRET=your-mixpanel-secret-here
MIXPANEL_PROJECT_ID=your-project-id-here
PORT=3000
```

**`.env`** (never committed - actual secrets):
```
OPENAI_API_KEY=sk-...
MIXPANEL_API_SECRET=...
MIXPANEL_PROJECT_ID=...
PORT=3000
```

### Security Checklist
- [x] `.gitignore` includes `.env` before first commit
- [ ] No secrets in code or committed files
- [x] `.env.example` contains only placeholder values
- [ ] Validate env vars exist on server startup

## Tech Stack

- **Runtime**: Node.js 18+
- **Server**: Express.js
- **Mixpanel**: MCP server (if available) or direct REST API
- **LLM**: OpenAI API (GPT-4)

## Flow

1. Server receives GET request with question
2. Sends question to OpenAI with Mixpanel schema context
3. OpenAI returns structured query intent
4. Server calls Mixpanel MCP/API with the query
5. Server sends raw data back to OpenAI for summarization
6. Returns JSON with summary, data, and Mixpanel link

## Repository Structure

```
mixpanel-query-server/
├── .gitignore
├── .env.example
├── .env                 # NOT committed
├── PRD.md
├── PROGRESS.md
├── README.md
├── package.json
├── src/
│   ├── index.js         # entry point
│   ├── config.js        # env var loader
│   ├── routes/
│   │   └── query.js
│   ├── services/
│   │   ├── openai.js
│   │   └── mixpanel.js
│   └── utils/
└── mcp/                 # MCP config if used
    └── mcp.json
```

## NPM Scripts

```json
{
  "scripts": {
    "start": "node src/index.js",
    "dev": "node --watch src/index.js"
  }
}
```

## Error Response Format

```json
{
  "success": false,
  "error": "Error message",
  "details": "Additional details if available"
}
```

## Future Enhancements (Post-MVP)

- Web UI for easier interaction
- SSO authentication (Google/Okta)
- Query history and saved queries
- Caching for common queries
- Cloud deployment
