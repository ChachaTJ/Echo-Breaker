// EchoBreaker Background Service Worker
// Handles background tasks and messaging

// Extension version from manifest
const EXTENSION_VERSION = chrome.runtime.getManifest().version;

// Default settings - Update this URL to your Replit app URL
const DEFAULT_SETTINGS = {
  apiUrl: 'https://echo-breaker--chayoonmin.replit.app',
  autoSync: true,
  syncInterval: 15,
  lastSync: null,
  totalVideosCollected: 0,
  // Feature toggles
  enableRecCards: true,
  enableStanceOverlays: true,
  collectShorts: true
};

// Debug logging system
const MAX_DEBUG_LOGS = 50;
const DEBUG_LOGS_KEY = 'echobreaker_debug_logs';

async function addDebugLog(entry) {
  try {
    const stored = await chrome.storage.local.get([DEBUG_LOGS_KEY]);
    let logs = stored[DEBUG_LOGS_KEY] || [];
    
    // Add timestamp if not present
    const logEntry = {
      ...entry,
      timestamp: entry.timestamp || Date.now(),
      id: Date.now() + Math.random().toString(36).substr(2, 9)
    };
    
    // Add to beginning (newest first)
    logs.unshift(logEntry);
    
    // Trim to max size
    if (logs.length > MAX_DEBUG_LOGS) {
      logs = logs.slice(0, MAX_DEBUG_LOGS);
    }
    
    await chrome.storage.local.set({ [DEBUG_LOGS_KEY]: logs });
    console.log('[EchoBreaker] Log added:', logEntry.message);
    
    return logEntry;
  } catch (error) {
    console.error('[EchoBreaker] Failed to add debug log:', error);
    return null;
  }
}

async function getDebugLogs() {
  try {
    const stored = await chrome.storage.local.get([DEBUG_LOGS_KEY]);
    return stored[DEBUG_LOGS_KEY] || [];
  } catch (error) {
    console.error('[EchoBreaker] Failed to get debug logs:', error);
    return [];
  }
}

async function clearDebugLogs() {
  try {
    await chrome.storage.local.set({ [DEBUG_LOGS_KEY]: [] });
    console.log('[EchoBreaker] Debug logs cleared');
    return true;
  } catch (error) {
    console.error('[EchoBreaker] Failed to clear debug logs:', error);
    return false;
  }
}

// Initialize on install
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[EchoBreaker] Extension installed, version:', EXTENSION_VERSION);
  
  // Set default settings
  const stored = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  const settings = { ...DEFAULT_SETTINGS, ...stored };
  await chrome.storage.local.set(settings);
  
  // Create context menu for incognito viewing
  
  // Start ping interval
  startPingInterval();
});

// Start up - send initial ping
chrome.runtime.onStartup.addListener(() => {
  console.log('[EchoBreaker] Extension started');
  startPingInterval();
});

// Ping server to indicate extension is connected
let pingIntervalId = null;

async function pingServer() {
  try {
    const stored = await chrome.storage.local.get(['apiUrl']);
    const apiUrl = stored.apiUrl || DEFAULT_SETTINGS.apiUrl;
    
    const response = await fetch(`${apiUrl}/api/extension/ping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: EXTENSION_VERSION })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('[EchoBreaker] Ping successful, server version:', data.appVersion);
    }
  } catch (error) {
    console.log('[EchoBreaker] Ping failed:', error.message);
  }
}

function startPingInterval() {
  // Clear any existing interval
  if (pingIntervalId) {
    clearInterval(pingIntervalId);
  }
  
  // Send initial ping
  pingServer();
  
  // Ping every 2 minutes
  pingIntervalId = setInterval(pingServer, 2 * 60 * 1000);
}

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'SYNC_COMPLETE':
      handleSyncComplete(message.data);
      break;
    
    case 'GET_SETTINGS':
      chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS)).then(sendResponse);
      return true;
    
    case 'SAVE_SETTINGS':
      chrome.storage.local.set(message.settings).then(() => {
        sendResponse({ success: true });
      });
      return true;
    
    case 'TRIGGER_SYNC':
      triggerSync().then(sendResponse);
      return true;
    
    case 'OPEN_DASHBOARD':
      openDashboard();
      break;
    
    // Debug logging handlers
    case 'LOG_EVENT':
      addDebugLog(message.entry).then(sendResponse);
      return true;
    
    case 'GET_DEBUG_LOGS':
      getDebugLogs().then(sendResponse);
      return true;
    
    case 'CLEAR_DEBUG_LOGS':
      clearDebugLogs().then(sendResponse);
      return true;
  }
});

async function handleSyncComplete(data) {
  const stored = await chrome.storage.local.get(['totalVideosCollected']);
  const total = (stored.totalVideosCollected || 0) + (data.videosCount || 0) + (data.recommendedCount || 0);
  
  await chrome.storage.local.set({
    lastSync: Date.now(),
    totalVideosCollected: total
  });
  
  // Update badge
  chrome.action.setBadgeText({ text: '' });
  chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
  
  setTimeout(() => {
    chrome.action.setBadgeText({ text: '' });
  }, 3000);
}

async function triggerSync() {
  try {
    // Find YouTube tabs
    const tabs = await chrome.tabs.query({ 
      url: ['*://www.youtube.com/*', '*://youtube.com/*'] 
    });
    
    if (tabs.length === 0) {
      return { success: false, error: 'YouTube 탭을 찾을 수 없습니다. YouTube를 열어주세요.' };
    }
    
    // Try to send message to each tab until one succeeds
    let lastError = null;
    for (const tab of tabs) {
      try {
        // First check if content script is injected
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'COLLECT_NOW' });
        if (response && response.success) {
          return { success: true };
        }
      } catch (error) {
        lastError = error;
        console.log(`[EchoBreaker] Tab ${tab.id} not ready:`, error.message);
        
        // Try to inject content script manually
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });
          
          // Wait a bit then try again
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const retryResponse = await chrome.tabs.sendMessage(tab.id, { type: 'COLLECT_NOW' });
          if (retryResponse && retryResponse.success) {
            return { success: true };
          }
        } catch (injectError) {
          console.log(`[EchoBreaker] Failed to inject script:`, injectError.message);
        }
      }
    }
    
    return { 
      success: false, 
      error: 'YouTube 페이지를 새로고침(F5)한 후 다시 시도해주세요.' 
    };
    
  } catch (error) {
    console.error('[EchoBreaker] Sync error:', error);
    return { success: false, error: error.message };
  }
}

async function openDashboard() {
  const stored = await chrome.storage.local.get(['apiUrl']);
  const url = stored.apiUrl || DEFAULT_SETTINGS.apiUrl;
  
  chrome.tabs.create({ url });
}

// Background playback handling
let backgroundTab = null;
let playlistQueue = [];
let isPlaying = false;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_BACKGROUND_PLAY') {
    startBackgroundPlayback(message.playlist);
    sendResponse({ success: true });
  }
  
  if (message.type === 'STOP_BACKGROUND_PLAY') {
    stopBackgroundPlayback();
    sendResponse({ success: true });
  }
  
  if (message.type === 'GET_PLAYBACK_STATUS') {
    sendResponse({ 
      isPlaying, 
      currentVideo: playlistQueue[0] || null,
      queueLength: playlistQueue.length 
    });
  }
});

async function startBackgroundPlayback(playlist) {
  playlistQueue = [...playlist];
  isPlaying = true;
  
  await playNextVideo();
}

async function playNextVideo() {
  if (playlistQueue.length === 0 || !isPlaying) {
    stopBackgroundPlayback();
    return;
  }
  
  const video = playlistQueue.shift();
  const url = `https://www.youtube.com/watch?v=${video.videoId}`;
  
  try {
    if (backgroundTab) {
      await chrome.tabs.update(backgroundTab, { url, muted: true });
    } else {
      const tab = await chrome.tabs.create({ 
        url, 
        active: false,
        muted: true
      });
      backgroundTab = tab.id;
    }
    
    // Auto-advance after video duration or 5 minutes max
    setTimeout(() => {
      if (isPlaying) {
        playNextVideo();
      }
    }, 5 * 60 * 1000); // 5 minutes
    
  } catch (error) {
    console.error('[EchoBreaker] Playback error:', error);
    // Try next video
    setTimeout(() => playNextVideo(), 1000);
  }
}

function stopBackgroundPlayback() {
  isPlaying = false;
  playlistQueue = [];
  
  if (backgroundTab) {
    chrome.tabs.remove(backgroundTab).catch(() => {});
    backgroundTab = null;
  }
}

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === backgroundTab) {
    backgroundTab = null;
    if (isPlaying && playlistQueue.length > 0) {
      setTimeout(() => playNextVideo(), 1000);
    }
  }
});


// Handle messages for getting video stance info and diverse recommendations
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_VIDEO_STANCES') {
    getVideoStances(message.videoIds).then(sendResponse);
    return true;
  }
  if (message.type === 'GET_DIVERSE_RECOMMENDATIONS') {
    getDiverseRecommendations().then(sendResponse);
    return true;
  }
});

async function getVideoStances(videoIds) {
  try {
    const stored = await chrome.storage.local.get(['apiUrl']);
    const apiUrl = stored.apiUrl || DEFAULT_SETTINGS.apiUrl;
    
    const response = await fetch(`${apiUrl}/api/videos/stances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoIds })
    });
    
    if (response.ok) {
      return await response.json();
    }
    return { stances: {} };
  } catch (error) {
    console.log('[EchoBreaker] Failed to get video stances:', error.message);
    return { stances: {} };
  }
}

async function getDiverseRecommendations() {
  try {
    const stored = await chrome.storage.local.get(['apiUrl']);
    const apiUrl = stored.apiUrl || DEFAULT_SETTINGS.apiUrl;
    
    const response = await fetch(`${apiUrl}/api/recommendations/diverse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    
    if (response.ok) {
      return await response.json();
    }
    return { recommendations: [] };
  } catch (error) {
    console.log('[EchoBreaker] Failed to get diverse recommendations:', error.message);
    return { recommendations: [] };
  }
}
