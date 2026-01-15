// Schema API Client

const API_BASE = '/api/schema';

async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  };

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(url, config);
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

// Events
async function getEvents() {
  return apiRequest('/events');
}

async function getEvent(id) {
  return apiRequest(`/events/${id}`);
}

async function updateEventDescription(id, description, source = 'manual') {
  return apiRequest(`/events/${id}`, {
    method: 'PUT',
    body: { description, source },
  });
}

async function deleteEvent(id) {
  return apiRequest(`/events/${id}`, {
    method: 'DELETE',
  });
}

// Properties
async function getProperty(id) {
  return apiRequest(`/properties/${id}`);
}

async function updatePropertyDescription(id, description, source = 'manual') {
  return apiRequest(`/properties/${id}`, {
    method: 'PUT',
    body: { description, source },
  });
}

// Discovery
async function discoverEvents() {
  return apiRequest('/discover/events', { method: 'POST' });
}

async function discoverProperties(eventId) {
  return apiRequest(`/discover/properties/${eventId}`, { method: 'POST' });
}

async function discoverValues(propertyId) {
  return apiRequest(`/discover/values/${propertyId}`, { method: 'POST' });
}

async function discoverAll() {
  return apiRequest('/discover/all', { method: 'POST' });
}

// LLM
async function previewLlmDescription(type, id) {
  return apiRequest('/llm/preview', {
    method: 'POST',
    body: { type, id },
  });
}

async function confirmLlmDescription(type, id, description) {
  return apiRequest('/llm/confirm', {
    method: 'POST',
    body: { type, id, description },
  });
}

// Export
async function exportSchema(format = 'full') {
  return apiRequest(`/export?format=${format}`);
}
