// Build script for Travel Planner extension
const fs = require('fs');
const path = require('path');

console.log('Building Travel Planner extension...');

// Create dist directory
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Files to copy
const filesToCopy = [
  'manifest.json',
  'popup/popup.html',
  'popup/popup.css',
  'popup/popup.js',
  'content/content.js',
  'background/background.js',
  'styles/content.css',
  'icons/icon16.png',
  'icons/icon48.png',
  'icons/icon128.png'
];

// Create directories and copy files
filesToCopy.forEach(file => {
  const srcPath = path.join(__dirname, file);
  const destPath = path.join(distDir, file);
  const destDir = path.dirname(destPath);

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
    console.log(`Copied: ${file}`);
  } else {
    console.warn(`Warning: ${file} not found`);
  }
});

console.log('Build complete! Extension files are in the dist directory.');
console.log('To install: Open chrome://extensions, enable Developer mode, and load the dist folder.');
