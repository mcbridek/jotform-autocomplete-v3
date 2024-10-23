(function() {
    const widgetConfig = {
        defaultSpreadsheetId: 'your_default_spreadsheet_id_here',
        sheetName: 'Sheet1',
        debounceTime: 300
    };

    const searchInput = document.getElementById('searchInput');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const errorMessage = document.getElementById('errorMessage');
    const resultsList = document.getElementById('resultsList');
    const noResults = document.getElementById('noResults');

    let debounceTimer;

    function fetchGoogleSheetsData(searchTerm, spreadsheetId, sheetName) {
        if (!spreadsheetId) {
            throw new Error('Spreadsheet ID is missing');
        }

        return fetch(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.text();
            })
            .then(text => {
                const data = JSON.parse(text.substr(47).slice(0, -2));
                
                if (!data.table || !data.table.rows) {
                    return [];
                }

                const headers = data.table.cols.map(col => col.label);
                const rows = data.table.rows;

                const filteredRows = rows.filter(row =>
                    row.c.some(cell => 
                        cell && cell.v && cell.v.toString().toLowerCase().includes(searchTerm.toLowerCase())
                    )
                );

                return filteredRows.map(row => {
                    const rowData = {};
                    headers.forEach((header, index) => {
                        rowData[header] = row.c[index] ? row.c[index].v : '';
                    });
                    return rowData;
                });
            });
    }

    function displayResults(results) {
        resultsList.innerHTML = '';
        if (results.length === 0) {
            noResults.classList.remove('hidden');
        } else {
            noResults.classList.add('hidden');
            results.forEach(item => {
                const li = document.createElement('li');
                li.innerHTML = Object.entries(item).map(([key, value]) => `<strong>${key}:</strong> ${value}`).join(' | ');
                resultsList.appendChild(li);
            });
        }
    }

    function handleSearch() {
        const searchTerm = searchInput.value;
        const config = window.JFCustomWidget?.options || widgetConfig;
        const spreadsheetId = config.spreadsheetId || config.defaultSpreadsheetId;
        const sheetName = config.sheetName || 'Sheet1';

        loadingSpinner.classList.remove('hidden');
        errorMessage.classList.add('hidden');
        resultsList.innerHTML = '';
        noResults.classList.add('hidden');

        fetchGoogleSheetsData(searchTerm, spreadsheetId, sheetName)
            .then(displayResults)
            .catch(error => {
                console.error('Error fetching Google Sheets data:', error);
                errorMessage.textContent = 'Failed to fetch data. Please try again.';
                errorMessage.classList.remove('hidden');
            })
            .finally(() => {
                loadingSpinner.classList.add('hidden');
            });
    }

    searchInput.addEventListener('input', function() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(handleSearch, widgetConfig.debounceTime);
    });

    // Initial load (if needed)
    // handleSearch();
})();
