// Events List Page

let events = [];
let currentLlmTarget = null;

// DOM Elements
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const contentEl = document.getElementById('content');
const eventsBodyEl = document.getElementById('eventsBody');
const emptyStateEl = document.getElementById('emptyState');
const eventCountEl = document.getElementById('eventCount');
const propertyCountEl = document.getElementById('propertyCount');
const discoverAllBtn = document.getElementById('discoverAllBtn');

// LLM Modal Elements
const llmModal = document.getElementById('llmModal');
const modalStep1 = document.getElementById('modalStep1');
const modalStep2 = document.getElementById('modalStep2');
const modalLoading = document.getElementById('modalLoading');
const modalContext = document.getElementById('modalContext');
const generatedDescription = document.getElementById('generatedDescription');
const generateBtn = document.getElementById('generateBtn');
const saveDescriptionBtn = document.getElementById('saveDescriptionBtn');

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
  discoverAllBtn.addEventListener('click', handleDiscoverAll);
  generateBtn.addEventListener('click', handleGenerate);
  saveDescriptionBtn.addEventListener('click', handleSaveDescription);

  await loadEvents();
}

async function loadEvents() {
  showLoading();

  try {
    const data = await getEvents();
    events = data.events;
    renderEvents();
    showContent();
  } catch (error) {
    showError(error.message);
  }
}

function renderEvents() {
  if (events.length === 0) {
    eventsBodyEl.innerHTML = '';
    emptyStateEl.classList.remove('hidden');
    document.querySelector('.events-table').classList.add('hidden');
    eventCountEl.textContent = '0 events';
    propertyCountEl.textContent = '0 total properties';
    return;
  }

  emptyStateEl.classList.add('hidden');
  document.querySelector('.events-table').classList.remove('hidden');

  const totalProperties = events.reduce((sum, e) => sum + (e.property_count || 0), 0);
  eventCountEl.textContent = `${events.length} events`;
  propertyCountEl.textContent = `${totalProperties} total properties`;

  eventsBodyEl.innerHTML = events.map(event => `
    <tr>
      <td><a href="event.html?id=${event.id}">${escapeHtml(event.name)}</a></td>
      <td class="truncate ${!event.description ? 'no-desc' : ''}">
        ${event.description ? escapeHtml(event.description) : 'No description'}
      </td>
      <td>${event.property_count || 0}</td>
      <td class="usage-count">${formatNumber(event.event_count)}</td>
      <td>
        <button class="btn btn-small btn-secondary" onclick="openLlmModal(${event.id}, 'event')">
          AI Describe
        </button>
      </td>
    </tr>
  `).join('');
}

async function handleDiscoverAll() {
  discoverAllBtn.disabled = true;
  discoverAllBtn.textContent = 'Discovering...';

  try {
    const result = await discoverAll();
    alert(`Discovered ${result.eventCount} events and ${result.propertyCount} properties`);
    await loadEvents();
  } catch (error) {
    showError(error.message);
  } finally {
    discoverAllBtn.disabled = false;
    discoverAllBtn.textContent = 'Discover All';
  }
}

// LLM Modal Functions
function openLlmModal(id, type) {
  currentLlmTarget = { id, type };

  // Reset modal state
  modalStep1.classList.remove('hidden');
  modalStep2.classList.add('hidden');
  modalLoading.classList.add('hidden');

  // Show what will be sent
  const event = events.find(e => e.id === id);
  modalContext.textContent = JSON.stringify({
    type: 'event',
    name: event?.name,
    note: 'Properties and sample values will be included if available'
  }, null, 2);

  llmModal.classList.remove('hidden');
}

function closeLlmModal() {
  llmModal.classList.add('hidden');
  currentLlmTarget = null;
}

async function handleGenerate() {
  if (!currentLlmTarget) return;

  modalStep1.classList.add('hidden');
  modalLoading.classList.remove('hidden');

  try {
    const result = await previewLlmDescription(currentLlmTarget.type, currentLlmTarget.id);
    generatedDescription.value = result.description;
    modalLoading.classList.add('hidden');
    modalStep2.classList.remove('hidden');
  } catch (error) {
    alert('Error generating description: ' + error.message);
    modalLoading.classList.add('hidden');
    modalStep1.classList.remove('hidden');
  }
}

async function handleSaveDescription() {
  if (!currentLlmTarget) return;

  const description = generatedDescription.value.trim();

  try {
    await confirmLlmDescription(currentLlmTarget.type, currentLlmTarget.id, description);
    closeLlmModal();
    await loadEvents();
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

function formatNumber(num) {
  if (!num) return '-';
  return num.toLocaleString();
}
