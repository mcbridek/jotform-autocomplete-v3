// Config and State Management
const WidgetConfig = {
    defaults: {
        scriptId: 'AKfycbxUq5FCWznDB28yKSeHqFAv765nZ9P96N5hQNQebUYazmDT5fFG_5YAP7OP6FTcm3CJ',
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
    },
    
    current: null,
    
    init(settings) {
        this.current = { ...this.defaults, ...settings };
        return this.current;
    },
    
    get(key) {
        return this.current[key];
    }
};

// API Service with caching
const GoogleSheetsAPI = {
    baseUrl: 'https://script.google.com/macros/s/',
    cache: new Map(),
    cacheExpiry: 5 * 60 * 1000, // 5 minutes in milliseconds
    
    async fetchData(sheetName) {
        // Check cache first
        const cachedData = this.getFromCache(sheetName);
        if (cachedData) {
            console.log('Returning cached data for:', sheetName);
            return cachedData;
        }
        
        const scriptId = WidgetConfig.get('scriptId');
        const url = `${this.baseUrl}${scriptId}/exec?path=${encodeURIComponent(sheetName)}`;
        console.log('Fetching from URL:', url);
        
        try {
            const response = await fetch(url, {
                method: 'GET',
                mode: 'cors',
                headers: { 'Accept': 'application/json' }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const text = await response.text();
            const jsonData = JSON.parse(text);
            
            if (!Array.isArray(jsonData)) {
                throw new Error('Invalid data format received - not an array');
            }
            
            const transformedData = this.transformData(jsonData);
            
            // Cache the transformed data
            this.setInCache(sheetName, transformedData);
            
            return transformedData;
        } catch (error) {
            // If fetch fails, try to return stale cache
            const staleData = this.getFromCache(sheetName, true);
            if (staleData) {
                console.log('Returning stale cached data due to fetch error');
                return staleData;
            }
            throw error;
        }
    },
    
    getFromCache(sheetName, allowStale = false) {
        const cached = this.cache.get(sheetName);
        if (!cached) return null;
        
        const isExpired = Date.now() - cached.timestamp > this.cacheExpiry;
        if (isExpired && !allowStale) return null;
        
        return cached.data;
    },
    
    setInCache(sheetName, data) {
        this.cache.set(sheetName, {
            data,
            timestamp: Date.now()
        });
    },
    
    clearCache() {
        this.cache.clear();
    },
    
    transformData(jsonData) {
        const headers = Object.keys(jsonData[0] || {});
        return {
            cols: headers.map(header => ({ label: header })),
            rows: jsonData.map(row => ({
                c: headers.map(header => ({ v: row[header] }))
            }))
        };
    }
};

// UI Manager
const UIManager = {
    elements: {
        input: document.getElementById('autocomplete-input'),
        spinner: document.getElementById('spinner'),
        suggestionsList: document.getElementById('suggestions-list')
    },
    
    init() {
        this.bindEvents();
        this.initMutationObserver();
        this.applySettings();
    },
    
    bindEvents() {
        this.elements.input.addEventListener('input', () => SearchManager.handleInput());
        this.elements.input.addEventListener('keydown', (e) => this.handleKeyDown(e));
        this.elements.input.addEventListener('blur', () => this.handleBlur());
        this.elements.suggestionsList.addEventListener('click', (e) => this.handleSuggestionClick(e));
    },
    
    initMutationObserver() {
        const observer = new MutationObserver(() => WidgetController.requestResize());
        observer.observe(document.body, { childList: true, subtree: true });
    },
    
    applySettings() {
        this.elements.input.placeholder = WidgetConfig.get('placeholderText');
        this.elements.input.style.width = WidgetConfig.get('inputWidth');
        this.elements.suggestionsList.style.width = WidgetConfig.get('autocompleteWidth');
    },
    
    showSpinner() {
        this.elements.spinner.style.display = 'block';
    },
    
    hideSpinner() {
        this.elements.spinner.style.display = 'none';
    },
    
    enableInput() {
        this.elements.input.disabled = false;
        this.elements.input.style.cursor = 'text';
        this.elements.input.placeholder = WidgetConfig.get('placeholderText');
    },
    
    disableInput() {
        this.elements.input.disabled = true;
        this.elements.input.style.cursor = 'not-allowed';
        this.elements.input.placeholder = 'Loading...';
    },
    
    displaySuggestions(results, query) {
        this.clearSuggestions();
        if (results.length === 0) return;
        
        results.forEach((result, index) => {
            const li = document.createElement('li');
            li.innerHTML = this.highlightMatch(result.item.original, query);
            li.setAttribute('role', 'option');
            li.setAttribute('data-index', index);
            this.elements.suggestionsList.appendChild(li);
        });
        
        this.elements.suggestionsList.style.display = 'block';
        this.elements.input.style.borderBottomLeftRadius = '0';
        this.elements.input.style.borderBottomRightRadius = '0';
        
        SearchManager.setCurrentFocus(0);
        this.updateActiveSuggestion();
        
        // Force a reflow before calculating height
        void this.elements.suggestionsList.offsetHeight;
        
        // Calculate and request new height
        const totalHeight = this.calculateTotalHeight();
        WidgetController.requestResize(totalHeight);
    },
    
    clearSuggestions() {
        this.elements.suggestionsList.innerHTML = '';
        this.elements.suggestionsList.style.display = 'none';
        this.elements.input.style.borderBottomLeftRadius = '8px';
        this.elements.input.style.borderBottomRightRadius = '8px';
        SearchManager.setCurrentFocus(-1);
        
        // Request resize with just input height
        const totalHeight = this.calculateTotalHeight();
        WidgetController.requestResize(totalHeight);
    },
    
    highlightMatch(text, query) {
        const words = query.split(/\s+/);
        let highlightedText = text;
        words.forEach(word => {
            const regex = new RegExp(`(${word})`, 'gi');
            highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
        });
        return highlightedText;
    },
    
    handleKeyDown(e) {
        const suggestions = this.elements.suggestionsList.getElementsByTagName('li');
        if (!suggestions.length) return;
        
        switch(e.key) {
            case 'ArrowDown':
                e.preventDefault();
                SearchManager.incrementFocus(1, suggestions.length);
                break;
            case 'ArrowUp':
                e.preventDefault();
                SearchManager.incrementFocus(-1, suggestions.length);
                break;
            case 'Enter':
                e.preventDefault();
                if (SearchManager.getCurrentFocus() > -1) {
                    suggestions[SearchManager.getCurrentFocus()].click();
                }
                break;
        }
        
        this.updateActiveSuggestion();
    },
    
    updateActiveSuggestion() {
        const suggestions = this.elements.suggestionsList.getElementsByTagName('li');
        Array.from(suggestions).forEach(s => s.classList.remove('active'));
        
        const currentFocus = SearchManager.getCurrentFocus();
        if (currentFocus > -1 && currentFocus < suggestions.length) {
            suggestions[currentFocus].classList.add('active');
        }
    },
    
    handleSuggestionClick(event) {
        if (event.target.tagName === 'LI') {
            const value = event.target.textContent.replace(/<\/?mark>/g, '');
            this.elements.input.value = value;
            this.clearSuggestions();
            WidgetController.sendData(true, value);
            this.elements.input.focus();
        }
    },
    
    handleBlur() {
        setTimeout(() => this.clearSuggestions(), 200);
    },
    
    calculateTotalHeight() {
        const inputHeight = this.elements.input.offsetHeight;
        const suggestionsHeight = this.elements.suggestionsList.offsetHeight;
        const padding = 20; // Additional padding
        return inputHeight + suggestionsHeight + padding;
    }
};

// Search Manager
const SearchManager = {
    fuseInstance: null,
    debounceTimer: null,
    currentFocus: -1,
    
    init(data) {
        this.initFuse(data);
    },
    
    initFuse(data) {
        const options = {
            keys: ['processed'],
            threshold: WidgetConfig.get('threshold'),
            distance: WidgetConfig.get('distance'),
            tokenize: WidgetConfig.get('tokenize'),
            matchAllTokens: WidgetConfig.get('matchAllTokens'),
            findAllMatches: true
        };
        this.fuseInstance = new Fuse(data, options);
    },
    
    handleInput() {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            const query = UIManager.elements.input.value.trim();
            if (query.length >= WidgetConfig.get('minCharRequired')) {
                UIManager.showSpinner();
                const results = this.fuseInstance.search(query)
                    .slice(0, WidgetConfig.get('maxResults'));
                UIManager.displaySuggestions(results, query);
                UIManager.hideSpinner();
                WidgetController.sendData(true, query);
            } else {
                UIManager.clearSuggestions();
                WidgetController.sendData(false, query);
            }
        }, WidgetConfig.get('debounceTime'));
    },
    
    getCurrentFocus() {
        return this.currentFocus;
    },
    
    setCurrentFocus(value) {
        this.currentFocus = value;
    },
    
    incrementFocus(increment, maxLength) {
        this.currentFocus += increment;
        if (this.currentFocus >= maxLength) this.currentFocus = 0;
        if (this.currentFocus < 0) this.currentFocus = maxLength - 1;
    }
};

// Widget Controller
const WidgetController = {
    async init() {
        try {
            await this.initializeWidget();
            UIManager.init();
        } catch (error) {
            this.handleError(error);
        }
    },
    
    async initializeWidget() {
        if (typeof JFCustomWidget !== "undefined") {
            this.initJotFormWidget();
        } else {
            console.warn("JFCustomWidget not found, running in standalone mode");
            await this.initStandaloneMode();
        }
        
        // Add message listener for sandbox communication
        window.addEventListener('message', (event) => this.handleMessage(event));
    },
    
    async initJotFormWidget() {
        JFCustomWidget.subscribe("ready", async (data) => {
            const settings = {
                sheetName: JFCustomWidget.getWidgetSetting('sheetName'),
                columnIndex: parseInt(JFCustomWidget.getWidgetSetting('columnIndex')) || 1,
                placeholderText: JFCustomWidget.getWidgetSetting('placeholderText'),
                minCharRequired: parseInt(JFCustomWidget.getWidgetSetting('minCharRequired')) || 3,
                maxResults: parseInt(JFCustomWidget.getWidgetSetting('maxResults')) || 5
            };
            
            await this.handleWidgetReady({ settings });
        });
        
        JFCustomWidget.subscribe("submit", () => this.handleSubmit());
    },
    
    async initStandaloneMode() {
        // Start preloading data immediately
        const preloadPromise = GoogleSheetsAPI.fetchData(WidgetConfig.defaults.sheetName);
        
        // Continue with normal initialization
        await this.handleWidgetReady({ settings: WidgetConfig.defaults });
        
        // Wait for preload to complete in background
        try {
            await preloadPromise;
        } catch (error) {
            console.warn('Preload failed:', error);
        }
    },
    
    async handleWidgetReady(data) {
        WidgetConfig.init(data.settings);
        UIManager.applySettings();
        
        UIManager.showSpinner();
        UIManager.disableInput();
        
        try {
            // Keep trying to fetch data until successful
            let attempts = 0;
            let data;
            
            while (!data) {
                try {
                    attempts++;
                    console.log(`Fetch attempt ${attempts}...`);
                    data = await GoogleSheetsAPI.fetchData(WidgetConfig.get('sheetName'));
                } catch (error) {
                    console.warn(`Attempt ${attempts} failed:`, error);
                    // Add a small delay between attempts
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            
            const processedData = this.processSheetData(data);
            SearchManager.init(processedData);
            
            UIManager.hideSpinner();
            UIManager.enableInput();
            this.requestResize();
        } catch (error) {
            this.handleError(error);
        }
    },
    
    processSheetData(data) {
        if (!data || !data.cols || !data.rows) {
            throw new Error('Invalid data structure received');
        }
        
        const columnIndex = WidgetConfig.get('columnIndex');
        return data.rows.map(row => {
            const value = row.c[columnIndex]?.v || '';
            return {
                original: value,
                processed: value.toString().toLowerCase().replace(/[^a-z0-9\s]/g, '')
            };
        });
    },
    
    handleMessage(event) {
        const data = event.data;
        if (data.type === 'updateSettings') {
            this.handleWidgetReady({ settings: data.settings });
        }
    },
    
    handleSubmit() {
        const value = UIManager.elements.input.value;
        const isValid = value.length >= WidgetConfig.get('minCharRequired');
        this.sendSubmit(isValid, value);
    },
    
    sendData(isValid, value) {
        if (typeof JFCustomWidget !== "undefined") {
            JFCustomWidget.sendData({
                valid: isValid,
                value: value
            });
        }
    },
    
    sendSubmit(isValid, value) {
        if (typeof JFCustomWidget !== "undefined") {
            JFCustomWidget.sendSubmit({
                valid: isValid,
                value: value
            });
        }
    },
    
    requestResize(height) {
        if (!height) {
            height = UIManager.calculateTotalHeight();
        }
        
        console.log('Requesting resize to height:', height);
        
        if (typeof JFCustomWidget !== "undefined") {
            JFCustomWidget.requestFrameResize({
                height: height
            });
        }
        
        window.parent.postMessage({ 
            type: 'resize', 
            height: height 
        }, '*');
    },
    
    handleError(error) {
        console.error('Error:', error);
        UIManager.hideSpinner();
        UIManager.enableInput();
        UIManager.elements.input.placeholder = 'Error: ' + error.message;
        
        window.parent.postMessage({ 
            type: 'error', 
            message: error.toString() 
        }, '*');
        
        this.sendData(false, '');
        this.requestResize();
    }
};

// Initialize the widget
WidgetController.init();
