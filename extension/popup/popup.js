// Page Summary Extension - Popup Script

// DOM Elements
const pageTitle = document.getElementById('pageTitle');
const pageUrl = document.getElementById('pageUrl');
const summarizeBtn = document.getElementById('summarizeBtn');
const summarySection = document.getElementById('summarySection');
const summaryContent = document.getElementById('summaryContent');
const statsSection = document.getElementById('statsSection');
const keyPointsSection = document.getElementById('keyPointsSection');
const keyPointsList = document.getElementById('keyPointsList');

// Stats elements
const wordCount = document.getElementById('wordCount');
const linkCount = document.getElementById('linkCount');
const imageCount = document.getElementById('imageCount');
const headingCount = document.getElementById('headingCount');

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
  // Get current tab info
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (tab) {
    pageTitle.textContent = tab.title || 'Untitled Page';
    pageUrl.textContent = new URL(tab.url).hostname;
  }

  // Setup button
  summarizeBtn.addEventListener('click', handleSummarize);
}

async function handleSummarize() {
  summarizeBtn.disabled = true;
  summarizeBtn.textContent = '⏳ Analyzing...';

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Check if we can analyze this page
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    alert('Cannot analyze this page. Please navigate to a regular website.');
    resetButton();
    return;
  }

  try {
    // Execute analysis function in the page
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: analyzePage
    });

    const analysis = results[0]?.result;

    if (analysis) {
      displayResults(analysis);
    } else {
      alert('Could not analyze this page.');
    }
  } catch (error) {
    console.error('Analysis error:', error);
    alert('Error: ' + error.message);
  }

  resetButton();
}

function resetButton() {
  summarizeBtn.disabled = false;
  summarizeBtn.textContent = '✨ Summarize This Page';
}

function displayResults(analysis) {
  // Show stats
  wordCount.textContent = analysis.stats.words.toLocaleString();
  linkCount.textContent = analysis.stats.links.toLocaleString();
  imageCount.textContent = analysis.stats.images.toLocaleString();
  headingCount.textContent = analysis.stats.headings.toLocaleString();
  statsSection.classList.remove('hidden');

  // Show summary
  summaryContent.textContent = analysis.summary;
  summarySection.classList.remove('hidden');

  // Show key points
  if (analysis.keyPoints.length > 0) {
    keyPointsList.innerHTML = analysis.keyPoints
      .map(point => `<li>${escapeHtml(point)}</li>`)
      .join('');
    keyPointsSection.classList.remove('hidden');
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// This function runs in the context of the webpage
function analyzePage() {
  // Get page stats
  const bodyText = document.body.innerText || '';
  const words = bodyText.split(/\s+/).filter(w => w.length > 0);
  const links = document.querySelectorAll('a[href]');
  const images = document.querySelectorAll('img');
  const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');

  const stats = {
    words: words.length,
    links: links.length,
    images: images.length,
    headings: headings.length
  };

  // Extract key points from headings
  const keyPoints = [];
  headings.forEach(h => {
    const text = h.innerText.trim();
    if (text.length > 3 && text.length < 150 && !text.match(/^(menu|navigation|search|login|sign)/i)) {
      keyPoints.push(text);
    }
  });

  // Generate summary
  let summary = '';

  // Get meta description
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc && metaDesc.content) {
    summary = metaDesc.content;
  } else {
    // Get first paragraph
    const firstP = document.querySelector('article p, main p, .content p, p');
    if (firstP) {
      summary = firstP.innerText.substring(0, 300);
      if (firstP.innerText.length > 300) summary += '...';
    } else {
      // Fallback to first 300 chars of body
      summary = bodyText.substring(0, 300).trim();
      if (bodyText.length > 300) summary += '...';
    }
  }

  return {
    stats,
    summary,
    keyPoints: keyPoints.slice(0, 8) // Limit to 8 key points
  };
}
