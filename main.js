(function() {
  function getWidgetSetting(settingName, defaultValue, parseFunc = (val) => val) {
    if (typeof JFCustomWidget !== "undefined") {
      const setting = JFCustomWidget.getWidgetSetting(settingName);
      return setting !== undefined && setting !== '' ? parseFunc(setting) : defaultValue;
    }
    return defaultValue;
  }

  const defaultWidgetConfig = {
    googleSheetId: '1Xg_6DlbHku0zBiHhm54uDsubVpZDA5ELzl9rQcMS7j8',
    sheetName: 'FullList',
    columnIndex: 1,
    debounceTime: 300,
    maxResults: 5,
    minCharRequired: 3,
    threshold: 0.4,
    distance: 100,
    tokenize: true,
    matchAllTokens: true,
    placeholderText: 'Begin te typen...',
    inputWidth: '100%',
    autocompleteWidth: '100%',
    dynamicResize: true
  };

  let widgetConfig = { ...defaultWidgetConfig };
  let fuseInstance;
  let debounceTimer;
  let currentFocus = -1;

  const elements = {
    input: document.getElementById('autocomplete-input'),
    spinner: document.getElementById('spinner'),
    suggestionsList: document.getElementById('suggestions-list')
  };

  function initWidget() {
    console.log('Initializing widget...');
    
    // Initialize JotForm Widget
    if (typeof JFCustomWidget !== "undefined") {
      console.log('JFCustomWidget found, initializing...');
      JFCustomWidget.subscribe("ready", function(data) {
        console.log('JFCustomWidget ready event received:', data);
        const settings = {
          googleSheetId: JFCustomWidget.getWidgetSetting('googleSheetId'),
          sheetName: JFCustomWidget.getWidgetSetting('sheetName'),
          columnIndex: parseInt(JFCustomWidget.getWidgetSetting('columnIndex')) || 1,
          placeholderText: JFCustomWidget.getWidgetSetting('placeholderText'),
          minCharRequired: parseInt(JFCustomWidget.getWidgetSetting('minCharRequired')) || 3,
          maxResults: parseInt(JFCustomWidget.getWidgetSetting('maxResults')) || 5
        };
        
        // Log the retrieved settings
        console.log('Retrieved settings:', settings);
        
        // Apply settings and initialize
        handleWidgetReady({ settings: settings });
      });

      JFCustomWidget.subscribe("submit", handleSubmit);
    } else {
      // Standalone mode (sandbox)
      console.warn("JFCustomWidget not found, running in standalone mode");
      handleWidgetReady({ settings: defaultWidgetConfig });
    }

    // Add event listeners
    elements.input.addEventListener('input', handleInput);
    elements.input.addEventListener('keydown', handleKeyDown);
    elements.input.addEventListener('blur', handleBlur);
    elements.suggestionsList.addEventListener('click', handleSuggestionClick);
  }

  function handleWidgetReady(data) {
    console.log('handleWidgetReady called with data:', data);
    
    // Merge settings with defaults
    widgetConfig = {
      ...defaultWidgetConfig,
      ...data.settings
    };

    console.log('Final widget config:', widgetConfig);

    // Validate Google Sheet ID
    if (!widgetConfig.googleSheetId) {
      handleError(new Error('Google Sheet ID is required'));
      return;
    }

    // Apply settings
    elements.input.placeholder = widgetConfig.placeholderText;
    elements.input.style.width = widgetConfig.inputWidth;
    elements.suggestionsList.style.width = widgetConfig.autocompleteWidth;

    // Start data fetch
    console.log('Starting data fetch...');
    showSpinner();
    disableInput();

    fetchGoogleSheetsData(widgetConfig.googleSheetId, widgetConfig.sheetName)
      .then(data => {
        console.log('Data fetched successfully:', data);
        const processedData = processSheetData(data);
        initFuse(processedData);
        hideSpinner();
        enableInput();
        requestResize();
      })
      .catch(error => {
        console.error('Error fetching data:', error);
        handleError(error);
      });
  }

  function handleSubmit() {
    const value = elements.input.value;
    const isValid = value.length >= widgetConfig.minCharRequired;
    JFCustomWidget.sendSubmit({
      valid: isValid,
      value: value
    });
  }

  function disableInput() {
    elements.input.disabled = true;
    elements.input.style.cursor = 'not-allowed';
    elements.input.placeholder = 'Beroepen laden...';
  }

  function enableInput() {
    elements.input.disabled = false;
    elements.input.style.cursor = 'text';
    elements.input.placeholder = widgetConfig.placeholderText || 'Begin te typen...';
  }

  function showSpinner() {
    elements.spinner.style.display = 'block';
  }

  function hideSpinner() {
    elements.spinner.style.display = 'none';
  }

  function fetchGoogleSheetsData(spreadsheetId, sheetName) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const callbackName = 'googleSheetCallback_' + Math.round(Math.random() * 1000000);
      
      // Define the callback function in the global scope
      window[callbackName] = function(response) {
        try {
          // Clean up
          delete window[callbackName];
          document.body.removeChild(script);
          
          // Parse the response
          let data;
          if (typeof response === 'string') {
            // If response is a string, parse it
            const jsonText = response.replace(/^\)]\}while\(1\);/, '');
            data = JSON.parse(jsonText);
          } else if (typeof response === 'object') {
            // If response is already an object, use it directly
            data = response;
          } else {
            throw new Error('Invalid response format');
          }
          
          console.log('Raw response:', response);
          console.log('Parsed data:', data);
          
          if (!data.table || !data.table.rows) {
            throw new Error('Invalid data structure');
          }
          
          // Send the raw data to the parent for display
          window.parent.postMessage({ 
            type: 'fetchedData', 
            data: data.table 
          }, '*');
          
          resolve(data.table);
        } catch (error) {
          console.error('Error processing response:', error);
          reject(error);
        }
      };

      // Create the URL with the callback parameter
      const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}&callback=${callbackName}`;
      console.log('Fetching from URL:', url);
      
      // Add error handling for script loading
      script.onerror = (error) => {
        console.error('Script loading error:', error);
        delete window[callbackName];
        document.body.removeChild(script);
        reject(new Error('Failed to load Google Sheets data'));
      };

      // Load the script
      script.src = url;
      script.async = true;
      document.body.appendChild(script);

      // Add timeout with longer duration
      setTimeout(() => {
        if (window[callbackName]) {
          console.error('Timeout reached for callback:', callbackName);
          delete window[callbackName];
          document.body.removeChild(script);
          reject(new Error('Timeout while fetching Google Sheets data'));
        }
      }, 30000); // 30 seconds timeout
    });
  }

  function processSheetData(data) {
    console.log('Raw sheet data:', data); // Add this line for debugging

    if (!data || !data.cols || !data.rows) {
      console.error('Invalid data structure:', data);
      throw new Error('Invalid data structure received from Google Sheets');
    }

    const headers = data.cols.map(col => col.label);
    const columnIndex = widgetConfig.columnIndex;

    if (columnIndex < 0 || columnIndex >= headers.length) {
      console.error('Invalid column index:', columnIndex);
      throw new Error('Invalid column index');
    }

    return data.rows.map((row, rowIndex) => {
      if (!row.c || !Array.isArray(row.c)) {
        console.error(`Invalid row structure at index ${rowIndex}:`, row);
        return { original: '', processed: '' };
      }

      const cell = row.c[columnIndex];
      const value = cell && cell.v !== undefined ? cell.v : '';
      const processedValue = value.toString().toLowerCase().replace(/[^a-z0-9\s]/g, '');
      
      return { 
        original: value,
        processed: processedValue
      };
    });
  }

  function initFuse(data) {
    const options = {
      keys: ['processed'],
      threshold: widgetConfig.threshold,
      distance: widgetConfig.distance,
      tokenize: widgetConfig.tokenize,
      matchAllTokens: widgetConfig.matchAllTokens,
      findAllMatches: true
    };
    fuseInstance = new Fuse(data, options);
  }

  function handleInput() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const query = elements.input.value.trim();
      if (query.length >= widgetConfig.minCharRequired) {
        showSpinner();
        const results = fuseInstance.search(query).slice(0, widgetConfig.maxResults);
        displaySuggestions(results, query);
        hideSpinner();
        validateInput(true);
      } else {
        clearSuggestions();
        validateInput(false);
      }
    }, widgetConfig.debounceTime);
  }

  function validateInput(isValid) {
    if (typeof JFCustomWidget !== "undefined") {
      JFCustomWidget.sendData({
        valid: isValid,
        value: elements.input.value
      });
    }
  }

  function displaySuggestions(results, query) {
    clearSuggestions();
    if (results.length === 0) {
      return;
    }
    results.forEach((result, index) => {
      const li = document.createElement('li');
      li.innerHTML = highlightMatch(result.item.original, query);
      li.setAttribute('role', 'option');
      li.setAttribute('data-index', index);
      elements.suggestionsList.appendChild(li);
    });
    elements.suggestionsList.style.display = 'block';
    
    // Set input bottom border to 0px when suggestions are shown
    elements.input.style.borderBottomLeftRadius = '0';
    elements.input.style.borderBottomRightRadius = '0';
    
    // Highlight the first suggestion
    currentFocus = 0;
    updateActiveSuggestion();

    window.parent.postMessage({ 
      type: 'suggestionsUpdated', 
      suggestions: results.map(r => r.item.original),
      query: query
    }, '*');

    if (widgetConfig.dynamicResize) {
      requestResize();
    }
    requestResize(); // Add this line
  }

  function highlightMatch(text, query) {
    const words = query.split(/\s+/);
    let highlightedText = text;
    words.forEach(word => {
      const regex = new RegExp(`(${word})`, 'gi');
      highlightedText = highlightedText.replace(regex, '<mark style="background-color: transparent; color: black; font-weight: bold;">$1</mark>');
    });
    return highlightedText;
  }

  function clearSuggestions() {
    elements.suggestionsList.innerHTML = '';
    elements.suggestionsList.style.display = 'none';
    // Reset input bottom border when suggestions are cleared
    elements.input.style.borderBottomLeftRadius = '8px';
    elements.input.style.borderBottomRightRadius = '8px';
    currentFocus = -1;
    requestResize(); // Add this line
  }

  function handleKeyDown(e) {
    if (!elements.suggestionsList.style.display || elements.suggestionsList.style.display === 'none') {
      return;
    }

    const suggestions = elements.suggestionsList.getElementsByTagName('li');

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      currentFocus++;
      if (currentFocus >= suggestions.length) currentFocus = 0;
      updateActiveSuggestion();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      currentFocus--;
      if (currentFocus < 0) currentFocus = suggestions.length - 1;
      updateActiveSuggestion();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (currentFocus > -1) {
        suggestions[currentFocus].click();
      }
    }
  }

  function updateActiveSuggestion() {
    const suggestions = elements.suggestionsList.getElementsByTagName('li');
    for (let i = 0; i < suggestions.length; i++) {
      suggestions[i].classList.remove('active');
    }
    if (currentFocus > -1 && currentFocus < suggestions.length) {
      suggestions[currentFocus].classList.add('active');
    }
  }

  function handleSuggestionClick(event) {
    if (event.target.tagName === 'LI') {
      const value = event.target.textContent.replace(/<\/?mark>/g, '');
      elements.input.value = value;
      clearSuggestions();
      
      // Send data to JotForm as recommended
      if (typeof JFCustomWidget !== "undefined") {
        JFCustomWidget.sendData({
          valid: true,
          value: value
        });
      }
      elements.input.focus();
    }
  }

  function handleError(error) {
    console.error('Error:', error);
    hideSpinner();
    enableInput();
    elements.input.placeholder = 'Error loading data. Please try again.';
    elements.input.title = error.message;
    
    // Send error to parent for display
    window.parent.postMessage({ 
      type: 'error', 
      message: error.toString() 
    }, '*');
    
    if (typeof JFCustomWidget !== "undefined") {
      JFCustomWidget.sendData({
        valid: false,
        value: '',
        message: error.message
      });
    }
    
    requestResize();
  }

  const originalLog = console.log;
  console.log = function(...args) {
    originalLog.apply(console, args);
    window.parent.postMessage({ type: 'log', message: args.join(' ') }, '*');
  };

  const originalError = console.error;
  console.error = function(...args) {
    originalError.apply(console, args);
    window.parent.postMessage({ type: 'error', message: args.join(' ') }, '*');
  };

  function calculateTotalHeight() {
    const inputHeight = elements.input.offsetHeight;
    const suggestionsHeight = elements.suggestionsList.style.display === 'block' 
      ? elements.suggestionsList.offsetHeight 
      : 0;
    const padding = 20;
    return inputHeight + suggestionsHeight + padding;
  }

  function requestResize() {
    const height = calculateTotalHeight();
    console.log('Requesting resize to height:', height);
    
    if (typeof JFCustomWidget !== "undefined") {
      JFCustomWidget.requestFrameResize({
        height: height
      });
    }
  }

  function handleBlur() {
    // Use setTimeout to allow click events on suggestions to fire before clearing
    setTimeout(() => {
      clearSuggestions();
    }, 200);
  }

  initWidget();

  // Add a mutation observer to detect DOM changes and resize accordingly
  const observer = new MutationObserver(requestResize);
  observer.observe(document.body, { childList: true, subtree: true });
})();
