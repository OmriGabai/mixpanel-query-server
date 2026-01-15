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

  const url = `${BASE_URL}/segmentation?${params}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': getAuthHeader(),
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Mixpanel API error: ${response.status} - ${error}`);
  }

  const result = await response.json();
  return {
    result,
    debug: {
      url: `${BASE_URL}/segmentation`,
      method: 'GET',
      params: { event, from_date, to_date, on, where, unit }
    }
  };
}

async function queryInsights(bookmarkId) {
  const params = new URLSearchParams({
    project_id: config.mixpanel.projectId,
    bookmark_id: bookmarkId
  });

  const url = `${BASE_URL}/insights?${params}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': getAuthHeader(),
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Mixpanel API error: ${response.status} - ${error}`);
  }

  const result = await response.json();
  return {
    result,
    debug: {
      url: `${BASE_URL}/insights`,
      method: 'GET',
      params: { bookmark_id: bookmarkId }
    }
  };
}

async function queryFunnels({ funnel_id, from_date, to_date, unit = 'day' }) {
  const params = new URLSearchParams({
    project_id: config.mixpanel.projectId,
    funnel_id,
    from_date,
    to_date,
    unit
  });

  const url = `${BASE_URL}/funnels?${params}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': getAuthHeader(),
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Mixpanel API error: ${response.status} - ${error}`);
  }

  const result = await response.json();
  return {
    result,
    debug: {
      url: `${BASE_URL}/funnels`,
      method: 'GET',
      params: { funnel_id, from_date, to_date, unit }
    }
  };
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

  const url = `${BASE_URL}/retention?${params}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': getAuthHeader(),
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Mixpanel API error: ${response.status} - ${error}`);
  }

  const result = await response.json();
  return {
    result,
    debug: {
      url: `${BASE_URL}/retention`,
      method: 'GET',
      params: { event, retention_type, born_event, from_date, to_date, unit }
    }
  };
}

async function listEvents() {
  const eventsUrl = 'https://mixpanel.com/api/query/events/top';
  const params = new URLSearchParams({
    project_id: config.mixpanel.projectId,
    type: 'general',
    limit: 100
  });

  const url = `${eventsUrl}?${params}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': getAuthHeader(),
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Mixpanel API error: ${response.status} - ${error}`);
  }

  const result = await response.json();
  return {
    result,
    debug: {
      url: eventsUrl,
      method: 'GET',
      params: { type: 'general', limit: 100 }
    }
  };
}

async function listEventProperties(event, limit = 20) {
  const propertiesUrl = 'https://mixpanel.com/api/query/events/properties/top';
  const params = new URLSearchParams({
    project_id: config.mixpanel.projectId,
    event,
    limit
  });

  const url = `${propertiesUrl}?${params}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': getAuthHeader(),
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Mixpanel API error: ${response.status} - ${error}`);
  }

  const result = await response.json();
  // API returns { "property_name": { "count": N }, ... }
  const properties = Object.entries(result).map(([name, data]) => ({
    name,
    count: data.count
  }));

  return {
    result: properties,
    debug: {
      url: propertiesUrl,
      method: 'GET',
      params: { event, limit }
    }
  };
}

async function listPropertyValues(event, propertyName, limit = 50) {
  const valuesUrl = 'https://mixpanel.com/api/query/events/properties/values';
  const params = new URLSearchParams({
    project_id: config.mixpanel.projectId,
    event,
    name: propertyName,
    limit
  });

  const url = `${valuesUrl}?${params}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': getAuthHeader(),
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Mixpanel API error: ${response.status} - ${error}`);
  }

  // API returns array of values
  const result = await response.json();
  return {
    result,
    debug: {
      url: valuesUrl,
      method: 'GET',
      params: { event, name: propertyName, limit }
    }
  };
}

function buildMixpanelLink(queryType, params) {
  const projectId = config.mixpanel.projectId;
  const baseUrl = `https://mixpanel.com/report/${projectId}`;

  switch (queryType) {
    case 'segmentation':
      return `${baseUrl}/insights`;
    case 'funnels':
      return `${baseUrl}/funnels`;
    case 'retention':
      return `${baseUrl}/retention`;
    case 'events':
      return `${baseUrl}/insights`;
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
  listEventProperties,
  listPropertyValues,
  buildMixpanelLink
};
