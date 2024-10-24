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
    if (typeof JFCustomWidget !== "undefined") {
      console.log('JFCustomWidget is defined, subscribing to events...');
      JFCustomWidget.subscribe("ready", function(data) {
        console.log('Received ready event with data:', data);
        handleWidgetReady(data);
      });
      JFCustomWidget.subscribe("submit", handleSubmit);
    } else {
      console.warn("JFCustomWidget is not defined. Running in standalone mode.");
      handleWidgetReady({});
    }

    elements.input.addEventListener('input', handleInput);
    elements.input.addEventListener('keydown', handleKeyDown);
    elements.input.addEventListener('blur', handleBlur);
    elements.suggestionsList.addEventListener('click', handleSuggestionClick);
    
    disableInput();
  }

  function handleWidgetReady(data) {
    console.log('Widget ready, received data:', data);
    
    // Use JFCustomWidget.getWidgetSetting for each setting
    widgetConfig = {
      googleSheetId: JFCustomWidget.getWidgetSetting('googleSheetId'),
      sheetName: JFCustomWidget.getWidgetSetting('sheetName'),
      columnIndex: parseInt(JFCustomWidget.getWidgetSetting('columnIndex')),
      debounceTime: parseInt(JFCustomWidget.getWidgetSetting('debounceTime')),
      maxResults: parseInt(JFCustomWidget.getWidgetSetting('maxResults')),
      minCharRequired: parseInt(JFCustomWidget.getWidgetSetting('minCharRequired')),
      threshold: parseFloat(JFCustomWidget.getWidgetSetting('threshold')),
      distance: parseInt(JFCustomWidget.getWidgetSetting('distance')),
      tokenize: JFCustomWidget.getWidgetSetting('tokenize') === 'true',
      matchAllTokens: JFCustomWidget.getWidgetSetting('matchAllTokens') === 'true',
      placeholderText: JFCustomWidget.getWidgetSetting('placeholderText'),
      inputWidth: JFCustomWidget.getWidgetSetting('inputWidth'),
      autocompleteWidth: JFCustomWidget.getWidgetSetting('autocompleteWidth'),
      dynamicResize: JFCustomWidget.getWidgetSetting('dynamicResize') === 'true'
    };

    // Use default values if settings are undefined
    Object.keys(widgetConfig).forEach(key => {
      if (widgetConfig[key] === undefined) {
        widgetConfig[key] = defaultWidgetConfig[key];
      }
    });

    console.log('Widget config after applying settings:', widgetConfig);

    // Apply settings and fetch data
    applySettings();
    fetchData();
  }

  function applySettings() {
    elements.input.placeholder = widgetConfig.placeholderText;
    elements.input.style.width = widgetConfig.inputWidth;
    elements.suggestionsList.style.width = widgetConfig.autocompleteWidth;
    requestResize();
  }

  function fetchData() {
    console.log('Fetching data from Google Sheets...');
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
      .catch(handleError);
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
      
      window[callbackName] = function(response) {
        delete window[callbackName];
        document.body.removeChild(script);
        if (response.status === 'ok') {
          resolve(response.table);
        } else {
          reject(new Error('Failed to fetch Google Sheets data'));
        }
      };

      const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}&callback=${callbackName}`;
      script.src = url;
      document.body.appendChild(script);
    });
  }

  function processSheetData(data) {
    const headers = data.cols.map(col => col.label);
    const columnIndex = widgetConfig.columnIndex;
    return data.rows.map(row => {
      const value = row.c[columnIndex] ? row.c[columnIndex].v : '';
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
      elements.input.value = event.target.textContent.replace(/<\/?mark>/g, '');
      clearSuggestions();
      validateInput(true);
      elements.input.focus();
      
      // Notify JotForm of the selected value
      if (typeof JFCustomWidget !== "undefined") {
        JFCustomWidget.sendData({
          value: elements.input.value
        });
      }
    }
  }

  function handleError(error) {
    console.error('Error:', error);
    hideSpinner();
    enableInput();
    elements.input.placeholder = 'Error loading data. Please try again.';
    elements.input.title = error.message;
    validateInput(false);
    if (typeof JFCustomWidget !== "undefined") {
      JFCustomWidget.sendData({
        valid: false,
        value: ''
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

  function requestResize() {
    if (typeof JFCustomWidget !== 'undefined') {
      const totalHeight = document.body.scrollHeight;
      console.log('Requesting frame resize to height:', totalHeight);
      JFCustomWidget.requestFrameResize({
        height: totalHeight
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
