// EchoBreaker Background Service Worker
// Handles background tasks and messaging

// Default settings
const DEFAULT_SETTINGS = {
  apiUrl: 'http://localhost:5000',
  autoSync: true,
  syncInterval: 15,
  lastSync: null,
  totalVideosCollected: 0
};

// Initialize on install
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[EchoBreaker] Extension installed');
  
  // Set default settings
  const stored = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  const settings = { ...DEFAULT_SETTINGS, ...stored };
  await chrome.storage.local.set(settings);
});

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
    // Find active YouTube tab and trigger collection
    const tabs = await chrome.tabs.query({ 
      active: true, 
      url: ['*://www.youtube.com/*', '*://youtube.com/*'] 
    });
    
    if (tabs.length === 0) {
      // Try any YouTube tab
      const allTabs = await chrome.tabs.query({ 
        url: ['*://www.youtube.com/*', '*://youtube.com/*'] 
      });
      
      if (allTabs.length > 0) {
        await chrome.tabs.sendMessage(allTabs[0].id, { type: 'COLLECT_NOW' });
        return { success: true };
      }
      
      return { success: false, error: 'No YouTube tab found' };
    }
    
    await chrome.tabs.sendMessage(tabs[0].id, { type: 'COLLECT_NOW' });
    return { success: true };
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
