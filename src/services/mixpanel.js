const config = require('../config');

const BASE_URL = 'https://mixpanel.com/api/query';

function getAuthHeader() {
  const credentials = `${config.mixpanel.username}:${config.mixpanel.secret}`;
  const encoded = Buffer.from(credentials).toString('base64');
  return `Basic ${encoded}`;
}

async function querySegmentation({ event, from_date, to_date, on, where, unit = 'day' }) {
  const params = new URLSearchParams({
    project_id: config.mixpanel.projectId,
    event,
    from_date,
    to_date,
    unit
  });

  if (on) params.append('on', on);
  if (where) params.append('where', where);

  const response = await fetch(`${BASE_URL}/segmentation?${params}`, {
    headers: {
      'Authorization': getAuthHeader(),
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Mixpanel API error: ${response.status} - ${error}`);
  }

  return response.json();
}

async function queryInsights(bookmarkId) {
  const params = new URLSearchParams({
    project_id: config.mixpanel.projectId,
    bookmark_id: bookmarkId
  });

  const response = await fetch(`${BASE_URL}/insights?${params}`, {
    headers: {
      'Authorization': getAuthHeader(),
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Mixpanel API error: ${response.status} - ${error}`);
  }

  return response.json();
}

async function queryFunnels({ funnel_id, from_date, to_date, unit = 'day' }) {
  const params = new URLSearchParams({
    project_id: config.mixpanel.projectId,
    funnel_id,
    from_date,
    to_date,
    unit
  });

  const response = await fetch(`${BASE_URL}/funnels?${params}`, {
    headers: {
      'Authorization': getAuthHeader(),
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Mixpanel API error: ${response.status} - ${error}`);
  }

  return response.json();
}

async function queryRetention({ event, retention_type = 'birth', born_event, from_date, to_date, unit = 'day' }) {
  const params = new URLSearchParams({
    project_id: config.mixpanel.projectId,
    event,
    retention_type,
    from_date,
    to_date,
    unit
  });

  if (born_event) params.append('born_event', born_event);

  const response = await fetch(`${BASE_URL}/retention?${params}`, {
    headers: {
      'Authorization': getAuthHeader(),
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Mixpanel API error: ${response.status} - ${error}`);
  }

  return response.json();
}

async function listEvents() {
  const params = new URLSearchParams({
    project_id: config.mixpanel.projectId,
    limit: 100
  });

  const response = await fetch(`https://mixpanel.com/api/query/events/top?${params}`, {
    headers: {
      'Authorization': getAuthHeader(),
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Mixpanel API error: ${response.status} - ${error}`);
  }

  return response.json();
}

function buildMixpanelLink(queryType, params) {
  const projectId = config.mixpanel.projectId;
  const baseUrl = `https://mixpanel.com/project/${projectId}`;

  switch (queryType) {
    case 'segmentation':
      return `${baseUrl}/view/segmentation`;
    case 'funnels':
      return `${baseUrl}/view/funnels`;
    case 'retention':
      return `${baseUrl}/view/retention`;
    default:
      return baseUrl;
  }
}

module.exports = {
  querySegmentation,
  queryInsights,
  queryFunnels,
  queryRetention,
  listEvents,
  buildMixpanelLink
};
