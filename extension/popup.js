// EchoBreaker Popup Script

document.addEventListener('DOMContentLoaded', async () => {
  const loading = document.getElementById('loading');
  const mainContent = document.getElementById('main-content');
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const videosCount = document.getElementById('videos-count');
  const recommendationsCount = document.getElementById('recommendations-count');
  const biasScore = document.getElementById('bias-score');
  const biasIndicator = document.getElementById('bias-indicator');
  const lastSyncEl = document.getElementById('last-sync');
  const syncBtn = document.getElementById('sync-btn');
  const dashboardBtn = document.getElementById('dashboard-btn');

  // Load data
  try {
    const settings = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
    const stats = await fetchStats(settings.apiUrl);

    if (stats) {
      videosCount.textContent = stats.totalVideosAnalyzed || 0;
      recommendationsCount.textContent = stats.recommendationsGiven || 0;
      updateBiasDisplay(stats.biasScore || 50);
    }

    if (settings.lastSync) {
      const lastSync = new Date(settings.lastSync);
      lastSyncEl.textContent = `Last sync: ${formatTime(lastSync)}`;
    }

    loading.style.display = 'none';
    mainContent.style.display = 'block';
    
  } catch (error) {
    console.error('Failed to load data:', error);
    statusDot.classList.add('error');
    statusText.textContent = 'Disconnected';
    loading.style.display = 'none';
    mainContent.style.display = 'block';
  }

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
        const settings = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
        const stats = await fetchStats(settings.apiUrl);
        if (stats) {
          videosCount.textContent = stats.totalVideosAnalyzed || 0;
          recommendationsCount.textContent = stats.recommendationsGiven || 0;
          updateBiasDisplay(stats.biasScore || 50);
        }
      } else {
        throw new Error(result.error || 'Sync failed');
      }
    } catch (error) {
      statusDot.classList.remove('syncing');
      statusDot.classList.add('error');
      statusText.textContent = 'Sync failed';
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
    chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' });
  });

  // Settings link
  document.getElementById('settings-link').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' });
  });
});

async function fetchStats(apiUrl) {
  try {
    const response = await fetch(`${apiUrl}/api/stats`);
    if (!response.ok) throw new Error('Failed to fetch stats');
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch stats:', error);
    return null;
  }
}

function updateBiasDisplay(score) {
  const biasScore = document.getElementById('bias-score');
  const biasIndicator = document.getElementById('bias-indicator');

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
