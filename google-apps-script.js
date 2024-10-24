// Cache configuration
const CACHE_DURATION = 21600; // 6 hours in seconds

function getCachedData(sheetName) {
  const cache = CacheService.getScriptCache();
  return cache.get(sheetName);
}

function setCachedData(sheetName, data) {
  const cache = CacheService.getScriptCache();
  cache.put(sheetName, data, CACHE_DURATION);
}

function json(sheetName) {
  // Try to get cached data first
  const cachedData = getCachedData(sheetName);
  if (cachedData) {
    return ContentService
      .createTextOutput(cachedData)
      .setMimeType(ContentService.MimeType.JSON);
  }

  // If no cache, get fresh data
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(sheetName);
  const data = sheet.getDataRange().getValues();
  const jsonData = convertToJson(data);
  
  // Cache the result
  setCachedData(sheetName, JSON.stringify(jsonData));
  
  return ContentService
    .createTextOutput(JSON.stringify(jsonData))
    .setMimeType(ContentService.MimeType.JSON);
}
