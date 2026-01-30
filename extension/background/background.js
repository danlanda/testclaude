// Background service worker for Page Summary extension

const API_BASE_URL = 'http://localhost:3000/api';

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request).then(sendResponse);
  return true;
});

async function handleMessage(request) {
  switch (request.action) {
    case 'signIn':
      return handleSignIn();
    case 'signOut':
      return handleSignOut();
    case 'getAuthStatus':
      return handleGetAuthStatus();
    case 'saveSummary':
      return handleSaveSummary(request.data);
    case 'getSummaries':
      return handleGetSummaries();
    case 'deleteSummary':
      return handleDeleteSummary(request.id);
    default:
      return { error: 'Unknown action' };
  }
}

// Auth: Sign In with Google
async function handleSignIn() {
  try {
    const authResult = await chrome.identity.getAuthToken({ interactive: true });

    if (!authResult.token) {
      throw new Error('No auth token received');
    }

    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${authResult.token}` }
    });

    if (!userInfoResponse.ok) {
      throw new Error('Failed to get user info');
    }

    const userInfo = await userInfoResponse.json();

    // Try to authenticate with backend
    let backendToken = null;
    try {
      const response = await fetch(`${API_BASE_URL}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ googleToken: authResult.token })
      });

      if (response.ok) {
        const data = await response.json();
        backendToken = data.token;
      }
    } catch (e) {
      console.log('Backend not available, using local storage');
    }

    const user = {
      id: userInfo.id,
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture
    };

    await chrome.storage.local.set({
      authToken: backendToken,
      googleToken: authResult.token,
      user
    });

    return { success: true, user };
  } catch (error) {
    console.error('Sign in error:', error);
    return { error: error.message };
  }
}

// Auth: Sign Out
async function handleSignOut() {
  try {
    const data = await chrome.storage.local.get(['googleToken']);
    if (data.googleToken) {
      await chrome.identity.removeCachedAuthToken({ token: data.googleToken });
    }
    await chrome.storage.local.remove(['authToken', 'googleToken', 'user', 'summaries']);
    return { success: true };
  } catch (error) {
    console.error('Sign out error:', error);
    return { error: error.message };
  }
}

// Auth: Check Status
async function handleGetAuthStatus() {
  try {
    const data = await chrome.storage.local.get(['user', 'authToken']);
    if (data.user) {
      return { isAuthenticated: true, user: data.user };
    }
    return { isAuthenticated: false };
  } catch (error) {
    return { isAuthenticated: false };
  }
}

// Summary: Save
async function handleSaveSummary(summaryData) {
  try {
    const data = await chrome.storage.local.get(['authToken', 'summaries', 'user']);

    // Try backend first
    if (data.authToken) {
      try {
        const response = await fetch(`${API_BASE_URL}/summaries`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${data.authToken}`
          },
          body: JSON.stringify(summaryData)
        });

        if (response.ok) {
          return { success: true, summary: await response.json() };
        }
      } catch (e) {
        console.log('Backend not available, saving locally');
      }
    }

    // Fallback to local storage
    const summaries = data.summaries || [];
    const newSummary = {
      id: Date.now().toString(),
      ...summaryData
    };
    summaries.unshift(newSummary);
    await chrome.storage.local.set({ summaries });

    return { success: true, summary: newSummary };
  } catch (error) {
    console.error('Save summary error:', error);
    return { error: error.message };
  }
}

// Summary: Get All
async function handleGetSummaries() {
  try {
    const data = await chrome.storage.local.get(['authToken', 'summaries']);

    // Try backend first
    if (data.authToken) {
      try {
        const response = await fetch(`${API_BASE_URL}/summaries`, {
          headers: { 'Authorization': `Bearer ${data.authToken}` }
        });

        if (response.ok) {
          const summaries = await response.json();
          return { summaries };
        }
      } catch (e) {
        console.log('Backend not available, using local storage');
      }
    }

    // Fallback to local storage
    return { summaries: data.summaries || [] };
  } catch (error) {
    console.error('Get summaries error:', error);
    return { summaries: [] };
  }
}

// Summary: Delete
async function handleDeleteSummary(id) {
  try {
    const data = await chrome.storage.local.get(['authToken', 'summaries']);

    // Try backend first
    if (data.authToken) {
      try {
        const response = await fetch(`${API_BASE_URL}/summaries/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${data.authToken}` }
        });

        if (response.ok) {
          return { success: true };
        }
      } catch (e) {
        console.log('Backend not available, deleting locally');
      }
    }

    // Fallback to local storage
    const summaries = (data.summaries || []).filter(s => s.id !== id);
    await chrome.storage.local.set({ summaries });

    return { success: true };
  } catch (error) {
    console.error('Delete summary error:', error);
    return { error: error.message };
  }
}
