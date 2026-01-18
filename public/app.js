document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('query-form');
  const input = document.getElementById('query-input');
  const submitBtn = document.getElementById('submit-btn');
  const results = document.getElementById('results');
  const errorContainer = document.getElementById('error-container');

  // View elements
  const formattedView = document.getElementById('formatted-view');
  const jsonView = document.getElementById('json-view');
  const toggleBtns = document.querySelectorAll('.toggle-btn');

  // Result elements
  const summaryText = document.getElementById('summary-text');
  const dataTableContainer = document.getElementById('data-table-container');
  const dataChartContainer = document.getElementById('data-chart-container');
  const dataChartCanvas = document.getElementById('data-chart');
  const dataToggleBtns = document.querySelectorAll('.data-toggle-btn');
  const jsonOutput = document.getElementById('json-output');

  // Debug elements
  const tokenBadge = document.getElementById('token-badge');
  const interpretationTokens = document.getElementById('interpretation-tokens');
  const interpretationRequest = document.getElementById('interpretation-request');
  const interpretationResponse = document.getElementById('interpretation-response');
  const summarizationTokens = document.getElementById('summarization-tokens');
  const summarizationRequest = document.getElementById('summarization-request');
  const summarizationResponse = document.getElementById('summarization-response');
  const mixpanelRequest = document.getElementById('mixpanel-request');
  const mixpanelResponse = document.getElementById('mixpanel-response');

  // Error elements
  const errorMessage = document.getElementById('error-message');
  const errorDetails = document.getElementById('error-details');

  // History elements
  const historySection = document.getElementById('history-section');
  const historyList = document.getElementById('history-list');
  const clearHistoryBtn = document.getElementById('clear-history');
  const autocompleteList = document.getElementById('autocomplete-list');

  let currentResponse = null;
  let currentData = null;
  let currentChart = null;
  let selectedAutocompleteIndex = -1;
  const HISTORY_KEY = 'mixpanel-query-history';
  const MAX_HISTORY = 20;

  // History functions
  function getHistory() {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
    } catch {
      return [];
    }
  }

  function saveToHistory(query) {
    const history = getHistory();
    // Remove if already exists (to move to top)
    const filtered = history.filter(q => q !== query);
    // Add to beginning
    filtered.unshift(query);
    // Keep only MAX_HISTORY items
    const trimmed = filtered.slice(0, MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
    renderHistory();
  }

  function clearHistory() {
    localStorage.removeItem(HISTORY_KEY);
    renderHistory();
  }

  function renderHistory() {
    const history = getHistory();
    historyList.innerHTML = '';

    if (history.length === 0) {
      historySection.hidden = true;
      return;
    }

    historySection.hidden = false;
    history.forEach(query => {
      const li = document.createElement('li');
      li.textContent = query;
      li.addEventListener('click', () => {
        input.value = query;
        input.focus();
        hideAutocomplete();
      });
      historyList.appendChild(li);
    });
  }

  // Autocomplete functions
  function showAutocomplete(filter = '') {
    const history = getHistory();
    const filterLower = filter.toLowerCase();
    const matches = filter
      ? history.filter(q => q.toLowerCase().includes(filterLower))
      : history;

    if (matches.length === 0) {
      hideAutocomplete();
      return;
    }

    autocompleteList.innerHTML = '';
    selectedAutocompleteIndex = -1;

    matches.slice(0, 8).forEach((query, index) => {
      const li = document.createElement('li');

      // Highlight matching text
      if (filter) {
        const idx = query.toLowerCase().indexOf(filterLower);
        if (idx >= 0) {
          li.innerHTML =
            escapeHtml(query.slice(0, idx)) +
            '<span class="match">' + escapeHtml(query.slice(idx, idx + filter.length)) + '</span>' +
            escapeHtml(query.slice(idx + filter.length));
        } else {
          li.textContent = query;
        }
      } else {
        li.textContent = query;
      }

      li.addEventListener('click', () => {
        input.value = query;
        hideAutocomplete();
        form.dispatchEvent(new Event('submit'));
      });
      li.addEventListener('mouseenter', () => {
        selectedAutocompleteIndex = index;
        updateAutocompleteSelection();
      });
      autocompleteList.appendChild(li);
    });

    autocompleteList.hidden = false;
  }

  function hideAutocomplete() {
    autocompleteList.hidden = true;
    selectedAutocompleteIndex = -1;
  }

  function updateAutocompleteSelection() {
    const items = autocompleteList.querySelectorAll('li');
    items.forEach((item, idx) => {
      item.classList.toggle('selected', idx === selectedAutocompleteIndex);
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Input event handlers for autocomplete
  input.addEventListener('input', () => {
    const value = input.value.trim();
    if (value) {
      showAutocomplete(value);
    } else {
      showAutocomplete();
    }
  });

  input.addEventListener('focus', () => {
    if (getHistory().length > 0) {
      showAutocomplete(input.value.trim());
    }
  });

  input.addEventListener('keydown', (e) => {
    if (autocompleteList.hidden) return;

    const items = autocompleteList.querySelectorAll('li');
    if (items.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedAutocompleteIndex = Math.min(selectedAutocompleteIndex + 1, items.length - 1);
      updateAutocompleteSelection();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedAutocompleteIndex = Math.max(selectedAutocompleteIndex - 1, -1);
      updateAutocompleteSelection();
    } else if (e.key === 'Enter' && selectedAutocompleteIndex >= 0) {
      e.preventDefault();
      input.value = items[selectedAutocompleteIndex].textContent;
      hideAutocomplete();
      form.dispatchEvent(new Event('submit'));
    } else if (e.key === 'Escape') {
      hideAutocomplete();
    }
  });

  // Hide autocomplete when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.input-wrapper')) {
      hideAutocomplete();
    }
  });

  // Clear history button
  clearHistoryBtn.addEventListener('click', clearHistory);

  // Initialize history display
  renderHistory();

  // Handle form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = input.value.trim();
    if (!query) return;

    hideAutocomplete();
    setLoading(true);
    hideError();
    results.hidden = true;

    try {
      const response = await fetch(`/query?q=${encodeURIComponent(query)}`);
      const data = await response.json();

      if (!data.success) {
        showError(data.error, data.details);
        return;
      }

      // Save successful query to history
      saveToHistory(query);

      currentResponse = data;
      renderResults(data);
      results.hidden = false;
    } catch (err) {
      showError('Network error', err.message);
    } finally {
      setLoading(false);
    }
  });

  // Handle view toggle
  toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      toggleBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (view === 'formatted') {
        formattedView.hidden = false;
        jsonView.hidden = true;
      } else {
        formattedView.hidden = true;
        jsonView.hidden = false;
      }
    });
  });

  // Handle data view toggle (table/chart)
  dataToggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      dataToggleBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (view === 'table') {
        dataTableContainer.hidden = false;
        dataChartContainer.hidden = true;
      } else {
        dataTableContainer.hidden = true;
        dataChartContainer.hidden = false;
        if (currentData) {
          renderChart(currentData);
        }
      }
    });
  });

  function setLoading(loading) {
    submitBtn.disabled = loading;
    submitBtn.querySelector('.btn-text').hidden = loading;
    submitBtn.querySelector('.btn-loading').hidden = !loading;
    document.body.classList.toggle('loading', loading);
  }

  function showError(message, details) {
    errorMessage.textContent = message;
    errorDetails.textContent = details || '';
    errorContainer.hidden = false;
  }

  function hideError() {
    errorContainer.hidden = true;
  }

  function renderResults(data) {
    // Render summary
    summaryText.textContent = data.summary;

    // Store data for chart rendering
    currentData = data.data;

    // Reset to table view
    dataToggleBtns.forEach(b => b.classList.remove('active'));
    dataToggleBtns[0].classList.add('active');
    dataTableContainer.hidden = false;
    dataChartContainer.hidden = true;

    // Destroy existing chart
    if (currentChart) {
      currentChart.destroy();
      currentChart = null;
    }

    // Render data table
    renderDataTable(data.data);

    // Render JSON view
    const jsonStr = JSON.stringify(data, null, 2);
    jsonOutput.textContent = jsonStr;
    hljs.highlightElement(jsonOutput);

    // Render debug info
    if (data.debug) {
      renderDebugInfo(data.debug);
    }
  }

  function renderDataTable(data) {
    dataTableContainer.innerHTML = '';

    if (!data || typeof data !== 'object') {
      dataTableContainer.innerHTML = '<p>No data available</p>';
      return;
    }

    // Handle different data structures
    if (data.data && typeof data.data === 'object') {
      // Segmentation data format: { data: { values: {...}, series: [...] } }
      if (data.data.values) {
        renderSegmentationData(data.data);
        return;
      }
    }

    // Handle array of objects
    if (Array.isArray(data)) {
      if (data.length === 0) {
        dataTableContainer.innerHTML = '<p>No results found</p>';
        return;
      }
      renderTable(data);
      return;
    }

    // Handle events list
    if (data.events && Array.isArray(data.events)) {
      renderEventsTable(data.events);
      return;
    }

    // Fallback: render as formatted JSON
    const pre = document.createElement('pre');
    const code = document.createElement('code');
    code.className = 'language-json';
    code.textContent = JSON.stringify(data, null, 2);
    pre.appendChild(code);
    dataTableContainer.appendChild(pre);
    hljs.highlightElement(code);
  }

  function renderSegmentationData(data) {
    const { values, series } = data;

    if (!values || !series || series.length === 0) {
      dataTableContainer.innerHTML = '<p>No data points available</p>';
      return;
    }

    // Get all event names
    const eventNames = Object.keys(values);
    if (eventNames.length === 0) {
      dataTableContainer.innerHTML = '<p>No events in data</p>';
      return;
    }

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');

    // Header row
    const headerRow = document.createElement('tr');
    const dateHeader = document.createElement('th');
    dateHeader.textContent = 'Date';
    headerRow.appendChild(dateHeader);

    eventNames.forEach(name => {
      const th = document.createElement('th');
      th.textContent = name;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    // Data rows
    series.forEach(date => {
      const row = document.createElement('tr');
      const dateCell = document.createElement('td');
      dateCell.textContent = date;
      row.appendChild(dateCell);

      eventNames.forEach(name => {
        const td = document.createElement('td');
        const value = values[name]?.[date];
        td.textContent = value !== undefined ? formatNumber(value) : '-';
        row.appendChild(td);
      });
      tbody.appendChild(row);
    });

    table.appendChild(thead);
    table.appendChild(tbody);
    dataTableContainer.appendChild(table);
  }

  function renderEventsTable(events) {
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');

    // Header
    const headerRow = document.createElement('tr');
    ['Event Name', 'Count'].forEach(text => {
      const th = document.createElement('th');
      th.textContent = text;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    // Data
    events.forEach(event => {
      const row = document.createElement('tr');
      const nameCell = document.createElement('td');
      nameCell.textContent = event.event || event.name || event;
      row.appendChild(nameCell);

      const countCell = document.createElement('td');
      countCell.textContent = event.count !== undefined ? formatNumber(event.count) : '-';
      row.appendChild(countCell);

      tbody.appendChild(row);
    });

    table.appendChild(thead);
    table.appendChild(tbody);
    dataTableContainer.appendChild(table);
  }

  function renderTable(arr) {
    if (arr.length === 0) return;

    const keys = Object.keys(arr[0]);
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');

    // Header
    const headerRow = document.createElement('tr');
    keys.forEach(key => {
      const th = document.createElement('th');
      th.textContent = key;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    // Data
    arr.forEach(item => {
      const row = document.createElement('tr');
      keys.forEach(key => {
        const td = document.createElement('td');
        const val = item[key];
        td.textContent = typeof val === 'number' ? formatNumber(val) : String(val);
        row.appendChild(td);
      });
      tbody.appendChild(row);
    });

    table.appendChild(thead);
    table.appendChild(tbody);
    dataTableContainer.appendChild(table);
  }

  function renderDebugInfo(debug) {
    // Total tokens badge
    tokenBadge.textContent = `${debug.total_tokens} tokens`;

    // Interpretation
    if (debug.openai_interpretation) {
      const interp = debug.openai_interpretation;
      interpretationTokens.textContent = `${interp.tokens.input} in / ${interp.tokens.output} out / ${interp.tokens.total} total`;
      setCodeContent(interpretationRequest, interp.request);
      setCodeContent(interpretationResponse, interp.response);
    }

    // Summarization
    if (debug.openai_summarization) {
      const summ = debug.openai_summarization;
      summarizationTokens.textContent = `${summ.tokens.input} in / ${summ.tokens.output} out / ${summ.tokens.total} total`;
      setCodeContent(summarizationRequest, summ.request);
      setCodeContent(summarizationResponse, summ.response);
    }

    // Mixpanel
    if (debug.mixpanel) {
      setCodeContent(mixpanelRequest, {
        url: debug.mixpanel.url,
        method: debug.mixpanel.method,
        params: debug.mixpanel.params
      });
      setCodeContent(mixpanelResponse, debug.mixpanel.response);
    }
  }

  function setCodeContent(element, data) {
    element.textContent = JSON.stringify(data, null, 2);
    hljs.highlightElement(element);
  }

  function formatNumber(num) {
    if (typeof num !== 'number') return num;
    return num.toLocaleString();
  }

  // Chart rendering
  const CHART_COLORS = [
    '#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
    '#8b5cf6', '#06b6d4', '#84cc16', '#f97316', '#ec4899'
  ];

  function renderChart(data) {
    // Destroy existing chart
    if (currentChart) {
      currentChart.destroy();
      currentChart = null;
    }

    if (!data || typeof data !== 'object') {
      return;
    }

    // Handle segmentation data format
    if (data.data && data.data.values && data.data.series) {
      renderSegmentationChart(data.data);
      return;
    }

    // Handle events list
    if (data.events && Array.isArray(data.events)) {
      renderEventsChart(data.events);
      return;
    }

    // Handle array of objects with numeric values
    if (Array.isArray(data) && data.length > 0) {
      renderArrayChart(data);
      return;
    }
  }

  function renderSegmentationChart(data) {
    const { values, series } = data;
    const eventNames = Object.keys(values);

    if (eventNames.length === 0 || series.length === 0) return;

    const datasets = eventNames.map((name, index) => ({
      label: name,
      data: series.map(date => values[name]?.[date] || 0),
      borderColor: CHART_COLORS[index % CHART_COLORS.length],
      backgroundColor: CHART_COLORS[index % CHART_COLORS.length] + '20',
      tension: 0.3,
      fill: eventNames.length === 1
    }));

    currentChart = new Chart(dataChartCanvas, {
      type: 'line',
      data: {
        labels: series,
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: eventNames.length > 1,
            position: 'top'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: value => formatNumber(value)
            }
          }
        }
      }
    });
  }

  function renderEventsChart(events) {
    const sortedEvents = [...events]
      .sort((a, b) => (b.count || 0) - (a.count || 0))
      .slice(0, 15);

    const labels = sortedEvents.map(e => e.event || e.name || String(e));
    const data = sortedEvents.map(e => e.count || 0);

    currentChart = new Chart(dataChartCanvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Event Count',
          data,
          backgroundColor: CHART_COLORS.slice(0, labels.length),
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: {
              callback: value => formatNumber(value)
            }
          }
        }
      }
    });
  }

  function renderArrayChart(arr) {
    const keys = Object.keys(arr[0]);
    const numericKeys = keys.filter(k => typeof arr[0][k] === 'number');
    const labelKey = keys.find(k => typeof arr[0][k] === 'string') || keys[0];

    if (numericKeys.length === 0) return;

    const labels = arr.map(item => String(item[labelKey])).slice(0, 20);
    const datasets = numericKeys.slice(0, 5).map((key, index) => ({
      label: key,
      data: arr.map(item => item[key] || 0).slice(0, 20),
      backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
      borderRadius: 4
    }));

    currentChart = new Chart(dataChartCanvas, {
      type: 'bar',
      data: {
        labels,
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: numericKeys.length > 1,
            position: 'top'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: value => formatNumber(value)
            }
          }
        }
      }
    });
  }
});
