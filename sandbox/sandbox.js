// Sandbox-specific JavaScript
const widgetFrame = document.getElementById('widgetFrame');

// Mock data for testing
const mockData = [
  { name: "John Doe", email: "john@example.com", phone: "123-456-7890" },
  { name: "Jane Smith", email: "jane@example.com", phone: "098-765-4321" },
  { name: "Alice Johnson", email: "alice@example.com", phone: "111-222-3333" },
  { name: "Bob Williams", email: "bob@example.com", phone: "444-555-6666" },
  { name: "Charlie Brown", email: "charlie@example.com", phone: "777-888-9999" }
];

function updateWidgetSettings() {
  const settings = {
    googleSheetId: document.getElementById('googleSheetId').value,
    sheetName: document.getElementById('sheetName').value,
    placeholderText: document.getElementById('placeholderText').value,
    inputWidth: document.getElementById('inputWidth').value,
    autocompleteWidth: document.getElementById('autocompleteWidth').value,
    dynamicResize: document.getElementById('dynamicResize').checked
  };

  // Send settings to the iframe
  widgetFrame.contentWindow.postMessage({ type: 'updateSettings', settings: settings }, '*');

  adjustIframeHeight();
}

// Listen for messages from the iframe
window.addEventListener('message', function(event) {
  console.log('Received message:', event.data);
  if (event.data.type === 'log') {
    console.log('Widget log:', event.data.message);
    logToUI(event.data.message);
  } else if (event.data.type === 'error') {
    console.error('Widget error:', event.data.message);
    logToUI('ERROR: ' + event.data.message, true);
  } else if (event.data.type === 'resize') {
    widgetFrame.style.height = event.data.height + 'px';
  } else if (event.data.type === 'fetchedData') {
    console.log('Fetched data:', event.data.data);
    displayFetchedData(event.data.data);
  } else if (event.data.type === 'suggestionsUpdated') {
    console.log('Suggestions updated:', event.data.suggestions);
    displaySuggestions(event.data.suggestions, event.data.query);
  }
});

function logToUI(message, isError = false) {
  const logElement = document.createElement('div');
  logElement.textContent = message;
  if (isError) {
    logElement.style.color = 'red';
  }
  document.getElementById('fullResultsDump').appendChild(logElement);
}

function adjustIframeHeight() {
  const previewSection = document.querySelector('.preview-section');
  const iframe = document.getElementById('widgetFrame');
  iframe.style.height = (previewSection.clientHeight - 60) + 'px'; // Subtracting 60px for padding and heading
}

function displayFetchedData(data) {
  const dataDisplay = document.getElementById('fetchedDataDisplay');
  dataDisplay.innerHTML = '<h4>Fetched Data:</h4>';
  const pre = document.createElement('pre');
  pre.textContent = JSON.stringify(data, null, 2);
  dataDisplay.appendChild(pre);
}

function displaySuggestions(suggestions, query) {
  const suggestionsDisplay = document.getElementById('suggestionsDisplay');
  suggestionsDisplay.innerHTML = '<h4>Current Suggestions:</h4>';
  if (suggestions.length === 0) {
    suggestionsDisplay.innerHTML += '<p>No suggestions for: ' + query + '</p>';
  } else {
    const ul = document.createElement('ul');
    suggestions.forEach(suggestion => {
      const li = document.createElement('li');
      li.textContent = JSON.stringify(suggestion);
      ul.appendChild(li);
    });
    suggestionsDisplay.appendChild(ul);
  }
}

// Initialize the widget when the page loads
window.addEventListener('load', function() {
  updateWidgetSettings();
  adjustIframeHeight();
});

window.addEventListener('resize', adjustIframeHeight);
