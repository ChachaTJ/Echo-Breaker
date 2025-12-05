// EchoBreaker Popup Script

// Default API URL - Update this to your Replit URL
const DEFAULT_API_URL = 'https://046806e2-7cc7-45a7-8712-1a53ec91f00f-00-1k55bkxju0p0w.picard.replit.dev';

document.addEventListener('DOMContentLoaded', async () => {
  // Tab navigation
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.dataset.tab;
      
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(tc => tc.classList.remove('active'));
      
      tab.classList.add('active');
      document.getElementById(`tab-${tabId}`).classList.add('active');
    });
  });

  // Elements
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const videosCount = document.getElementById('videos-count');
  const recommendationsCount = document.getElementById('recommendations-count');
  const biasScore = document.getElementById('bias-score');
  const biasIndicator = document.getElementById('bias-indicator');
  const lastSyncEl = document.getElementById('last-sync');
  const syncBtn = document.getElementById('sync-btn');
  const dashboardBtn = document.getElementById('dashboard-btn');
  const apiUrlInput = document.getElementById('api-url');
  const autoSyncToggle = document.getElementById('auto-sync-toggle');
  const saveSettingsBtn = document.getElementById('save-settings-btn');
  const testConnectionBtn = document.getElementById('test-connection-btn');
  const saveSuccess = document.getElementById('save-success');

  // Load settings
  let settings = {};
  try {
    settings = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
    apiUrlInput.value = settings.apiUrl || DEFAULT_API_URL;
    
    if (settings.autoSync !== false) {
      autoSyncToggle.classList.add('active');
    } else {
      autoSyncToggle.classList.remove('active');
    }

    if (settings.lastSync) {
      const lastSync = new Date(settings.lastSync);
      lastSyncEl.textContent = `Last sync: ${formatTime(lastSync)}`;
    }

    // Load stats
    await loadStats(settings.apiUrl || DEFAULT_API_URL);
    
  } catch (error) {
    console.error('Failed to load settings:', error);
    statusDot.classList.add('error');
    statusText.textContent = 'Error';
  }

  // Auto-sync toggle
  autoSyncToggle.addEventListener('click', () => {
    autoSyncToggle.classList.toggle('active');
  });

  // Save settings
  saveSettingsBtn.addEventListener('click', async () => {
    const newSettings = {
      apiUrl: apiUrlInput.value.trim() || DEFAULT_API_URL,
      autoSync: autoSyncToggle.classList.contains('active')
    };

    try {
      await chrome.runtime.sendMessage({ 
        type: 'SAVE_SETTINGS', 
        settings: newSettings 
      });
      
      saveSuccess.style.display = 'block';
      setTimeout(() => {
        saveSuccess.style.display = 'none';
      }, 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  });

  // Test connection
  testConnectionBtn.addEventListener('click', async () => {
    const url = apiUrlInput.value.trim() || DEFAULT_API_URL;
    testConnectionBtn.disabled = true;
    testConnectionBtn.textContent = 'Testing...';

    try {
      const response = await fetch(`${url}/api/stats`);
      if (response.ok) {
        statusDot.classList.remove('error');
        statusText.textContent = 'Connected';
        testConnectionBtn.textContent = 'Connected!';
        await loadStats(url);
      } else {
        throw new Error('Server error');
      }
    } catch (error) {
      statusDot.classList.add('error');
      statusText.textContent = 'Failed';
      testConnectionBtn.textContent = 'Failed!';
    }

    setTimeout(() => {
      testConnectionBtn.disabled = false;
      testConnectionBtn.textContent = 'Test Connection';
    }, 2000);
  });

  // Sync button
  syncBtn.addEventListener('click', async () => {
    syncBtn.disabled = true;
    syncBtn.innerHTML = `
      <svg class="spinner" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
      </svg>
      Syncing...
    `;
    statusDot.classList.add('syncing');
    statusText.textContent = 'Syncing...';

    try {
      const result = await chrome.runtime.sendMessage({ type: 'TRIGGER_SYNC' });
      
      if (result.success) {
        statusDot.classList.remove('syncing');
        statusText.textContent = 'Synced!';
        lastSyncEl.textContent = `Last sync: Just now`;

        // Refresh stats
        const url = apiUrlInput.value.trim() || DEFAULT_API_URL;
        await loadStats(url);
      } else {
        throw new Error(result.error || 'Sync failed');
      }
    } catch (error) {
      statusDot.classList.remove('syncing');
      statusDot.classList.add('error');
      statusText.textContent = error.message || 'Sync failed';
    }

    syncBtn.disabled = false;
    syncBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
        <path d="M3 3v5h5"></path>
        <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path>
        <path d="M16 16h5v5"></path>
      </svg>
      Sync Now
    `;
  });

  // Dashboard button
  dashboardBtn.addEventListener('click', () => {
    const url = apiUrlInput.value.trim() || DEFAULT_API_URL;
    chrome.tabs.create({ url });
  });

  async function loadStats(apiUrl) {
    try {
      const response = await fetch(`${apiUrl}/api/stats`);
      if (!response.ok) throw new Error('Failed to fetch stats');
      
      const stats = await response.json();
      
      videosCount.textContent = stats.totalVideosAnalyzed || 0;
      recommendationsCount.textContent = stats.recommendationsGiven || 0;
      updateBiasDisplay(stats.biasScore || 50);
      
      statusDot.classList.remove('error');
      statusText.textContent = 'Connected';
      
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      statusDot.classList.add('error');
      statusText.textContent = 'Offline';
    }
  }

  function updateBiasDisplay(score) {
    biasScore.textContent = score;
    biasIndicator.style.left = `calc(${score}% - 2px)`;

    // Update color based on how far from balanced (50)
    const distance = Math.abs(score - 50);
    biasScore.classList.remove('warning', 'danger');
    
    if (distance > 30) {
      biasScore.classList.add('danger');
    } else if (distance > 15) {
      biasScore.classList.add('warning');
    }
  }

  function formatTime(date) {
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    
    return date.toLocaleDateString();
  }
});
