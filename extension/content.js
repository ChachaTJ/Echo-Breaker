// EchoBreaker Content Script - Runs on YouTube pages
// Collects video data, subscriptions, and recommendations

(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    SYNC_INTERVAL: 15 * 60 * 1000, // 15 minutes
    API_BASE_URL: '', // Will be set from storage
    MAX_VIDEOS: 50,
  };

  // State
  let lastSync = 0;
  let isCollecting = false;

  // Initialize
  async function init() {
    console.log('[EchoBreaker] Content script initialized');
    
    // Get API URL from storage
    const stored = await chrome.storage.local.get(['apiUrl', 'autoSync']);
    CONFIG.API_BASE_URL = stored.apiUrl || 'http://localhost:5000';
    
    if (stored.autoSync !== false) {
      // Start periodic collection
      scheduleCollection();
    }

    // Listen for messages from popup/background
    chrome.runtime.onMessage.addListener(handleMessage);

    // Collect initial data
    setTimeout(() => collectData(), 3000);
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
    setInterval(() => {
      const now = Date.now();
      if (now - lastSync >= CONFIG.SYNC_INTERVAL) {
        collectData();
      }
    }, 60000); // Check every minute
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
