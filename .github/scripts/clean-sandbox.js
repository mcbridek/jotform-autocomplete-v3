const fs = require('fs');
const path = require('path');

const filesToClean = [
  'main.js',
  'styles.css',
  'index.html',
  'widget.json'
];

filesToClean.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Remove sandbox-specific code
    content = content.replace(/\/\/ SANDBOX START[\s\S]*?\/\/ SANDBOX END/g, '');
    content = content.replace(/<!-- SANDBOX START[\s\S]*?SANDBOX END -->/g, '');

    // Remove empty lines
    content = content.replace(/^\s*[\r\n]/gm, '');

    fs.writeFileSync(filePath, content);
    console.log(`Cleaned ${file}`);
  } else {
    console.log(`File not found: ${file}`);
  }
});

// Remove sandbox.html
const sandboxPath = path.join(process.cwd(), 'sandbox.html');
if (fs.existsSync(sandboxPath)) {
  fs.unlinkSync(sandboxPath);
  console.log('Removed sandbox.html');
}
