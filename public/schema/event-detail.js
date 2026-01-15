// Event Detail Page

let eventId = null;
let event = null;
let properties = [];
let currentProperty = null;
let currentLlmTarget = null;

// DOM Elements
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const contentEl = document.getElementById('content');
const eventNameEl = document.getElementById('eventName');
const eventSourceEl = document.getElementById('eventSource');
const eventDescriptionEl = document.getElementById('eventDescription');
const saveDescBtn = document.getElementById('saveDescBtn');
const generateDescBtn = document.getElementById('generateDescBtn');
const discoverPropsBtn = document.getElementById('discoverPropsBtn');
const propertiesLoadingEl = document.getElementById('propertiesLoading');
const propertiesBodyEl = document.getElementById('propertiesBody');
const noPropertiesEl = document.getElementById('noProperties');
const propertiesTableEl = document.getElementById('propertiesTable');

// Property Modal Elements
const propertyModal = document.getElementById('propertyModal');
const propertyNameEl = document.getElementById('propertyName');
const propertyTypeEl = document.getElementById('propertyType');
const propertySamplesEl = document.getElementById('propertySamples');
const propertyDescriptionEl = document.getElementById('propertyDescription');
const discoverValuesBtn = document.getElementById('discoverValuesBtn');
const savePropDescBtn = document.getElementById('savePropDescBtn');
const generatePropDescBtn = document.getElementById('generatePropDescBtn');

// LLM Modal Elements
const llmModal = document.getElementById('llmModal');
const llmStep1 = document.getElementById('llmStep1');
const llmStep2 = document.getElementById('llmStep2');
const llmLoading = document.getElementById('llmLoading');
const llmContext = document.getElementById('llmContext');
const llmGeneratedDescription = document.getElementById('llmGeneratedDescription');
const llmGenerateBtn = document.getElementById('llmGenerateBtn');
const llmSaveBtn = document.getElementById('llmSaveBtn');

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
  // Get event ID from URL
  const params = new URLSearchParams(window.location.search);
  eventId = parseInt(params.get('id'));

  if (!eventId) {
    showError('No event ID provided');
    return;
  }

  // Event listeners
  saveDescBtn.addEventListener('click', handleSaveDescription);
  generateDescBtn.addEventListener('click', () => openLlmModal(eventId, 'event'));
  discoverPropsBtn.addEventListener('click', handleDiscoverProperties);
  discoverValuesBtn.addEventListener('click', handleDiscoverValues);
  savePropDescBtn.addEventListener('click', handleSavePropertyDescription);
  generatePropDescBtn.addEventListener('click', () => {
    closePropertyModal();
    openLlmModal(currentProperty.id, 'property');
  });
  llmGenerateBtn.addEventListener('click', handleLlmGenerate);
  llmSaveBtn.addEventListener('click', handleLlmSave);

  await loadEvent();
}

async function loadEvent() {
  showLoading();

  try {
    const data = await getEvent(eventId);
    event = data.event;
    properties = data.properties;
    renderEvent();
    renderProperties();
    showContent();
  } catch (error) {
    showError(error.message);
  }
}

function renderEvent() {
  eventNameEl.textContent = event.name;
  eventDescriptionEl.value = event.description || '';

  if (event.description_source && event.description_source !== 'none') {
    eventSourceEl.textContent = event.description_source;
    eventSourceEl.className = `source-badge ${event.description_source}`;
    eventSourceEl.classList.remove('hidden');
  } else {
    eventSourceEl.classList.add('hidden');
  }

  document.title = `${event.name} - Schema Manager`;
}

function renderProperties() {
  if (properties.length === 0) {
    propertiesTableEl.classList.add('hidden');
    noPropertiesEl.classList.remove('hidden');
    return;
  }

  noPropertiesEl.classList.add('hidden');
  propertiesTableEl.classList.remove('hidden');

  propertiesBodyEl.innerHTML = properties.map(prop => {
    const samples = prop.sample_values ? JSON.parse(prop.sample_values) : [];
    const sampleText = samples.slice(0, 3).join(', ');

    return `
      <tr>
        <td>${escapeHtml(prop.name)}</td>
        <td>${prop.data_type || '-'}</td>
        <td class="${!prop.description ? 'no-desc' : ''}">
          ${prop.description ? escapeHtml(prop.description) : 'No description'}
        </td>
        <td class="samples truncate">${sampleText || '-'}</td>
        <td>
          <button class="btn btn-small btn-secondary" onclick="openPropertyModal(${prop.id})">
            Edit
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

async function handleSaveDescription() {
  const description = eventDescriptionEl.value.trim();

  try {
    await updateEventDescription(eventId, description, 'manual');
    event.description = description;
    event.description_source = 'manual';
    renderEvent();
    alert('Description saved');
  } catch (error) {
    alert('Error saving description: ' + error.message);
  }
}

async function handleDiscoverProperties() {
  discoverPropsBtn.disabled = true;
  discoverPropsBtn.textContent = 'Discovering...';
  propertiesLoadingEl.classList.remove('hidden');

  try {
    await discoverProperties(eventId);
    await loadEvent();
  } catch (error) {
    alert('Error discovering properties: ' + error.message);
  } finally {
    discoverPropsBtn.disabled = false;
    discoverPropsBtn.textContent = 'Discover Properties';
    propertiesLoadingEl.classList.add('hidden');
  }
}

// Property Modal
function openPropertyModal(propertyId) {
  currentProperty = properties.find(p => p.id === propertyId);
  if (!currentProperty) return;

  propertyNameEl.value = currentProperty.name;
  propertyTypeEl.value = currentProperty.data_type || 'Unknown';
  propertyDescriptionEl.value = currentProperty.description || '';

  const samples = currentProperty.sample_values ? JSON.parse(currentProperty.sample_values) : [];
  propertySamplesEl.innerHTML = samples.length > 0
    ? samples.map(s => `<span>${escapeHtml(String(s))}</span>`).join(', ')
    : '';

  propertyModal.classList.remove('hidden');
}

function closePropertyModal() {
  propertyModal.classList.add('hidden');
  currentProperty = null;
}

async function handleDiscoverValues() {
  if (!currentProperty) return;

  discoverValuesBtn.disabled = true;
  discoverValuesBtn.textContent = 'Discovering...';

  try {
    const result = await discoverValues(currentProperty.id);
    propertySamplesEl.innerHTML = result.values.slice(0, 10).map(v =>
      `<span>${escapeHtml(String(v))}</span>`
    ).join(', ');
    propertyTypeEl.value = result.dataType || 'Unknown';

    // Update local data
    currentProperty.sample_values = JSON.stringify(result.values);
    currentProperty.data_type = result.dataType;
  } catch (error) {
    alert('Error discovering values: ' + error.message);
  } finally {
    discoverValuesBtn.disabled = false;
    discoverValuesBtn.textContent = 'Discover Values';
  }
}

async function handleSavePropertyDescription() {
  if (!currentProperty) return;

  const description = propertyDescriptionEl.value.trim();

  try {
    await updatePropertyDescription(currentProperty.id, description, 'manual');
    currentProperty.description = description;
    currentProperty.description_source = 'manual';
    renderProperties();
    closePropertyModal();
  } catch (error) {
    alert('Error saving description: ' + error.message);
  }
}

// LLM Modal
function openLlmModal(id, type) {
  currentLlmTarget = { id, type };

  // Reset modal state
  llmStep1.classList.remove('hidden');
  llmStep2.classList.add('hidden');
  llmLoading.classList.add('hidden');

  // Show what will be sent
  let contextData;
  if (type === 'event') {
    contextData = {
      type: 'event',
      name: event.name,
      properties: properties.map(p => p.name).slice(0, 10)
    };
  } else {
    const prop = properties.find(p => p.id === id);
    contextData = {
      type: 'property',
      name: prop?.name,
      eventName: event.name,
      sampleValues: prop?.sample_values ? JSON.parse(prop.sample_values).slice(0, 5) : []
    };
  }

  llmContext.textContent = JSON.stringify(contextData, null, 2);
  llmModal.classList.remove('hidden');
}

function closeLlmModal() {
  llmModal.classList.add('hidden');
  currentLlmTarget = null;
}

async function handleLlmGenerate() {
  if (!currentLlmTarget) return;

  llmStep1.classList.add('hidden');
  llmLoading.classList.remove('hidden');

  try {
    const result = await previewLlmDescription(currentLlmTarget.type, currentLlmTarget.id);
    llmGeneratedDescription.value = result.description;
    llmLoading.classList.add('hidden');
    llmStep2.classList.remove('hidden');
  } catch (error) {
    alert('Error generating description: ' + error.message);
    llmLoading.classList.add('hidden');
    llmStep1.classList.remove('hidden');
  }
}

async function handleLlmSave() {
  if (!currentLlmTarget) return;

  const description = llmGeneratedDescription.value.trim();

  try {
    await confirmLlmDescription(currentLlmTarget.type, currentLlmTarget.id, description);
    closeLlmModal();
    await loadEvent();
  } catch (error) {
    alert('Error saving description: ' + error.message);
  }
}

// UI Helpers
function showLoading() {
  loadingEl.classList.remove('hidden');
  errorEl.classList.add('hidden');
  contentEl.classList.add('hidden');
}

function showContent() {
  loadingEl.classList.add('hidden');
  errorEl.classList.add('hidden');
  contentEl.classList.remove('hidden');
}

function showError(message) {
  loadingEl.classList.add('hidden');
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
  contentEl.classList.add('hidden');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
