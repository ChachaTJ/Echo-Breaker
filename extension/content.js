// EchoBreaker Content Script - Runs on YouTube pages
// Collects video data, subscriptions, and recommendations

(function() {
  'use strict';

  // Configuration - Update this URL to your Replit app URL
  const CONFIG = {
    SYNC_INTERVAL: 15 * 60 * 1000, // 15 minutes
    API_BASE_URL: 'https://046806e2-7cc7-45a7-8712-1a53ec91f00f-00-1k55bkxju0p0w.picard.replit.dev',
    MAX_VIDEOS: 50,
  };

  // State
  let lastSync = 0;
  let isCollecting = false;
  let syncIntervalId = null;

  // Initialize
  async function init() {
    console.log('[EchoBreaker] Content script initialized');
    
    // Get API URL from storage
    const stored = await chrome.storage.local.get(['apiUrl', 'autoSync']);
    CONFIG.API_BASE_URL = stored.apiUrl || CONFIG.API_BASE_URL;
    
    if (stored.autoSync !== false) {
      // Start periodic collection
      scheduleCollection();
    }

    // Listen for messages from popup/background
    chrome.runtime.onMessage.addListener(handleMessage);
    
    // Listen for storage changes to handle auto-sync toggle
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local') {
        if (changes.apiUrl) {
          CONFIG.API_BASE_URL = changes.apiUrl.newValue || CONFIG.API_BASE_URL;
        }
        if (changes.autoSync) {
          if (changes.autoSync.newValue === false) {
            // Stop auto-sync
            if (syncIntervalId) {
              clearInterval(syncIntervalId);
              syncIntervalId = null;
              console.log('[EchoBreaker] Auto-sync disabled');
            }
          } else {
            // Start auto-sync
            if (!syncIntervalId) {
              scheduleCollection();
              console.log('[EchoBreaker] Auto-sync enabled');
            }
          }
        }
      }
    });

    // Collect initial data
    setTimeout(() => collectData(), 3000);
    
    // Try to flush any pending data
    setTimeout(() => flushPendingData(), 5000);
  }

  function handleMessage(message, sender, sendResponse) {
    if (message.type === 'COLLECT_NOW') {
      collectData().then(() => sendResponse({ success: true }));
      return true; // Keep channel open for async response
    }
    if (message.type === 'GET_STATUS') {
      sendResponse({ 
        lastSync,
        isCollecting,
        pageType: detectPageType()
      });
    }
  }

  function scheduleCollection() {
    if (syncIntervalId) {
      clearInterval(syncIntervalId);
    }
    syncIntervalId = setInterval(async () => {
      const stored = await chrome.storage.local.get(['autoSync']);
      if (stored.autoSync === false) {
        return; // Skip if auto-sync is disabled
      }
      const now = Date.now();
      if (now - lastSync >= CONFIG.SYNC_INTERVAL) {
        collectData();
      }
    }, 60000); // Check every minute
  }
  
  // Flush pending data from failed uploads
  async function flushPendingData() {
    try {
      const stored = await chrome.storage.local.get(['pendingData']);
      const pending = stored.pendingData || [];
      
      if (pending.length === 0) return;
      
      console.log(`[EchoBreaker] Attempting to flush ${pending.length} pending uploads`);
      
      const successfulIndices = [];
      
      for (let i = 0; i < pending.length; i++) {
        const data = pending[i];
        try {
          const response = await fetch(`${CONFIG.API_BASE_URL}/api/crawl`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
          
          if (response.ok) {
            successfulIndices.push(i);
            console.log(`[EchoBreaker] Successfully flushed pending upload ${i + 1}`);
          }
        } catch (e) {
          console.log(`[EchoBreaker] Failed to flush pending upload ${i + 1}`);
          break; // Stop trying if we're still offline
        }
      }
      
      // Remove successfully uploaded items
      if (successfulIndices.length > 0) {
        const remaining = pending.filter((_, i) => !successfulIndices.includes(i));
        await chrome.storage.local.set({ pendingData: remaining });
        console.log(`[EchoBreaker] Removed ${successfulIndices.length} items from pending queue`);
      }
    } catch (error) {
      console.error('[EchoBreaker] Error flushing pending data:', error);
    }
  }

  function detectPageType() {
    const url = window.location.href;
    if (url.includes('/watch')) return 'watch';
    if (url.includes('/feed/subscriptions')) return 'subscriptions';
    if (url.includes('/feed/history')) return 'history';
    if (url.includes('/@') || url.includes('/channel/')) return 'channel';
    if (url === 'https://www.youtube.com/' || url === 'https://www.youtube.com') return 'home';
    return 'other';
  }

  async function collectData() {
    if (isCollecting) return;
    isCollecting = true;

    console.log('[EchoBreaker] Starting data collection...');

    try {
      const pageType = detectPageType();
      const data = {
        videos: [],
        subscriptions: [],
        recommendedVideos: []
      };

      // Collect videos based on page type
      if (pageType === 'home') {
        data.recommendedVideos = collectHomePageVideos();
      } else if (pageType === 'watch') {
        data.videos = [collectCurrentVideo()].filter(Boolean);
        data.recommendedVideos = collectSidebarRecommendations();
      } else if (pageType === 'subscriptions') {
        data.videos = collectSubscriptionFeedVideos();
      } else if (pageType === 'history') {
        data.videos = collectHistoryVideos();
      }

      // Also try to collect subscription channels if sidebar is visible
      data.subscriptions = collectSubscriptionChannels();

      // Send to server
      if (data.videos.length > 0 || data.recommendedVideos.length > 0 || data.subscriptions.length > 0) {
        await sendToServer(data);
        lastSync = Date.now();
        
        // Notify background script
        chrome.runtime.sendMessage({ 
          type: 'SYNC_COMPLETE', 
          data: {
            videosCount: data.videos.length,
            recommendedCount: data.recommendedVideos.length,
            subscriptionsCount: data.subscriptions.length
          }
        });
      }

    } catch (error) {
      console.error('[EchoBreaker] Collection error:', error);
    } finally {
      isCollecting = false;
    }
  }

  function collectCurrentVideo() {
    try {
      const titleEl = document.querySelector('h1.ytd-watch-metadata yt-formatted-string');
      const channelEl = document.querySelector('#owner #channel-name a') || 
                        document.querySelector('ytd-channel-name a');
      const viewsEl = document.querySelector('#info-strings yt-formatted-string');

      if (!titleEl) return null;

      const videoId = new URLSearchParams(window.location.search).get('v');

      return {
        videoId: videoId || '',
        title: titleEl.textContent?.trim() || '',
        channelName: channelEl?.textContent?.trim() || 'Unknown',
        channelId: channelEl?.href?.split('/').pop() || null,
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        viewCount: viewsEl?.textContent?.trim() || null,
        category: null,
        tags: null
      };
    } catch (e) {
      return null;
    }
  }

  function collectHomePageVideos() {
    const videos = [];
    const videoEls = document.querySelectorAll('ytd-rich-item-renderer');

    videoEls.forEach((el, index) => {
      if (index >= CONFIG.MAX_VIDEOS) return;

      try {
        const titleEl = el.querySelector('#video-title');
        const channelEl = el.querySelector('#channel-name a') || el.querySelector('ytd-channel-name a');
        const linkEl = el.querySelector('a#thumbnail');
        const viewsEl = el.querySelector('#metadata-line span');

        if (!titleEl || !linkEl) return;

        const href = linkEl.getAttribute('href') || '';
        const videoId = new URLSearchParams(href.split('?')[1]).get('v');

        if (!videoId) return;

        videos.push({
          videoId,
          title: titleEl.textContent?.trim() || '',
          channelName: channelEl?.textContent?.trim() || 'Unknown',
          channelId: channelEl?.href?.split('/').pop() || null,
          thumbnailUrl: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
          viewCount: viewsEl?.textContent?.trim() || null,
          category: null,
          tags: null
        });
      } catch (e) {
        // Skip this video
      }
    });

    return videos;
  }

  function collectSidebarRecommendations() {
    const videos = [];
    const videoEls = document.querySelectorAll('ytd-compact-video-renderer');

    videoEls.forEach((el, index) => {
      if (index >= 20) return;

      try {
        const titleEl = el.querySelector('#video-title');
        const channelEl = el.querySelector('#channel-name');
        const linkEl = el.querySelector('a');

        if (!titleEl || !linkEl) return;

        const href = linkEl.getAttribute('href') || '';
        const videoId = new URLSearchParams(href.split('?')[1]).get('v');

        if (!videoId) return;

        videos.push({
          videoId,
          title: titleEl.textContent?.trim() || '',
          channelName: channelEl?.textContent?.trim() || 'Unknown',
          channelId: null,
          thumbnailUrl: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
          viewCount: null,
          category: null,
          tags: null
        });
      } catch (e) {
        // Skip this video
      }
    });

    return videos;
  }

  function collectSubscriptionFeedVideos() {
    const videos = [];
    const videoEls = document.querySelectorAll('ytd-grid-video-renderer, ytd-rich-item-renderer');

    videoEls.forEach((el, index) => {
      if (index >= CONFIG.MAX_VIDEOS) return;

      try {
        const titleEl = el.querySelector('#video-title');
        const channelEl = el.querySelector('#channel-name a');
        const linkEl = el.querySelector('a#thumbnail');

        if (!titleEl || !linkEl) return;

        const href = linkEl.getAttribute('href') || '';
        const videoId = new URLSearchParams(href.split('?')[1]).get('v');

        if (!videoId) return;

        videos.push({
          videoId,
          title: titleEl.textContent?.trim() || '',
          channelName: channelEl?.textContent?.trim() || 'Unknown',
          channelId: channelEl?.href?.split('/').pop() || null,
          thumbnailUrl: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
          viewCount: null,
          category: null,
          tags: null
        });
      } catch (e) {
        // Skip
      }
    });

    return videos;
  }

  function collectHistoryVideos() {
    const videos = [];
    const videoEls = document.querySelectorAll('ytd-video-renderer');

    videoEls.forEach((el, index) => {
      if (index >= CONFIG.MAX_VIDEOS) return;

      try {
        const titleEl = el.querySelector('#video-title');
        const channelEl = el.querySelector('#channel-name a');
        const linkEl = el.querySelector('a#thumbnail');

        if (!titleEl || !linkEl) return;

        const href = linkEl.getAttribute('href') || '';
        const videoId = new URLSearchParams(href.split('?')[1]).get('v');

        if (!videoId) return;

        videos.push({
          videoId,
          title: titleEl.textContent?.trim() || '',
          channelName: channelEl?.textContent?.trim() || 'Unknown',
          channelId: channelEl?.href?.split('/').pop() || null,
          thumbnailUrl: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
          viewCount: null,
          category: null,
          tags: null
        });
      } catch (e) {
        // Skip
      }
    });

    return videos;
  }

  function collectSubscriptionChannels() {
    const subscriptions = [];
    
    // Try to find subscription list in sidebar
    const channelEls = document.querySelectorAll('ytd-guide-entry-renderer');
    
    channelEls.forEach((el, index) => {
      try {
        const titleEl = el.querySelector('#endpoint');
        const imgEl = el.querySelector('img');
        const href = el.querySelector('a')?.getAttribute('href') || '';

        // Only include channel links
        if (!href.includes('/@') && !href.includes('/channel/')) return;

        const channelName = titleEl?.textContent?.trim();
        if (!channelName || channelName === 'Subscriptions') return;

        subscriptions.push({
          channelId: href.split('/').pop() || '',
          channelName,
          thumbnailUrl: imgEl?.src || null,
          subscriberCount: null,
          videoCount: null
        });
      } catch (e) {
        // Skip
      }
    });

    return subscriptions;
  }

  async function sendToServer(data) {
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/api/crawl`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      console.log('[EchoBreaker] Data sent successfully');
      
      // Try to flush any pending data after successful sync
      setTimeout(() => flushPendingData(), 1000);
      
      return true;
    } catch (error) {
      console.error('[EchoBreaker] Failed to send data:', error);
      
      // Store locally for later sync
      const stored = await chrome.storage.local.get(['pendingData']);
      const pending = stored.pendingData || [];
      pending.push({ ...data, timestamp: Date.now() });
      await chrome.storage.local.set({ pendingData: pending.slice(-10) }); // Keep last 10
      
      return false;
    }
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
