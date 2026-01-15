const OpenAI = require('openai');
const config = require('../config');

const openai = new OpenAI({
  apiKey: config.openai.apiKey
});

// Try to load database for schema context (may not exist on first run)
let db = null;
try {
  db = require('./database');
} catch (e) {
  console.log('Database not available yet, schema context disabled');
}

function buildInterpretationPrompt() {
  let schemaContext = '';

  if (db) {
    try {
      const context = db.getSchemaContextForPrompt();
      if (context && context.trim()) {
        schemaContext = `
Available events in this Mixpanel project:
${context}

IMPORTANT: Use the EXACT event names from the list above when they match the user's question.
`;
      }
    } catch (e) {
      // Schema not available yet
    }
  }

  return `You are a Mixpanel query assistant. Given a natural language question about analytics data, determine the appropriate Mixpanel query parameters.
${schemaContext}
Return a JSON object with this structure:
{
  "query_type": "segmentation" | "funnels" | "retention" | "events",
  "params": {
    // For segmentation:
    "event": "event name",
    "from_date": "YYYY-MM-DD",
    "to_date": "YYYY-MM-DD",
    "on": "property to segment by (optional)",
    "where": "filter expression (optional)",
    "unit": "day" | "week" | "month"

    // For retention:
    "event": "return event name",
    "born_event": "initial event (optional)",
    "from_date": "YYYY-MM-DD",
    "to_date": "YYYY-MM-DD"

    // For events:
    // No additional params needed - just lists top events
  }
}

Important:
- Default to the last 7 days if no date range is specified
- Use "segmentation" for questions about event counts, trends, or breakdowns
- Use "retention" for questions about user retention or return rates
- Use "events" for questions about what events exist
- Today's date is: ${new Date().toISOString().split('T')[0]}

Return ONLY valid JSON, no explanation.`;
}

const SUMMARIZATION_PROMPT = `You are a data analyst. Given the user's original question and the raw data from Mixpanel, provide a concise natural language summary of the findings.

Guidelines:
- Be specific with numbers and percentages
- Highlight key trends or notable patterns
- Keep it brief (2-4 sentences)
- If the data is empty or shows no results, say so clearly`;

const DESCRIPTION_PROMPT = `You are a data documentation expert. Generate a clear, concise description for an analytics event or property based on the context provided.

Guidelines:
- Keep descriptions brief (1-2 sentences)
- Focus on WHAT the event/property represents and WHEN it's triggered
- Use plain language that a non-technical person can understand
- If sample values are provided, use them to infer meaning
- Do not include technical implementation details
- Do not start with "This event" or "This property" - be direct`;

async function interpretQuestion(question) {
  const model = 'gpt-4o';
  const systemPrompt = buildInterpretationPrompt();
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: question }
  ];

  const response = await openai.chat.completions.create({
    model,
    messages,
    temperature: 0,
    response_format: { type: 'json_object' }
  });

  const content = response.choices[0].message.content;
  const result = JSON.parse(content);
  const usage = response.usage;

  return {
    result,
    debug: {
      request: { model, messages, temperature: 0 },
      response: result,
      tokens: {
        input: usage?.prompt_tokens || 0,
        output: usage?.completion_tokens || 0,
        total: usage?.total_tokens || 0
      }
    }
  };
}

async function summarizeResults(question, data) {
  const model = 'gpt-4o';
  const messages = [
    { role: 'system', content: SUMMARIZATION_PROMPT },
    {
      role: 'user',
      content: `Question: ${question}\n\nData:\n${JSON.stringify(data, null, 2)}`
    }
  ];

  const response = await openai.chat.completions.create({
    model,
    messages,
    temperature: 0.3
  });

  const result = response.choices[0].message.content;
  const usage = response.usage;

  return {
    result,
    debug: {
      request: { model, messages, temperature: 0.3 },
      response: result,
      tokens: {
        input: usage?.prompt_tokens || 0,
        output: usage?.completion_tokens || 0,
        total: usage?.total_tokens || 0
      }
    }
  };
}

async function generateDescription(context) {
  const model = 'gpt-4o';

  let userContent = '';
  if (context.type === 'event') {
    userContent = `Event name: "${context.name}"`;
    if (context.properties && context.properties.length > 0) {
      userContent += `\nProperties: ${context.properties.map(p => p.name).join(', ')}`;
      const propsWithValues = context.properties.filter(p => p.sampleValues?.length > 0);
      if (propsWithValues.length > 0) {
        userContent += '\nSample values:';
        for (const p of propsWithValues.slice(0, 5)) {
          userContent += `\n  ${p.name}: ${p.sampleValues.slice(0, 5).join(', ')}`;
        }
      }
    }
  } else if (context.type === 'property') {
    userContent = `Property name: "${context.name}"`;
    if (context.eventName) {
      userContent += `\nOn event: "${context.eventName}"`;
    }
    if (context.dataType) {
      userContent += `\nData type: ${context.dataType}`;
    }
    if (context.sampleValues && context.sampleValues.length > 0) {
      userContent += `\nSample values: ${context.sampleValues.slice(0, 10).join(', ')}`;
    }
  }

  const messages = [
    { role: 'system', content: DESCRIPTION_PROMPT },
    { role: 'user', content: userContent }
  ];

  const response = await openai.chat.completions.create({
    model,
    messages,
    temperature: 0.3,
    max_tokens: 150
  });

  const result = response.choices[0].message.content.trim();
  const usage = response.usage;

  return {
    result,
    debug: {
      request: { model, messages, temperature: 0.3 },
      response: result,
      tokens: {
        input: usage?.prompt_tokens || 0,
        output: usage?.completion_tokens || 0,
        total: usage?.total_tokens || 0
      }
    }
  };
}

module.exports = {
  interpretQuestion,
  summarizeResults,
  generateDescription
};
