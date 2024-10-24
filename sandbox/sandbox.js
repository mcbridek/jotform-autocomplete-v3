// Sandbox-specific JavaScript
const widgetFrame = document.getElementById('widgetFrame');
const consoleOutput = document.getElementById('consoleOutput');
const suggestionsDisplay = document.getElementById('suggestionsDisplay');
const fetchedDataDisplay = document.getElementById('fetchedDataDisplay');

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
    scriptId: document.getElementById('scriptId').value,
    sheetName: document.getElementById('sheetName').value,
    placeholderText: document.getElementById('placeholderText').value,
    minCharRequired: parseInt(document.getElementById('minCharRequired').value),
    maxResults: parseInt(document.getElementById('maxResults').value),
    inputWidth: document.getElementById('inputWidth').value,
    autocompleteWidth: document.getElementById('autocompleteWidth').value,
    dynamicResize: document.getElementById('dynamicResize').checked
  };

  // Send settings to the iframe
  widgetFrame.contentWindow.postMessage({ type: 'updateSettings', settings: settings }, '*');
}

// Listen for messages from the iframe
window.addEventListener('message', function(event) {
  const data = event.data;
  logToConsole(`Received message of type: ${data.type}`);
  
  switch(data.type) {
    case 'log':
      logToConsole(data.message);
      break;
      
    case 'error':
      logToConsole('ERROR: ' + data.message, true);
      break;
      
    case 'fetchedData':
      logToConsole('Received fetched data');
      displayFetchedData(data.data);
      break;
      
    case 'suggestionsUpdated':
      logToConsole('Suggestions updated');
      displaySuggestions(data.suggestions, data.query);
      break;
      
    case 'resize':
      logToConsole('Resize requested: ' + data.height + 'px');
      widgetFrame.style.height = `${data.height}px`;
      break;
      
    default:
      logToConsole('Unknown message type: ' + data.type);
  }
});

function logToConsole(message, isError = false) {
    const logEntry = document.createElement('div');
    logEntry.className = isError ? 'error-log' : 'log-entry';
    
    // If the message is an object, stringify it
    if (typeof message === 'object') {
        try {
            message = JSON.stringify(message, null, 2);
        } catch (e) {
            message = '[Complex Object]';
        }
    }
    
    const timestamp = new Date().toLocaleTimeString();
    logEntry.innerHTML = `<span class="timestamp">[${timestamp}]</span> ${message}`;
    consoleOutput.appendChild(logEntry);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

function displayFetchedData(data) {
    console.log('Displaying fetched data:', data);
    try {
        fetchedDataDisplay.innerHTML = `
            <div class="data-info">
                <p>Data received at: ${new Date().toLocaleTimeString()}</p>
                <p>Number of rows: ${data.rows ? data.rows.length : 0}</p>
                <p>Columns: ${data.cols ? data.cols.map(col => col.label).join(', ') : 'None'}</p>
            </div>
            <pre>${JSON.stringify(data, null, 2)}</pre>
        `;
    } catch (error) {
        fetchedDataDisplay.innerHTML = `<div class="error">Error displaying data: ${error.message}</div>`;
    }
}

function displaySuggestions(suggestions, query) {
  suggestionsDisplay.innerHTML = `
    <div class="suggestions-info">
      <p>Query: "${query}"</p>
      <p>Results: ${suggestions.length}</p>
    </div>
    <ul class="suggestions-list">
      ${suggestions.map(suggestion => `<li>${suggestion}</li>`).join('')}
    </ul>
  `;
}

// Clear console button
const clearConsoleButton = document.createElement('button');
clearConsoleButton.textContent = 'Clear Console';
clearConsoleButton.onclick = () => {
  consoleOutput.innerHTML = '';
};
document.querySelector('.log-section').insertBefore(clearConsoleButton, consoleOutput);

// Add a clear log button
const clearLogButton = document.createElement('button');
clearLogButton.textContent = 'Clear Log';
clearLogButton.onclick = () => {
    consoleOutput.innerHTML = '';
};
document.querySelector('.log-section').insertBefore(clearLogButton, consoleOutput);

// Add a test button to manually trigger data fetch
const testFetchButton = document.createElement('button');
testFetchButton.textContent = 'Test Fetch Data';
testFetchButton.onclick = () => {
    logToConsole('Manually triggering data fetch...');
    const settings = {
        sheetName: document.getElementById('sheetName').value
    };
    widgetFrame.contentWindow.postMessage({
        type: 'updateSettings',
        settings: settings
    }, '*');
};
document.querySelector('.settings-form').appendChild(testFetchButton);

// Add direct fetch test
const directFetchButton = document.createElement('button');
directFetchButton.textContent = 'Direct API Test';
directFetchButton.onclick = async () => {
    const scriptId = document.getElementById('scriptId').value;
    const sheetName = document.getElementById('sheetName').value;
    const url = `https://script.google.com/macros/s/${scriptId}/exec?path=${encodeURIComponent(sheetName)}`;
    
    logToConsole('Testing direct API call to: ' + url);
    
    try {
        const response = await fetch(url);
        const text = await response.text();
        logToConsole('Raw API Response: ' + text);
        
        try {
            const json = JSON.parse(text);
            logToConsole('Parsed JSON: ' + JSON.stringify(json, null, 2));
        } catch (e) {
            logToConsole('Failed to parse JSON: ' + e.message, true);
        }
    } catch (error) {
        logToConsole('Fetch error: ' + error.message, true);
    }
};
document.querySelector('.settings-form').appendChild(directFetchButton);
