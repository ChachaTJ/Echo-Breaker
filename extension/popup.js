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
  
  // Feature toggles
  const recCardsToggle = document.getElementById('rec-cards-toggle');
  const stanceOverlaysToggle = document.getElementById('stance-overlays-toggle');
  const collectShortsToggle = document.getElementById('collect-shorts-toggle');
  
  // DOM Status elements
  const domStatus = document.getElementById('dom-status');
  const domStatusTitle = document.getElementById('dom-status-title');
  const domStatusDesc = document.getElementById('dom-status-desc');
  const domRefreshBtn = document.getElementById('dom-refresh-btn');

  // Check DOM access status first
  await checkDomAccess();

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
    
    // Load feature toggles
    if (settings.enableRecCards !== false) {
      recCardsToggle.classList.add('active');
    } else {
      recCardsToggle.classList.remove('active');
    }
    
    if (settings.enableStanceOverlays !== false) {
      stanceOverlaysToggle.classList.add('active');
    } else {
      stanceOverlaysToggle.classList.remove('active');
    }
    
    if (settings.collectShorts !== false) {
      collectShortsToggle.classList.add('active');
    } else {
      collectShortsToggle.classList.remove('active');
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

  // Check DOM access
  async function checkDomAccess() {
    try {
      // Find active YouTube tab
      const tabs = await chrome.tabs.query({ 
        active: true,
        currentWindow: true
      });
      
      const activeTab = tabs[0];
      
      // Check if it's a YouTube page
      if (!activeTab || !activeTab.url || 
          (!activeTab.url.includes('youtube.com') && !activeTab.url.includes('youtu.be'))) {
        // Not on YouTube
        domStatus.className = 'dom-status warning';
        domStatusTitle.textContent = 'YouTube 페이지가 아닙니다';
        domStatusDesc.textContent = 'YouTube를 열어주세요';
        return;
      }
      
      // Try to send a ping to content script
      try {
        const response = await chrome.tabs.sendMessage(activeTab.id, { type: 'GET_STATUS' });
        
        if (response) {
          // Content script is responding
          domStatus.className = 'dom-status success';
          domStatusTitle.textContent = 'DOM 접근 가능';
          domStatusDesc.textContent = `페이지 타입: ${translatePageType(response.pageType)}`;
        } else {
          throw new Error('No response');
        }
      } catch (msgError) {
        // Content script not responding
        console.log('Content script not responding:', msgError.message);
        domStatus.className = 'dom-status error';
        domStatusTitle.textContent = 'DOM 접근 불가';
        domStatusDesc.textContent = '페이지를 새로고침(F5)해주세요';
      }
      
    } catch (error) {
      console.error('Error checking DOM access:', error);
      domStatus.className = 'dom-status error';
      domStatusTitle.textContent = '상태 확인 실패';
      domStatusDesc.textContent = error.message;
    }
  }
  
  function translatePageType(pageType) {
    const translations = {
      'home': '홈',
      'watch': '동영상 시청',
      'subscriptions': '구독',
      'history': '시청 기록',
      'channel': '채널',
      'other': '기타'
    };
    return translations[pageType] || pageType;
  }

  // Refresh button - reload YouTube tab
  domRefreshBtn.addEventListener('click', async () => {
    try {
      const tabs = await chrome.tabs.query({ 
        active: true,
        currentWindow: true
      });
      
      if (tabs[0] && tabs[0].url && tabs[0].url.includes('youtube.com')) {
        await chrome.tabs.reload(tabs[0].id);
        
        // Wait and recheck
        domStatus.className = 'dom-status';
        domStatusTitle.textContent = '새로고침 중...';
        domStatusDesc.textContent = '잠시만 기다려주세요';
        
        setTimeout(async () => {
          await checkDomAccess();
        }, 3000);
      } else {
        // Open YouTube if not on YouTube
        await chrome.tabs.create({ url: 'https://www.youtube.com' });
      }
    } catch (error) {
      console.error('Failed to refresh:', error);
    }
  });

  // Toggle click handlers
  autoSyncToggle.addEventListener('click', () => {
    autoSyncToggle.classList.toggle('active');
  });
  
  recCardsToggle.addEventListener('click', () => {
    recCardsToggle.classList.toggle('active');
  });
  
  stanceOverlaysToggle.addEventListener('click', () => {
    stanceOverlaysToggle.classList.toggle('active');
  });
  
  collectShortsToggle.addEventListener('click', () => {
    collectShortsToggle.classList.toggle('active');
  });

  // Save settings
  saveSettingsBtn.addEventListener('click', async () => {
    const newSettings = {
      apiUrl: apiUrlInput.value.trim() || DEFAULT_API_URL,
      autoSync: autoSyncToggle.classList.contains('active'),
      enableRecCards: recCardsToggle.classList.contains('active'),
      enableStanceOverlays: stanceOverlaysToggle.classList.contains('active'),
      collectShorts: collectShortsToggle.classList.contains('active')
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
        
        // Recheck DOM status
        await checkDomAccess();
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
  
  // =========================
  // Debug Tab Functionality
  // =========================
  
  const refreshLogsBtn = document.getElementById('refresh-logs-btn');
  const clearLogsBtn = document.getElementById('clear-logs-btn');
  const debugLogsContainer = document.getElementById('debug-logs');
  const debugEmpty = document.getElementById('debug-empty');
  
  // Load logs when Debug tab is opened
  tabs.forEach(tab => {
    tab.addEventListener('click', async () => {
      if (tab.dataset.tab === 'debug') {
        await loadDebugLogs();
      }
    });
  });
  
  // Refresh logs button
  refreshLogsBtn.addEventListener('click', async () => {
    refreshLogsBtn.style.transform = 'rotate(360deg)';
    await loadDebugLogs();
    setTimeout(() => {
      refreshLogsBtn.style.transform = '';
    }, 300);
  });
  
  // Clear logs button
  clearLogsBtn.addEventListener('click', async () => {
    try {
      await chrome.runtime.sendMessage({ type: 'CLEAR_DEBUG_LOGS' });
      await loadDebugLogs();
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  });
  
  async function loadDebugLogs() {
    try {
      const logs = await chrome.runtime.sendMessage({ type: 'GET_DEBUG_LOGS' });
      
      if (!logs || logs.length === 0) {
        debugEmpty.style.display = 'flex';
        debugLogsContainer.innerHTML = '';
        return;
      }
      
      debugEmpty.style.display = 'none';
      debugLogsContainer.innerHTML = logs.map(log => renderLogEntry(log)).join('');
      
    } catch (error) {
      console.error('Failed to load debug logs:', error);
      debugEmpty.style.display = 'flex';
      debugLogsContainer.innerHTML = '';
    }
  }
  
  function renderLogEntry(log) {
    const time = new Date(log.timestamp);
    const timeStr = time.toLocaleTimeString('ko-KR', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
    
    const level = log.level || 'info';
    const hasDetails = log.details && Object.keys(log.details).length > 0;
    
    let detailsHtml = '';
    if (hasDetails) {
      detailsHtml = `<div class="debug-log-details">${JSON.stringify(log.details, null, 2)}</div>`;
    }
    
    return `
      <div class="debug-log-entry ${level}">
        <div class="debug-log-header">
          <span class="debug-log-time">${timeStr}</span>
          <span class="debug-log-level ${level}">${translateLevel(level)}</span>
        </div>
        <div class="debug-log-message">${escapeHtml(log.message)}</div>
        ${detailsHtml}
      </div>
    `;
  }
  
  function translateLevel(level) {
    const translations = {
      'info': '정보',
      'success': '성공',
      'warning': '경고',
      'error': '오류'
    };
    return translations[level] || level;
  }
  
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
});
