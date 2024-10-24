# Jotform API Widgets

## Overview
Jotform Widgets allow you to create custom form fields that can be embedded into Jotform forms. These widgets can display content or gather user input, enhancing form functionality. Widgets are housed in an iFrame container, making integration simple.

## Widget Types
There are two main types of widgets:
1. **Embed Code Widgets**: For services like YouTube where the user simply pastes embed code from a third-party website.
2. **iFrame Widgets**: Hosted externally, these widgets communicate with Jotform through the Jotform Custom Widget API.

## Creating a Widget

1. **HTML Structure**: Create the basic HTML for your widget. For example:
    ```html
    <h3>This is my first widget.</h3>
    <span id="labelText"></span>
    <input type="text" id="userInput">
    <script type="text/javascript">
      JFCustomWidget.subscribe("ready", function() {
        var label = JFCustomWidget.getWidgetSetting('QuestionLabel');
        document.getElementById('labelText').innerHTML = label;
      });
      
      JFCustomWidget.subscribe("submit", function() {
        var msg = {
          valid: true,
          value: document.getElementById('userInput').value
        };
        JFCustomWidget.sendSubmit(msg);
      });
    </script>
    ```

2. **Register the Widget**: After writing the HTML, register the widget on Jotform. Key details to provide:
    - **Name**: A descriptive name of the widget.
    - **Type**: Choose the `iFrame Widget` option.
    - **IFrame URL**: Provide the URL where the widget is hosted.
    - **Size Parameters**: Define the default width and height for your widget.

3. **Test the Widget**: After registration, add the widget to a Jotform form to test its functionality.

## Widget API Methods
The Jotform Custom Widget API offers several core methods:
- **subscribe(event, callback)**: Subscribe to events like `ready` or `submit`.
- **sendSubmit(data)**: Send the widget's form data.
- **requestFrameResize(data)**: Resize the iFrame containing your widget.
- **getWidgetSetting(parameterName)**: Get parameters provided during widget creation.

## Example Widgets
Here are some sample widgets provided in the API documentation:
- **Drawing Board**: Allows users to draw and submit drawings.
- **Take Photo**: Enables users to capture and upload photos.
- **TransloadIt File Processing**: Processes files through TransloadIt service.

## Resources
For more detailed information on the Jotform Custom Widget API, visit the [official Jotform Developers page](https://www.jotform.com/developers/widgets/).

---

## Tutorial: Creating Your First Custom Widget

Follow these steps to create your first widget:

### Step 1: Create the Widget HTML

Start by creating a basic HTML file. This file will serve as the interface for your widget, which will be embedded in Jotform forms.

Example code for the widget:
```html
<h3>This is my first widget</h3>
<span id="labelText"></span>
<input type="text" id="userInput">
<script type="text/javascript">
  // Always subscribe to the ready event
  JFCustomWidget.subscribe("ready", function() {
    var label = JFCustomWidget.getWidgetSetting('QuestionLabel');
    document.getElementById('labelText').innerHTML = label;
  });
  
  // Subscribe to form submit event
  JFCustomWidget.subscribe("submit", function() {
    var msg = {
      valid: true,  // Ensure form can be submitted
      value: document.getElementById('userInput').value
    };
    // Send value to Jotform
    JFCustomWidget.sendSubmit(msg);
  });
</script>
```

### Step 2: Host the Widget
Upload this HTML file to your server so that it can be accessed via a URL.

### Step 3: Register the Widget with Jotform
To make the widget available to Jotform users, follow these steps:

1. Visit the Add Widgets page to start the registration process.
2. Provide a Name for your widget (e.g., “My Simple Widget”).
3. Select the iFrame Widget option.
4. Provide the URL where your widget is hosted.
5. Set the Widget Width and Height according to your widget’s design.
6. Add any Additional Parameters if necessary. For instance, add a parameter for the question label with the name QuestionLabel.

### Step 4: Test the Widget
Once registered, you can test your widget by adding it to a form in the Jotform Form Builder. Check that it functions as expected by previewing and submitting the form.

### Step 5: Submit for Approval
After testing your widget, you can make it available to all Jotform users by submitting it for approval. Jotform will review the widget and, once approved, it will be listed in the widget gallery.

## Custom Widget API Methods

Below are some useful methods provided by the Jotform Custom Widget API:

### Core Methods

- **JFCustomWidget.subscribe(event, callback)**: Listens for specific events such as when the widget is ready or when the form is submitted.
- **JFCustomWidget.sendSubmit(data)**: Sends form data along with your widget’s data when the form is submitted.
- **JFCustomWidget.requestFrameResize(data)**: Allows you to resize the widget’s iFrame within the form.
- **JFCustomWidget.getWidgetSetting(parameterName)**: Retrieves a specific setting value for your widget, such as parameters passed when the widget was created.

### Example Callback for Submit Event

```javascript
JFCustomWidget.subscribe("submit", function() {
  var result = {
    valid: true,  // Mark the widget as valid for form submission
    value: "my precious data"  // The value you want to send
  };
  JFCustomWidget.sendSubmit(result);  // Send the form data
});
```

## Widget Best Practices

- Always subscribe to the ready event before writing any widget code to ensure your widget’s settings are correctly loaded.
- Use the **sendSubmit()** method to submit data, and include the **valid** property to ensure the form passes validation.

## Further Reading and Resources

- **Jotform Widget Gallery**: View Available Widgets
- **Jotform Developer API Documentation**: API Docs
- **Jotform Custom Widget Sample Projects**: Sample Widgets

## Maintenance Guidelines

When making changes to the Google Sheets Autocomplete Widget, please keep the following points in mind to ensure stability and proper functionality:

1. **Configuration Parameters**: 
   - Always maintain the `defaultWidgetConfig` object in `main.js`.
   - Ensure any new configurable parameters are added to both `defaultWidgetConfig` and the JotForm widget settings.

2. **Google Sheets Integration**:
   - The widget relies on a specific Google Sheets structure. Ensure any changes to the data fetching or processing logic in `fetchGoogleSheetsData()` and `processSheetData()` functions are compatible with the expected sheet format.
   - Remember that the widget uses the second column (index 1) of the Google Sheet by default. If this changes, update the `columnIndex` in the configuration.

3. **CORS Handling**:
   - The widget uses a CORS proxy (cors-anywhere) for development. Ensure a proper solution is implemented for production use.

4. **JotForm Integration**:
   - Always test changes with the JotForm Custom Widget API (`JFCustomWidget`).
   - Maintain proper error handling and validation to ensure the widget communicates correctly with JotForm.

5. **Fuzzy Search**:
   - The widget uses Fuse.js for fuzzy searching. If modifying search logic, ensure Fuse.js options in `initFuse()` are adjusted accordingly.

6. **UI/UX Considerations**:
   - Maintain accessibility features (ARIA attributes, keyboard navigation).
   - Ensure the widget is responsive and works well on different screen sizes.

7. **Performance**:
   - Keep the debounce functionality for input handling to prevent excessive API calls.
   - Be mindful of the widget's performance impact, especially when dealing with large datasets.

8. **Testing**:
   - Always test in both the sandbox environment and within a JotForm form.
   - Test with various Google Sheets configurations and data sizes.
   - Verify all features: autocomplete, validation, form submission, etc.

9. **Browser Compatibility**:
   - Ensure changes are compatible with all major browsers.

10. **Version Control**:
    - Document significant changes in a CHANGELOG.md file.
    - Use semantic versioning for releases.

11. **Dependencies**:
    - Keep external dependencies (like Fuse.js) updated, but always test thoroughly after updates.

By following these guidelines, you can help ensure that the widget remains stable, functional, and easy to maintain as it evolves.

## Google Sheets Setup

1. **Create a Google Apps Script**:
   ```javascript
   function convertToJson(data) {
     const headers = data[0]
     const raw_data = data.slice(1,)
     let json = []
     raw_data.forEach(d => {
         let object = {}
         for (let i = 0; i < headers.length; i++) {
           object[headers[i]] = d[i]
         }
         json.push(object)
     });
     return json
   }

   function json(sheetName) {
     const spreadsheet = SpreadsheetApp.getActiveSpreadsheet()
     const sheet = spreadsheet.getSheetByName(sheetName)
     const data = sheet.getDataRange().getValues()
     const jsonData = convertToJson(data)
     return ContentService
           .createTextOutput(JSON.stringify(jsonData))
           .setMimeType(ContentService.MimeType.JSON)
   }

   function doGet(e) {
     const path = e.parameter.path
     return json(path)
   }
   ```

2. **Deploy as Web App**:
   - In Google Apps Script editor, click "Deploy" > "New deployment"
   - Choose "Web app" as the deployment type
   - Set "Execute as" to your account
   - Set "Who has access" to "Anyone"
   - Click "Deploy"
   - Copy the web app URL

3. **Update Widget Configuration**:
   - Replace 'YOUR_SCRIPT_URL' in the code with your deployed web app URL

4. **CORS Note**:
   - Google Apps Script handles CORS automatically
   - No additional configuration needed

5. **Security Considerations**:
   - The web app URL is public but can be restricted if needed
   - Consider implementing caching to reduce API calls
   - Monitor usage through Google Apps Script dashboard
