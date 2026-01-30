// Page Summary Extension - Popup Script

// State
let isAuthenticated = false;
let currentUser = null;
let currentSummary = null;
let savedSummaries = [];

// DOM Elements
const signInBtn = document.getElementById('signInBtn');
const signInBtn2 = document.getElementById('signInBtn2');
const signOutBtn = document.getElementById('signOutBtn');
const userInfo = document.getElementById('userInfo');
const userName = document.getElementById('userName');
const pageTitle = document.getElementById('pageTitle');
const pageUrl = document.getElementById('pageUrl');
const summarizeBtn = document.getElementById('summarizeBtn');
const resultSection = document.getElementById('resultSection');
const summaryContent = document.getElementById('summaryContent');
const keyPointsSection = document.getElementById('keyPointsSection');
const keyPointsList = document.getElementById('keyPointsList');
const saveBtn = document.getElementById('saveBtn');
const savedMessage = document.getElementById('savedMessage');
const tabs = document.querySelectorAll('.tab');
const summarizeTab = document.getElementById('summarizeTab');
const dashboardTab = document.getElementById('dashboardTab');
const loginPrompt = document.getElementById('loginPrompt');
const summariesList = document.getElementById('summariesList');
const emptyDashboard = document.getElementById('emptyDashboard');

// Stats elements
const wordCount = document.getElementById('wordCount');
const linkCount = document.getElementById('linkCount');
const imageCount = document.getElementById('imageCount');
const headingCount = document.getElementById('headingCount');

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
  await checkAuthStatus();
  await loadCurrentPage();
  setupEventListeners();
}

async function loadCurrentPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    pageTitle.textContent = tab.title || 'Untitled Page';
    try {
      pageUrl.textContent = new URL(tab.url).hostname;
    } catch {
      pageUrl.textContent = tab.url;
    }
  }
}

function setupEventListeners() {
  signInBtn.addEventListener('click', handleSignIn);
  signInBtn2.addEventListener('click', handleSignIn);
  signOutBtn.addEventListener('click', handleSignOut);
  summarizeBtn.addEventListener('click', handleSummarize);
  saveBtn.addEventListener('click', handleSave);

  tabs.forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });
}

// Auth Functions
async function checkAuthStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getAuthStatus' });
    if (response && response.isAuthenticated) {
      isAuthenticated = true;
      currentUser = response.user;
      showAuthenticatedUI();
    } else {
      showUnauthenticatedUI();
    }
  } catch (error) {
    console.error('Auth check error:', error);
    showUnauthenticatedUI();
  }
}

function showAuthenticatedUI() {
  signInBtn.classList.add('hidden');
  userInfo.classList.remove('hidden');
  userName.textContent = currentUser?.name || currentUser?.email || 'User';
  loginPrompt.classList.add('hidden');
}

function showUnauthenticatedUI() {
  signInBtn.classList.remove('hidden');
  userInfo.classList.add('hidden');
  loginPrompt.classList.remove('hidden');
  summariesList.classList.add('hidden');
  emptyDashboard.classList.add('hidden');
}

async function handleSignIn() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'signIn' });
    if (response && response.success) {
      isAuthenticated = true;
      currentUser = response.user;
      showAuthenticatedUI();
      if (dashboardTab.classList.contains('active')) {
        await loadSummaries();
      }
    } else {
      alert('Sign in failed: ' + (response?.error || 'Unknown error'));
    }
  } catch (error) {
    alert('Sign in error: ' + error.message);
  }
}

async function handleSignOut() {
  try {
    await chrome.runtime.sendMessage({ action: 'signOut' });
    isAuthenticated = false;
    currentUser = null;
    savedSummaries = [];
    showUnauthenticatedUI();
  } catch (error) {
    console.error('Sign out error:', error);
  }
}

// Tab switching
function switchTab(tabName) {
  tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));

  if (tabName === 'summarize') {
    summarizeTab.classList.remove('hidden');
    dashboardTab.classList.add('hidden');
  } else {
    summarizeTab.classList.add('hidden');
    dashboardTab.classList.remove('hidden');
    if (isAuthenticated) {
      loadSummaries();
    }
  }
}

// Summarize Functions
async function handleSummarize() {
  summarizeBtn.disabled = true;
  summarizeBtn.textContent = '⏳ Analyzing...';
  resultSection.classList.add('hidden');
  savedMessage.classList.add('hidden');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    alert('Cannot analyze this page.');
    resetSummarizeBtn();
    return;
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: analyzePage
    });

    const analysis = results[0]?.result;
    if (analysis) {
      currentSummary = {
        title: tab.title,
        url: tab.url,
        ...analysis,
        createdAt: new Date().toISOString()
      };
      displayResults(analysis);
    } else {
      alert('Could not analyze this page.');
    }
  } catch (error) {
    console.error('Analysis error:', error);
    alert('Error: ' + error.message);
  }

  resetSummarizeBtn();
}

function resetSummarizeBtn() {
  summarizeBtn.disabled = false;
  summarizeBtn.textContent = '✨ Summarize This Page';
}

function displayResults(analysis) {
  wordCount.textContent = analysis.stats.words.toLocaleString();
  linkCount.textContent = analysis.stats.links.toLocaleString();
  imageCount.textContent = analysis.stats.images.toLocaleString();
  headingCount.textContent = analysis.stats.headings.toLocaleString();

  summaryContent.textContent = analysis.summary;

  if (analysis.keyPoints.length > 0) {
    keyPointsList.innerHTML = analysis.keyPoints
      .map(point => `<li>${escapeHtml(point)}</li>`)
      .join('');
    keyPointsSection.classList.remove('hidden');
  } else {
    keyPointsSection.classList.add('hidden');
  }

  resultSection.classList.remove('hidden');

  if (isAuthenticated) {
    saveBtn.classList.remove('hidden');
  } else {
    saveBtn.classList.add('hidden');
  }
}

// Save Functions
async function handleSave() {
  if (!currentSummary || !isAuthenticated) return;

  saveBtn.disabled = true;
  saveBtn.textContent = '💾 Saving...';

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'saveSummary',
      data: currentSummary
    });

    if (response && response.success) {
      saveBtn.classList.add('hidden');
      savedMessage.classList.remove('hidden');
    } else {
      alert('Failed to save: ' + (response?.error || 'Unknown error'));
    }
  } catch (error) {
    alert('Save error: ' + error.message);
  }

  saveBtn.disabled = false;
  saveBtn.textContent = '💾 Save to Dashboard';
}

// Dashboard Functions
async function loadSummaries() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getSummaries' });

    if (response && Array.isArray(response.summaries)) {
      savedSummaries = response.summaries;
      renderSummaries();
    } else {
      savedSummaries = [];
      renderSummaries();
    }
  } catch (error) {
    console.error('Load summaries error:', error);
    savedSummaries = [];
    renderSummaries();
  }
}

function renderSummaries() {
  loginPrompt.classList.add('hidden');

  if (savedSummaries.length === 0) {
    summariesList.classList.add('hidden');
    emptyDashboard.classList.remove('hidden');
    return;
  }

  emptyDashboard.classList.add('hidden');
  summariesList.classList.remove('hidden');

  summariesList.innerHTML = savedSummaries.map(summary => `
    <div class="summary-card">
      <div class="summary-card-header">
        <h4>${escapeHtml(summary.title)}</h4>
        <button class="delete-btn" data-id="${summary.id}">×</button>
      </div>
      <a href="${escapeHtml(summary.url)}" target="_blank" class="summary-url">${escapeHtml(new URL(summary.url).hostname)}</a>
      <p class="summary-text">${escapeHtml(summary.summary)}</p>
      <div class="summary-meta">
        <span>${summary.stats?.words || 0} words</span>
        <span>${formatDate(summary.createdAt)}</span>
      </div>
    </div>
  `).join('');

  // Add delete handlers
  summariesList.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => handleDelete(btn.dataset.id));
  });
}

async function handleDelete(id) {
  if (!confirm('Delete this summary?')) return;

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'deleteSummary',
      id
    });

    if (response && response.success) {
      await loadSummaries();
    }
  } catch (error) {
    console.error('Delete error:', error);
  }
}

// Utilities
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString();
}

// This function runs in the context of the webpage
function analyzePage() {
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

  const keyPoints = [];
  headings.forEach(h => {
    const text = h.innerText.trim();
    if (text.length > 3 && text.length < 150 && !text.match(/^(menu|navigation|search|login|sign)/i)) {
      keyPoints.push(text);
    }
  });

  let summary = '';
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc && metaDesc.content) {
    summary = metaDesc.content;
  } else {
    const firstP = document.querySelector('article p, main p, .content p, p');
    if (firstP) {
      summary = firstP.innerText.substring(0, 300);
      if (firstP.innerText.length > 300) summary += '...';
    } else {
      summary = bodyText.substring(0, 300).trim();
      if (bodyText.length > 300) summary += '...';
    }
  }

  return { stats, summary, keyPoints: keyPoints.slice(0, 8) };
}
