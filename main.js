// Add this function at the beginning of the file
function log(message, data) {
  console.log(message, JSON.stringify(data, null, 2));
}

// Default settings from widget.json
const defaultSettings = {
  googleSheetId: "1wvF2zjzJnUVeXl3s7Njo0EEEW_WQ1phqEeTGY2Vw_AI",
  columnIndex: 1,
  placeholderText: "Start typing...",
  inputWidth: "100%",
  autocompleteWidth: "100%",
  dynamicResize: true,
  threshold: 0.2,
  distance: 100,
  maxResults: 5,
  minCharRequired: 2, // Changed from 3 to 2
  debounceTime: 300
};

// Function to get settings, using defaults if JotForm is not available
function getWidgetSetting(settingName, parseFunc = (val) => val) {
  if (typeof JFCustomWidget !== 'undefined') {
    const setting = JFCustomWidget.getWidgetSetting(settingName);
    return setting !== undefined && setting !== '' ? parseFunc(setting) : defaultSettings[settingName];
  }
  return defaultSettings[settingName];
}

// Function to fetch data from a public Google Sheet (CSV format)
async function fetchGoogleSheetData(sheetId) {
  const corsProxy = 'https://cors-anywhere.herokuapp.com/';
  const url = sheetId === 'test' 
    ? 'https://jsonplaceholder.typicode.com/users'
    : `${corsProxy}https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;

  try {
    log('Fetching from URL:', url);
    const response = await fetch(url, {
      headers: {
        'X-Requested-With': 'XMLHttpRequest'
      }
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    let data;
    if (sheetId === 'test') {
      data = await response.json();
      log('Fetched test data:', data);
      return [['name', 'email']].concat(data.map(user => [user.name, user.email]));
    } else {
      const csvText = await response.text();
      log('Fetched CSV data:', csvText);
      const rows = csvText.split('\n').map(row => 
        row.split(',').map(cell => cell.replace(/^"|"$/g, '').trim())
      );
      log('Parsed CSV rows:', rows);
      return rows;
    }
  } catch (error) {
    console.error('Error fetching data:', error);
    console.error('Error details:', error.message, error.stack);
    return [];
  }
}

// Debounce function
function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

function getCorsProxyUrl(url) {
  return `https://cors-anywhere.herokuapp.com/${url}`;
}

// Initialize the widget
async function initializeWidget() {
  const input = document.getElementById('autocomplete-input');
  const suggestionsList = document.getElementById('suggestions-list');
  const spinner = document.getElementById('spinner');

  // Get widget settings
  const settings = {
    sheetId: getWidgetSetting('googleSheetId'),
    columnIndex: getWidgetSetting('columnIndex', parseInt),
    placeholderText: getWidgetSetting('placeholderText'),
    inputWidth: getWidgetSetting('inputWidth'),
    autocompleteWidth: getWidgetSetting('autocompleteWidth'),
    dynamicResize: getWidgetSetting('dynamicResize'),
    threshold: getWidgetSetting('threshold', parseFloat),
    distance: getWidgetSetting('distance', parseInt),
    maxResults: getWidgetSetting('maxResults', parseInt),
    minCharRequired: getWidgetSetting('minCharRequired', parseInt),
    debounceTime: getWidgetSetting('debounceTime', parseInt)
  };

  log('Widget settings:', settings);

  // Apply settings
  applyWidgetSettings(input, suggestionsList, settings);

  // Show spinner
  spinner.style.display = 'block';

  // Fetch data from Google Sheets
  console.log('Fetching data from Google Sheet:', settings.sheetId);
  const data = await fetchGoogleSheetData(settings.sheetId);
  log('Fetched data:', data);

  // Hide spinner
  spinner.style.display = 'none';

  if (data.length > 0) {
    initializeAutocomplete(input, suggestionsList, data, settings);
  } else {
    console.error('No data retrieved from Google Sheet.');
  }
}

function applyWidgetSettings(input, suggestionsList, settings) {
  input.style.width = settings.inputWidth;
  suggestionsList.style.width = settings.autocompleteWidth;
  input.placeholder = settings.placeholderText;
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-haspopup', 'listbox');
  suggestionsList.setAttribute('role', 'listbox');
}

function initializeAutocomplete(input, suggestionsList, data, settings) {
  if (!input || !suggestionsList) {
    console.error('Input or suggestions list element not found');
    return;
  }

  // Transform data into objects with 'name' property
  const columnData = data.slice(1).map(row => ({ name: row[settings.columnIndex] || '' }));

  log('Column data:', columnData);

  // Set up Fuse.js for fuzzy searching
  const fuse = new Fuse(columnData, {
    shouldSort: true,
    threshold: settings.threshold,
    distance: settings.distance,
    minMatchCharLength: settings.minCharRequired, // This will now be 2
    keys: ['name'],
    includeScore: true,
    includeMatches: true
  });

  log('Fuse instance created with options:', fuse.options);

  let selectedIndex = -1;
  const searchCache = {};
  let currentSuggestions = []; // Add this line to store current suggestions

  // Add event listener to the input with debounce
  input.addEventListener('input', debounce(onInputChange, settings.debounceTime));

  function onInputChange(e) {
    const searchTerm = e.target.value;
    log('Search term:', searchTerm);

    if (searchTerm.length >= settings.minCharRequired) {
      if (searchCache[searchTerm]) {
        log('Using cached results for:', searchTerm);
        displaySuggestions(searchCache[searchTerm]);
      } else {
        const results = fuse.search(searchTerm);
        log('Fuse search results:', results);
        searchCache[searchTerm] = results;
        displaySuggestions(results);
      }
    } else {
      clearSuggestions();
    }
    if (typeof JFCustomWidget !== 'undefined') {
      JFCustomWidget.sendSubmit({ value: input.value, valid: true });
    }
  }

  function clearSuggestions() {
    suggestionsList.style.display = 'none';
    suggestionsList.innerHTML = '';
    
    // Remove the class from the input when suggestions are cleared
    input.classList.remove('suggestions-visible');
    
    adjustIframeHeight(true);
  }

  function displaySuggestions(results) {
    log('Displaying suggestions:', results);

    currentSuggestions = results // Store current suggestions
      .sort((a, b) => a.score - b.score)
      .slice(0, settings.maxResults);

    log('Filtered suggestions:', currentSuggestions);

    // Clear previous suggestions
    suggestionsList.innerHTML = '';
    selectedIndex = -1;

    if (currentSuggestions.length === 0) {
      log('No suggestions found', {});
      clearSuggestions();
    } else {
      // Populate suggestions
      currentSuggestions.forEach((suggestion, index) => {
        const li = document.createElement('li');
        li.innerHTML = highlightMatch(suggestion);
        li.setAttribute('role', 'option');
        li.setAttribute('id', `suggestion-${index}`);
        li.addEventListener('mousedown', (e) => {
          e.preventDefault(); // Prevent the blur event from firing before the click
          selectSuggestion(suggestion);
        });
        suggestionsList.appendChild(li);
      });

      // Pre-select the first item
      selectedIndex = 0;
      updateSelection(suggestionsList.getElementsByTagName('li'));

      suggestionsList.style.display = 'block';
      suggestionsList.classList.add('visible');
      
      // Add a class to the input when suggestions are shown
      input.classList.add('suggestions-visible');
      
      adjustIframeHeight();

      log('Suggestions list style after display:', {
        display: suggestionsList.style.display,
        visibility: window.getComputedStyle(suggestionsList).visibility,
        offsetHeight: suggestionsList.offsetHeight,
        scrollHeight: suggestionsList.scrollHeight,
        classList: suggestionsList.classList
      });
    }
  }

  function highlightMatch(result) {
    const { item, matches } = result;
    let highlighted = item.name;
    if (matches && matches.length > 0) {
      matches.forEach(match => {
        const indices = match.indices;
        let offset = 0;
        indices.forEach(([start, end]) => {
          const before = highlighted.slice(0, start + offset);
          const matchText = highlighted.slice(start + offset, end + offset + 1);
          const after = highlighted.slice(end + offset + 1);
          highlighted = `${before}<mark>${matchText}</mark>${after}`;
          offset += '<mark></mark>'.length;
        });
      });
    }
    return highlighted;
  }

  function selectSuggestion(suggestion) {
    if (suggestion && suggestion.item && suggestion.item.name) {
      input.value = suggestion.item.name;
      clearSuggestions();
      input.focus();
      if (typeof JFCustomWidget !== 'undefined') {
        JFCustomWidget.sendSubmit({ value: suggestion.item.name, valid: true });
      }
      console.log('Selected suggestion:', suggestion.item.name);
    } else if (suggestion && suggestion.name) {
      // Handle case where suggestion is directly the item
      input.value = suggestion.name;
      clearSuggestions();
      input.focus();
      if (typeof JFCustomWidget !== 'undefined') {
        JFCustomWidget.sendSubmit({ value: suggestion.name, valid: true });
      }
      console.log('Selected suggestion:', suggestion.name);
    } else {
      console.error('Invalid suggestion format:', suggestion);
    }
  }

  input.addEventListener('keydown', (e) => {
    const items = suggestionsList.getElementsByTagName('li');
    if (e.key === 'Enter') {
      e.preventDefault();
      if (items.length > 0 && selectedIndex >= 0 && selectedIndex < items.length) {
        // Suggestion selected
        const selectedSuggestion = currentSuggestions[selectedIndex];
        if (selectedSuggestion) {
          selectSuggestion(selectedSuggestion);
        }
      }
    } else if (items.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIndex = (selectedIndex + 1) % items.length;
        updateSelection(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIndex = (selectedIndex - 1 + items.length) % items.length;
        updateSelection(items);
      }
    }
  });

  function updateSelection(items) {
    Array.from(items).forEach((item, index) => {
      item.classList.toggle('selected', index === selectedIndex);
      if (index === selectedIndex) {
        item.setAttribute('aria-selected', 'true');
        item.scrollIntoView({ block: 'nearest' });
        input.setAttribute('aria-activedescendant', item.id);
      } else {
        item.removeAttribute('aria-selected');
      }
    });
  }

  // Modify the focus and blur event listeners
  input.addEventListener('focus', () => {
    if (input.value.length >= settings.minCharRequired) {
      onInputChange({ target: input });
    }
  });

  input.addEventListener('blur', () => {
    setTimeout(() => {
      clearSuggestions();
    }, 150);
  });

  const debouncedAdjustIframeHeight = debounce((reset = false) => {
    if (settings.dynamicResize) {
      const inputHeight = 54; // Fixed input height
      let totalHeight = inputHeight;

      if (!reset && suggestionsList.style.display === 'block' && suggestionsList.children.length > 0) {
        const suggestionsHeight = suggestionsList.scrollHeight;
        totalHeight += suggestionsHeight + 3; // Added 3px buffer
      }

      // Send message to parent window to resize iframe
      window.parent.postMessage({ type: 'resize', height: totalHeight }, '*');

      // If not in JotForm, adjust the container height
      const container = document.getElementById('autocompleteWidget');
      if (container) {
        container.style.height = `${totalHeight}px`;
      }

      log('Adjusted height:', totalHeight);
    }
  }, 16); // Debounce for approximately one frame (60 FPS)

  function adjustIframeHeight(reset = false) {
    debouncedAdjustIframeHeight(reset);
  }

  // Initial iframe height adjustment
  adjustIframeHeight(true);
}

// Initialize the widget when the DOM is ready
document.addEventListener('DOMContentLoaded', initializeWidget);

// If JotForm is available, also initialize on 'ready' event
if (typeof JFCustomWidget !== 'undefined') {
  JFCustomWidget.subscribe('ready', initializeWidget);
}

// Add this at the end of main.js
window.addEventListener('message', function(event) {
    if (event.data.type === 'updateSettings') {
        // Update the widget settings
        Object.assign(defaultSettings, event.data.settings);
        initializeWidget();
    }
});
