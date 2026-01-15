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
  const mixpanelLink = document.getElementById('mixpanel-link');
  const dataTableContainer = document.getElementById('data-table-container');
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

  let currentResponse = null;

  // Handle form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = input.value.trim();
    if (!query) return;

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
    mixpanelLink.href = data.mixpanel_link;

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
});
