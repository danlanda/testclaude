// Background service worker for Travel Planner extension

const API_BASE_URL = 'http://localhost:3000/api';

// Store for extracted places before user is authenticated
let pendingPlaces = [];

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request, sender).then(sendResponse);
  return true; // Keep the message channel open for async response
});

async function handleMessage(request, sender) {
  switch (request.action) {
    case 'extractPlaces':
      return handleExtractPlaces(request.data, sender.tab);

    case 'getPlaces':
      return handleGetPlaces(request.filters);

    case 'savePlace':
      return handleSavePlace(request.place);

    case 'deletePlace':
      return handleDeletePlace(request.placeId);

    case 'updatePlace':
      return handleUpdatePlace(request.placeId, request.updates);

    case 'signIn':
      return handleSignIn();

    case 'signOut':
      return handleSignOut();

    case 'getAuthStatus':
      return handleGetAuthStatus();

    default:
      return { error: 'Unknown action' };
  }
}

// Extract places from page content
async function handleExtractPlaces(data, tab) {
  const { places, pageUrl, pageTitle } = data;

  const authStatus = await handleGetAuthStatus();

  if (!authStatus.isAuthenticated) {
    // Store places temporarily
    pendingPlaces = places.map(place => ({
      ...place,
      sourceUrl: pageUrl,
      sourceTitle: pageTitle
    }));
    return { success: true, pending: true, count: places.length };
  }

  // Save places to backend
  try {
    const token = await getStoredToken();
    const savedPlaces = [];

    for (const place of places) {
      const response = await fetch(`${API_BASE_URL}/places`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...place,
          sourceUrl: pageUrl,
          sourceTitle: pageTitle
        })
      });

      if (response.ok) {
        savedPlaces.push(await response.json());
      }
    }

    return { success: true, places: savedPlaces };
  } catch (error) {
    console.error('Error saving places:', error);
    return { error: error.message };
  }
}

// Get places with optional filters
async function handleGetPlaces(filters = {}) {
  const authStatus = await handleGetAuthStatus();

  if (!authStatus.isAuthenticated) {
    return { places: pendingPlaces, pending: true };
  }

  try {
    const token = await getStoredToken();
    const queryParams = new URLSearchParams();

    if (filters.category) queryParams.set('category', filters.category);
    if (filters.location) queryParams.set('location', filters.location);

    const response = await fetch(`${API_BASE_URL}/places?${queryParams}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch places');
    }

    const places = await response.json();
    return { places };
  } catch (error) {
    console.error('Error fetching places:', error);
    return { error: error.message };
  }
}

// Save a single place
async function handleSavePlace(place) {
  const authStatus = await handleGetAuthStatus();

  if (!authStatus.isAuthenticated) {
    pendingPlaces.push(place);
    return { success: true, pending: true };
  }

  try {
    const token = await getStoredToken();
    const response = await fetch(`${API_BASE_URL}/places`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(place)
    });

    if (!response.ok) {
      throw new Error('Failed to save place');
    }

    return { success: true, place: await response.json() };
  } catch (error) {
    console.error('Error saving place:', error);
    return { error: error.message };
  }
}

// Delete a place
async function handleDeletePlace(placeId) {
  try {
    const token = await getStoredToken();
    const response = await fetch(`${API_BASE_URL}/places/${placeId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to delete place');
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting place:', error);
    return { error: error.message };
  }
}

// Update a place
async function handleUpdatePlace(placeId, updates) {
  try {
    const token = await getStoredToken();
    const response = await fetch(`${API_BASE_URL}/places/${placeId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(updates)
    });

    if (!response.ok) {
      throw new Error('Failed to update place');
    }

    return { success: true, place: await response.json() };
  } catch (error) {
    console.error('Error updating place:', error);
    return { error: error.message };
  }
}

// Handle Google Sign In
async function handleSignIn() {
  try {
    // Use Chrome Identity API for OAuth
    const authResult = await chrome.identity.getAuthToken({ interactive: true });

    if (!authResult.token) {
      throw new Error('No auth token received');
    }

    // Exchange Google token for our backend token
    const response = await fetch(`${API_BASE_URL}/auth/google`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ googleToken: authResult.token })
    });

    if (!response.ok) {
      throw new Error('Backend authentication failed');
    }

    const { token, user } = await response.json();

    // Store the backend token
    await chrome.storage.local.set({ authToken: token, user });

    // Sync any pending places
    if (pendingPlaces.length > 0) {
      for (const place of pendingPlaces) {
        await handleSavePlace(place);
      }
      pendingPlaces = [];
    }

    return { success: true, user };
  } catch (error) {
    console.error('Sign in error:', error);
    return { error: error.message };
  }
}

// Handle Sign Out
async function handleSignOut() {
  try {
    // Clear stored token
    await chrome.storage.local.remove(['authToken', 'user']);

    // Revoke Chrome identity token
    const authResult = await chrome.identity.getAuthToken({ interactive: false });
    if (authResult?.token) {
      await chrome.identity.removeCachedAuthToken({ token: authResult.token });
    }

    return { success: true };
  } catch (error) {
    console.error('Sign out error:', error);
    return { error: error.message };
  }
}

// Check authentication status
async function handleGetAuthStatus() {
  try {
    const result = await chrome.storage.local.get(['authToken', 'user']);

    if (result.authToken && result.user) {
      // Verify token is still valid
      const response = await fetch(`${API_BASE_URL}/auth/verify`, {
        headers: {
          'Authorization': `Bearer ${result.authToken}`
        }
      });

      if (response.ok) {
        return { isAuthenticated: true, user: result.user };
      }

      // Token invalid, clear storage
      await chrome.storage.local.remove(['authToken', 'user']);
    }

    return { isAuthenticated: false };
  } catch (error) {
    return { isAuthenticated: false };
  }
}

// Get stored auth token
async function getStoredToken() {
  const result = await chrome.storage.local.get(['authToken']);
  return result.authToken;
}

// Listen for installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Travel Planner extension installed');
  }
});
