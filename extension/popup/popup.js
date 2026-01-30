// Travel Planner Extension Popup Script

// State
let isAuthenticated = false;
let currentUser = null;
let places = [];
let filteredPlaces = [];
let map = null;
let markers = [];

// DOM Elements
const signInBtn = document.getElementById('signInBtn');
const signInBtnMain = document.getElementById('signInBtnMain');
const signOutBtn = document.getElementById('signOutBtn');
const userInfo = document.getElementById('userInfo');
const userAvatar = document.getElementById('userAvatar');
const userName = document.getElementById('userName');
const authRequired = document.getElementById('authRequired');
const mainContent = document.getElementById('mainContent');
const placesList = document.getElementById('placesList');
const emptyState = document.getElementById('emptyState');
const categoryFilter = document.getElementById('categoryFilter');
const locationFilter = document.getElementById('locationFilter');
const scanPageBtn = document.getElementById('scanPageBtn');
const addPlaceBtn = document.getElementById('addPlaceBtn');
const addPlaceModal = document.getElementById('addPlaceModal');
const addPlaceForm = document.getElementById('addPlaceForm');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelAddBtn = document.getElementById('cancelAddBtn');
const tabs = document.querySelectorAll('.tab');
const listView = document.getElementById('listView');
const mapView = document.getElementById('mapView');

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
  await checkAuthStatus();
  setupEventListeners();
  await loadPlaces();
}

// Check authentication status
async function checkAuthStatus() {
  const response = await chrome.runtime.sendMessage({ action: 'getAuthStatus' });

  if (response.isAuthenticated) {
    isAuthenticated = true;
    currentUser = response.user;
    showAuthenticatedUI();
  } else {
    isAuthenticated = false;
    currentUser = null;
    showUnauthenticatedUI();
  }
}

// Show UI for authenticated users
function showAuthenticatedUI() {
  signInBtn.classList.add('hidden');
  authRequired.classList.add('hidden');
  userInfo.classList.remove('hidden');
  mainContent.classList.remove('hidden');
  addPlaceBtn.classList.remove('hidden');

  if (currentUser) {
    userAvatar.src = currentUser.picture || 'icons/icon48.png';
    userName.textContent = currentUser.name || currentUser.email;
  }
}

// Show UI for unauthenticated users
function showUnauthenticatedUI() {
  signInBtn.classList.remove('hidden');
  authRequired.classList.remove('hidden');
  userInfo.classList.add('hidden');
  mainContent.classList.add('hidden');
  addPlaceBtn.classList.add('hidden');
}

// Setup event listeners
function setupEventListeners() {
  // Auth buttons
  signInBtn.addEventListener('click', handleSignIn);
  signInBtnMain.addEventListener('click', handleSignIn);
  signOutBtn.addEventListener('click', handleSignOut);

  // Filters
  categoryFilter.addEventListener('change', filterPlaces);
  locationFilter.addEventListener('input', debounce(filterPlaces, 300));

  // Scan page
  scanPageBtn.addEventListener('click', handleScanPage);

  // Add place
  addPlaceBtn.addEventListener('click', () => addPlaceModal.classList.remove('hidden'));
  closeModalBtn.addEventListener('click', () => addPlaceModal.classList.add('hidden'));
  cancelAddBtn.addEventListener('click', () => addPlaceModal.classList.add('hidden'));
  addPlaceForm.addEventListener('submit', handleAddPlace);

  // Tabs
  tabs.forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });
}

// Handle sign in
async function handleSignIn() {
  signInBtn.disabled = true;
  signInBtnMain.disabled = true;

  const response = await chrome.runtime.sendMessage({ action: 'signIn' });

  if (response.success) {
    isAuthenticated = true;
    currentUser = response.user;
    showAuthenticatedUI();
    await loadPlaces();
  } else {
    alert('Sign in failed: ' + (response.error || 'Unknown error'));
  }

  signInBtn.disabled = false;
  signInBtnMain.disabled = false;
}

// Handle sign out
async function handleSignOut() {
  const response = await chrome.runtime.sendMessage({ action: 'signOut' });

  if (response.success) {
    isAuthenticated = false;
    currentUser = null;
    places = [];
    filteredPlaces = [];
    showUnauthenticatedUI();
  }
}

// Load places
async function loadPlaces() {
  const filters = {
    category: categoryFilter.value,
    location: locationFilter.value
  };

  const response = await chrome.runtime.sendMessage({
    action: 'getPlaces',
    filters
  });

  if (response.places) {
    places = response.places;
    filteredPlaces = places;
    renderPlaces();
  }
}

// Filter places
function filterPlaces() {
  const category = categoryFilter.value;
  const location = locationFilter.value.toLowerCase();

  filteredPlaces = places.filter(place => {
    const matchCategory = !category || place.category === category;
    const matchLocation = !location ||
      (place.location && place.location.toLowerCase().includes(location));
    return matchCategory && matchLocation;
  });

  renderPlaces();
  updateMapMarkers();
}

// Render places list
function renderPlaces() {
  if (filteredPlaces.length === 0) {
    placesList.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  placesList.innerHTML = filteredPlaces.map(place => `
    <div class="place-card" data-id="${place.id}">
      <div class="place-header">
        <span class="place-name">${escapeHtml(place.name)}</span>
        <span class="place-category ${place.category}">${formatCategory(place.category)}</span>
      </div>
      ${place.description ? `<p class="place-description">${escapeHtml(place.description)}</p>` : ''}
      ${place.location ? `
        <div class="place-location">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          ${escapeHtml(place.location)}
        </div>
      ` : ''}
      <div class="place-actions">
        ${place.bookingLink ? `
          <a href="${escapeHtml(place.bookingLink)}" target="_blank" class="place-action">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
            Book
          </a>
        ` : ''}
        <a href="${escapeHtml(place.mapsLink || generateMapsLink(place))}" target="_blank" class="place-action">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
          </svg>
          Map
        </a>
        <button class="place-action delete" onclick="deletePlace('${place.id}')">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
          Delete
        </button>
      </div>
    </div>
  `).join('');
}

// Handle scan page
async function handleScanPage() {
  scanPageBtn.disabled = true;
  scanPageBtn.innerHTML = `
    <div class="spinner" style="width: 16px; height: 16px; border-width: 2px;"></div>
    Scanning...
  `;

  // Get the active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Check if we can scan this page
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    alert('Cannot scan this page. Please navigate to a regular website.');
    resetScanButton();
    return;
  }

  try {
    // First, try to inject the content script (in case it wasn't loaded)
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/content.js']
    });
  } catch (injectionError) {
    console.log('Script already injected or injection failed:', injectionError);
  }

  // Send message to content script to scan the page
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'scanPage' });

    if (response && response.places && response.places.length > 0) {
      // Send extracted places to background script
      await chrome.runtime.sendMessage({
        action: 'extractPlaces',
        data: {
          places: response.places,
          pageUrl: tab.url,
          pageTitle: tab.title
        }
      });

      // Reload places
      await loadPlaces();

      alert(`Found ${response.places.length} places!`);
    } else {
      alert('No places found on this page. Try a travel blog or guide.');
    }
  } catch (error) {
    console.error('Scan error:', error);
    alert('Could not scan this page. Please refresh the page and try again.');
  }

  resetScanButton();
}

function resetScanButton() {
  scanPageBtn.disabled = false;
  scanPageBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="11" cy="11" r="8"></circle>
      <path d="m21 21-4.35-4.35"></path>
    </svg>
    Scan Page
  `;
}

// Handle add place
async function handleAddPlace(e) {
  e.preventDefault();

  const place = {
    name: document.getElementById('placeName').value,
    description: document.getElementById('placeDescription').value,
    category: document.getElementById('placeCategory').value,
    location: document.getElementById('placeLocation').value,
    bookingLink: document.getElementById('placeBookingLink').value,
    mapsLink: generateMapsLink({
      name: document.getElementById('placeName').value,
      location: document.getElementById('placeLocation').value
    })
  };

  const response = await chrome.runtime.sendMessage({
    action: 'savePlace',
    place
  });

  if (response.success) {
    addPlaceModal.classList.add('hidden');
    addPlaceForm.reset();
    await loadPlaces();
  } else {
    alert('Failed to add place: ' + (response.error || 'Unknown error'));
  }
}

// Delete place
window.deletePlace = async function(placeId) {
  if (!confirm('Are you sure you want to delete this place?')) return;

  const response = await chrome.runtime.sendMessage({
    action: 'deletePlace',
    placeId
  });

  if (response.success) {
    await loadPlaces();
  } else {
    alert('Failed to delete place: ' + (response.error || 'Unknown error'));
  }
};

// Switch tab
function switchTab(tabName) {
  tabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });

  if (tabName === 'list') {
    listView.classList.remove('hidden');
    mapView.classList.add('hidden');
  } else {
    listView.classList.add('hidden');
    mapView.classList.remove('hidden');
    initMap();
  }
}

// Initialize map
function initMap() {
  if (map) {
    updateMapMarkers();
    return;
  }

  // Load Google Maps script dynamically
  if (!window.google) {
    const mapContainer = document.getElementById('map');
    mapContainer.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 24px; text-align: center;">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.5">
          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
          <line x1="8" y1="2" x2="8" y2="18"></line>
          <line x1="16" y1="6" x2="16" y2="22"></line>
        </svg>
        <h3 style="margin: 16px 0 8px; color: #333;">Map View</h3>
        <p style="color: #666; font-size: 13px;">
          Click on "Map" links for individual places to view them on Google Maps.
        </p>
        <p style="color: #888; font-size: 12px; margin-top: 16px;">
          Full map integration requires a Google Maps API key.
        </p>
      </div>
    `;
    return;
  }

  // Initialize map with Google Maps API
  map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 0, lng: 0 },
    zoom: 2
  });

  updateMapMarkers();
}

// Update map markers
function updateMapMarkers() {
  if (!map) return;

  // Clear existing markers
  markers.forEach(marker => marker.setMap(null));
  markers = [];

  // Add markers for each place with coordinates
  filteredPlaces.forEach(place => {
    if (place.latitude && place.longitude) {
      const marker = new google.maps.Marker({
        position: { lat: place.latitude, lng: place.longitude },
        map: map,
        title: place.name
      });

      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="max-width: 200px;">
            <strong>${escapeHtml(place.name)}</strong>
            ${place.description ? `<p style="font-size: 12px; margin: 8px 0;">${escapeHtml(place.description)}</p>` : ''}
            ${place.bookingLink ? `<a href="${escapeHtml(place.bookingLink)}" target="_blank" style="font-size: 12px;">Book Now</a>` : ''}
          </div>
        `
      });

      marker.addListener('click', () => {
        infoWindow.open(map, marker);
      });

      markers.push(marker);
    }
  });

  // Fit bounds if we have markers
  if (markers.length > 0) {
    const bounds = new google.maps.LatLngBounds();
    markers.forEach(marker => bounds.extend(marker.getPosition()));
    map.fitBounds(bounds);
  }
}

// Helper: Generate Google Maps link
function generateMapsLink(place) {
  const query = place.location
    ? `${place.name}, ${place.location}`
    : place.name;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

// Helper: Format category for display
function formatCategory(category) {
  const labels = {
    accommodation: 'Stay',
    activities: 'Activity',
    food: 'Food',
    transportation: 'Transport'
  };
  return labels[category] || category;
}

// Helper: Escape HTML
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Helper: Debounce
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
