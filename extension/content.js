// EchoBreaker Content Script - Runs on YouTube pages
// AI-powered DOM selector discovery + data collection

(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    SYNC_INTERVAL: 15 * 60 * 1000,
    API_BASE_URL: 'https://echo-breaker--chayoonmin.replit.app',
    MAX_VIDEOS: 50,
    SELECTOR_CACHE_KEY: 'echobreaker_selectors',
  };

  // Default selectors (fallback)
  const DEFAULT_SELECTORS = {
    video_title: {
      watch: 'h1.ytd-watch-metadata yt-formatted-string, h1 yt-formatted-string',
      home: '#video-title, a#video-title-link',
      default: '#video-title'
    },
    channel_name: {
      watch: '#owner #channel-name a, ytd-channel-name a',
      home: '#channel-name a, ytd-channel-name a',
      default: '#channel-name a'
    },
    video_link: {
      home: 'a#thumbnail, a.ytd-thumbnail',
      default: 'a#thumbnail'
    },
    video_container: {
      home: 'ytd-rich-item-renderer, ytd-video-renderer',
      subscriptions: 'ytd-grid-video-renderer, ytd-rich-item-renderer',
      history: 'ytd-video-renderer',
      default: 'ytd-video-renderer'
    },
    sidebar_recommendations: {
      watch: 'ytd-compact-video-renderer',
      default: 'ytd-compact-video-renderer'
    },
    subscription_channels: {
      default: 'ytd-guide-entry-renderer'
    }
  };

  // State
  let lastSync = 0;
  let isCollecting = false;
  let syncIntervalId = null;
  let cachedSelectors = {};
  let selectorFailures = {};

  // Initialize
  async function init() {
    console.log('[EchoBreaker] Content script initialized on:', window.location.href);
    
    // Load settings and cached selectors
    const stored = await chrome.storage.local.get(['apiUrl', 'autoSync', CONFIG.SELECTOR_CACHE_KEY]);
    CONFIG.API_BASE_URL = stored.apiUrl || CONFIG.API_BASE_URL;
    cachedSelectors = stored[CONFIG.SELECTOR_CACHE_KEY] || {};
    
    console.log('[EchoBreaker] Using API URL:', CONFIG.API_BASE_URL);
    console.log('[EchoBreaker] Cached selectors:', Object.keys(cachedSelectors).length);
    
    if (stored.autoSync !== false) {
      scheduleCollection();
    }

    chrome.runtime.onMessage.addListener(handleMessage);
    
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local') {
        if (changes.apiUrl) {
          CONFIG.API_BASE_URL = changes.apiUrl.newValue || CONFIG.API_BASE_URL;
        }
        if (changes.autoSync) {
          if (changes.autoSync.newValue === false) {
            if (syncIntervalId) {
              clearInterval(syncIntervalId);
              syncIntervalId = null;
            }
          } else if (!syncIntervalId) {
            scheduleCollection();
          }
        }
      }
    });

    // Initial data collection
    console.log('[EchoBreaker] Starting initial data collection in 5s...');
    setTimeout(() => collectData(), 5000);
    setTimeout(() => flushPendingData(), 7000);
    
    observePageChanges();
  }
  
  function observePageChanges() {
    let lastUrl = window.location.href;
    
    const observer = new MutationObserver(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        console.log('[EchoBreaker] Page changed, collecting data...');
        setTimeout(() => collectData(), 3000);
      }
    });
    
    // Wait for document.body to be available
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    } else {
      // If body not ready, wait for it
      const bodyWaiter = setInterval(() => {
        if (document.body) {
          clearInterval(bodyWaiter);
          observer.observe(document.body, { childList: true, subtree: true });
          console.log('[EchoBreaker] Body available, observer attached');
        }
      }, 100);
    }
  }

  function handleMessage(message, sender, sendResponse) {
    console.log('[EchoBreaker] Received message:', message.type);
    if (message.type === 'COLLECT_NOW') {
      collectData().then(() => sendResponse({ success: true }));
      return true;
    }
    if (message.type === 'GET_STATUS') {
      sendResponse({ 
        lastSync,
        isCollecting,
        pageType: detectPageType(),
        cachedSelectors: Object.keys(cachedSelectors).length
      });
    }
  }

  function scheduleCollection() {
    if (syncIntervalId) clearInterval(syncIntervalId);
    syncIntervalId = setInterval(async () => {
      const stored = await chrome.storage.local.get(['autoSync']);
      if (stored.autoSync === false) return;
      if (Date.now() - lastSync >= CONFIG.SYNC_INTERVAL) {
        collectData();
      }
    }, 60000);
  }
  
  async function flushPendingData() {
    try {
      const stored = await chrome.storage.local.get(['pendingData']);
      const pending = stored.pendingData || [];
      if (pending.length === 0) return;
      
      console.log(`[EchoBreaker] Flushing ${pending.length} pending uploads`);
      const successfulIndices = [];
      
      for (let i = 0; i < pending.length; i++) {
        try {
          const response = await fetch(`${CONFIG.API_BASE_URL}/api/crawl`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pending[i])
          });
          if (response.ok) successfulIndices.push(i);
        } catch (e) {
          break;
        }
      }
      
      if (successfulIndices.length > 0) {
        const remaining = pending.filter((_, i) => !successfulIndices.includes(i));
        await chrome.storage.local.set({ pendingData: remaining });
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

  // =============================================
  // AI-Powered Selector Discovery System
  // =============================================

  async function getSelector(target, pageType) {
    const cacheKey = `${pageType}_${target}`;
    
    // 1. Try cached selector first
    if (cachedSelectors[cacheKey]) {
      const selector = cachedSelectors[cacheKey];
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        // Reset failure count on success
        selectorFailures[cacheKey] = 0;
        return selector;
      }
      // Cached selector failed
      console.log(`[EchoBreaker] Cached selector failed for ${cacheKey}`);
      selectorFailures[cacheKey] = (selectorFailures[cacheKey] || 0) + 1;
    }
    
    // 2. Try default selector
    const defaultSelector = DEFAULT_SELECTORS[target]?.[pageType] || DEFAULT_SELECTORS[target]?.default;
    if (defaultSelector) {
      const elements = document.querySelectorAll(defaultSelector);
      if (elements.length > 0) {
        // Reset failure count on success
        selectorFailures[cacheKey] = 0;
        return defaultSelector;
      }
      // Default selector also failed - increment failure count
      console.log(`[EchoBreaker] Default selector failed for ${cacheKey}: ${defaultSelector}`);
      selectorFailures[cacheKey] = (selectorFailures[cacheKey] || 0) + 1;
    }
    
    // 3. If selectors keep failing (2+ times), ask AI for help
    const failureCount = selectorFailures[cacheKey] || 0;
    if (failureCount >= 2) {
      console.log(`[EchoBreaker] Requesting AI selector discovery for ${target} (failures: ${failureCount})`);
      const aiSelector = await discoverSelectorWithAI(target, pageType);
      if (aiSelector) {
        // Cache the AI-discovered selector
        cachedSelectors[cacheKey] = aiSelector;
        await chrome.storage.local.set({ [CONFIG.SELECTOR_CACHE_KEY]: cachedSelectors });
        selectorFailures[cacheKey] = 0;
        console.log(`[EchoBreaker] AI selector cached: ${cacheKey} -> ${aiSelector}`);
        return aiSelector;
      }
    }
    
    // Return default selector even if it failed (caller will handle empty results)
    // This allows gradual failure accumulation for AI discovery
    return defaultSelector || '';
  }

  async function discoverSelectorWithAI(target, pageType) {
    try {
      // Get relevant DOM section
      let htmlSnippet = '';
      
      if (target === 'video_title' && pageType === 'watch') {
        htmlSnippet = document.querySelector('ytd-watch-metadata')?.outerHTML || 
                      document.querySelector('#above-the-fold')?.outerHTML ||
                      document.body.innerHTML.substring(0, 5000);
      } else if (target === 'video_container') {
        htmlSnippet = document.querySelector('ytd-rich-grid-renderer')?.outerHTML?.substring(0, 5000) ||
                      document.querySelector('#contents')?.innerHTML?.substring(0, 5000) ||
                      document.body.innerHTML.substring(0, 5000);
      } else {
        htmlSnippet = document.body.innerHTML.substring(0, 5000);
      }
      
      const response = await fetch(`${CONFIG.API_BASE_URL}/api/analyze-dom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html: htmlSnippet,
          target,
          pageType
        })
      });
      
      if (!response.ok) {
        console.log('[EchoBreaker] AI selector request failed:', response.status);
        return null;
      }
      
      const result = await response.json();
      console.log('[EchoBreaker] AI selector result:', result);
      
      if (result.selector) {
        // Validate the selector
        const elements = document.querySelectorAll(result.selector);
        if (elements.length > 0) {
          console.log(`[EchoBreaker] AI selector works! Found ${elements.length} elements`);
          return result.selector;
        }
      }
      
      return null;
    } catch (error) {
      console.error('[EchoBreaker] AI selector discovery error:', error);
      return null;
    }
  }

  // Smart element finder with fallback chain
  function findElement(selectors, context = document) {
    for (const selector of selectors.split(',').map(s => s.trim())) {
      try {
        const el = context.querySelector(selector);
        if (el) return el;
      } catch (e) {
        // Invalid selector, skip
      }
    }
    return null;
  }

  function findElements(selectors, context = document) {
    const results = [];
    for (const selector of selectors.split(',').map(s => s.trim())) {
      try {
        const els = context.querySelectorAll(selector);
        els.forEach(el => results.push(el));
      } catch (e) {
        // Invalid selector, skip
      }
    }
    return results;
  }

  // =============================================
  // Data Collection Functions
  // =============================================

  async function collectData() {
    if (isCollecting) {
      console.log('[EchoBreaker] Already collecting, skipping...');
      return;
    }
    isCollecting = true;

    const pageType = detectPageType();
    console.log('[EchoBreaker] Starting data collection on page type:', pageType);

    try {
      const data = {
        videos: [],
        subscriptions: [],
        recommendedVideos: []
      };

      if (pageType === 'home') {
        data.recommendedVideos = await collectHomePageVideos();
      } else if (pageType === 'watch') {
        const currentVideo = await collectCurrentVideo();
        if (currentVideo) data.videos.push(currentVideo);
        data.recommendedVideos = await collectSidebarRecommendations();
      } else if (pageType === 'subscriptions') {
        data.videos = await collectFeedVideos('subscriptions');
      } else if (pageType === 'history') {
        data.videos = await collectFeedVideos('history');
      }

      data.subscriptions = await collectSubscriptionChannels();

      const totalItems = data.videos.length + data.recommendedVideos.length + data.subscriptions.length;
      console.log('[EchoBreaker] Collected:', {
        videos: data.videos.length,
        recommended: data.recommendedVideos.length,
        subscriptions: data.subscriptions.length
      });
      
      if (totalItems > 0) {
        const success = await sendToServer(data);
        if (success) {
          lastSync = Date.now();
          chrome.runtime.sendMessage({ 
            type: 'SYNC_COMPLETE', 
            data: {
              videosCount: data.videos.length,
              recommendedCount: data.recommendedVideos.length,
              subscriptionsCount: data.subscriptions.length
            }
          }).catch(() => {});
        }
      }

    } catch (error) {
      console.error('[EchoBreaker] Collection error:', error);
    } finally {
      isCollecting = false;
    }
  }

  async function collectCurrentVideo() {
    try {
      const pageType = 'watch';
      const titleSelector = await getSelector('video_title', pageType);
      const channelSelector = await getSelector('channel_name', pageType);
      
      const titleEl = findElement(titleSelector);
      const channelEl = findElement(channelSelector);
      const videoId = new URLSearchParams(window.location.search).get('v');

      console.log('[EchoBreaker] Current video - Title:', titleEl?.textContent?.substring(0, 30), 'ID:', videoId);

      if (!videoId) return null;

      return {
        videoId,
        title: titleEl?.textContent?.trim() || document.title.replace(' - YouTube', ''),
        channelName: channelEl?.textContent?.trim() || 'Unknown',
        channelId: channelEl?.href?.split('/').pop() || null,
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        viewCount: null,
        category: null,
        tags: null
      };
    } catch (e) {
      console.error('[EchoBreaker] Error collecting current video:', e);
      return null;
    }
  }

  async function collectHomePageVideos() {
    const videos = [];
    const pageType = 'home';
    
    const containerSelector = await getSelector('video_container', pageType);
    const videoEls = findElements(containerSelector);
    console.log('[EchoBreaker] Found home page video elements:', videoEls.length);

    for (let i = 0; i < Math.min(videoEls.length, CONFIG.MAX_VIDEOS); i++) {
      const el = videoEls[i];
      try {
        const titleEl = findElement('#video-title, a#video-title-link', el);
        const channelEl = findElement('#channel-name a, ytd-channel-name a, #text-container a', el);
        const linkEl = findElement('a#thumbnail, a.ytd-thumbnail', el);
        
        // Extract additional metadata
        const metadataEl = findElement('#metadata-line, ytd-video-meta-block', el);
        const viewCountEl = findElement('#metadata-line span:first-child, .inline-metadata-item:first-child', el);
        const uploadTimeEl = findElement('#metadata-line span:last-child, .inline-metadata-item:last-child', el);
        const durationEl = findElement('ytd-thumbnail-overlay-time-status-renderer span, #overlays span.ytd-thumbnail-overlay-time-status-renderer', el);
        
        // Get channel avatar
        const avatarEl = findElement('#avatar-link img, yt-img-shadow img', el);

        if (!titleEl) continue;

        const href = linkEl?.getAttribute('href') || titleEl?.getAttribute('href') || '';
        const videoId = extractVideoId(href);
        if (!videoId) continue;

        // Parse view count (e.g., "조회수 123만회" or "1.2M views")
        const viewCountText = viewCountEl?.textContent?.trim() || '';
        const viewCount = parseViewCount(viewCountText);

        videos.push({
          videoId,
          title: titleEl.textContent?.trim() || '',
          channelName: channelEl?.textContent?.trim() || 'Unknown',
          channelId: extractChannelId(channelEl?.href),
          channelAvatar: avatarEl?.src || null,
          thumbnailUrl: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
          viewCount: viewCount,
          viewCountText: viewCountText,
          uploadTime: uploadTimeEl?.textContent?.trim() || null,
          duration: durationEl?.textContent?.trim() || null,
          source: 'home_feed',
          collectedAt: new Date().toISOString()
        });
      } catch (e) {
        // Skip this video
      }
    }

    console.log('[EchoBreaker] Collected home page videos:', videos.length);
    return videos;
  }
  
  // Helper to extract channel ID from URL
  function extractChannelId(href) {
    if (!href) return null;
    // Handle /@username format
    const atMatch = href.match(/@([^\/\?]+)/);
    if (atMatch) return '@' + atMatch[1];
    // Handle /channel/ID format  
    const channelMatch = href.match(/channel\/([^\/\?]+)/);
    if (channelMatch) return channelMatch[1];
    return href.split('/').pop() || null;
  }
  
  // Parse view count from text like "조회수 123만회" or "1.2M views"
  function parseViewCount(text) {
    if (!text) return null;
    // Remove non-numeric characters except for multiplier suffixes
    const cleanText = text.replace(/[조회수views\s]/gi, '').trim();
    
    // Korean format: 123만, 45억
    if (cleanText.includes('만')) {
      const num = parseFloat(cleanText.replace('만', '').replace('회', ''));
      return Math.round(num * 10000);
    }
    if (cleanText.includes('억')) {
      const num = parseFloat(cleanText.replace('억', '').replace('회', ''));
      return Math.round(num * 100000000);
    }
    if (cleanText.includes('천')) {
      const num = parseFloat(cleanText.replace('천', '').replace('회', ''));
      return Math.round(num * 1000);
    }
    
    // English format: 1.2M, 500K
    if (cleanText.includes('M')) {
      const num = parseFloat(cleanText.replace('M', ''));
      return Math.round(num * 1000000);
    }
    if (cleanText.includes('K')) {
      const num = parseFloat(cleanText.replace('K', ''));
      return Math.round(num * 1000);
    }
    if (cleanText.includes('B')) {
      const num = parseFloat(cleanText.replace('B', ''));
      return Math.round(num * 1000000000);
    }
    
    // Plain number
    const num = parseInt(cleanText.replace(/[^0-9]/g, ''), 10);
    return isNaN(num) ? null : num;
  }

  async function collectSidebarRecommendations() {
    const videos = [];
    const pageType = 'watch';
    
    const containerSelector = await getSelector('sidebar_recommendations', pageType);
    const videoEls = findElements(containerSelector);
    console.log('[EchoBreaker] Found sidebar recommendations:', videoEls.length);

    for (let i = 0; i < Math.min(videoEls.length, 20); i++) {
      const el = videoEls[i];
      try {
        const titleEl = findElement('#video-title, span#video-title', el);
        const channelEl = findElement('#channel-name, ytd-channel-name', el);
        const linkEl = findElement('a', el);
        const viewCountEl = findElement('.inline-metadata-item, #metadata-line span', el);
        const durationEl = findElement('ytd-thumbnail-overlay-time-status-renderer span', el);

        if (!titleEl || !linkEl) continue;

        const href = linkEl.getAttribute('href') || '';
        const videoId = extractVideoId(href);
        if (!videoId) continue;

        const viewCountText = viewCountEl?.textContent?.trim() || '';

        videos.push({
          videoId,
          title: titleEl.textContent?.trim() || '',
          channelName: channelEl?.textContent?.trim() || 'Unknown',
          channelId: extractChannelId(channelEl?.querySelector('a')?.href),
          thumbnailUrl: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
          viewCount: parseViewCount(viewCountText),
          viewCountText: viewCountText,
          duration: durationEl?.textContent?.trim() || null,
          source: 'sidebar_recommendation',
          collectedAt: new Date().toISOString()
        });
      } catch (e) {
        // Skip
      }
    }

    console.log('[EchoBreaker] Collected sidebar recommendations:', videos.length);
    return videos;
  }

  async function collectFeedVideos(feedType) {
    const videos = [];
    
    const containerSelector = await getSelector('video_container', feedType);
    const videoEls = findElements(containerSelector);
    console.log(`[EchoBreaker] Found ${feedType} feed elements:`, videoEls.length);

    for (let i = 0; i < Math.min(videoEls.length, CONFIG.MAX_VIDEOS); i++) {
      const el = videoEls[i];
      try {
        const titleEl = findElement('#video-title, a#video-title-link', el);
        const channelEl = findElement('#channel-name a, ytd-channel-name a', el);
        const linkEl = findElement('a#thumbnail, a.ytd-thumbnail', el);

        if (!titleEl) continue;

        const href = linkEl?.getAttribute('href') || titleEl?.getAttribute('href') || '';
        const videoId = extractVideoId(href);
        if (!videoId) continue;

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
    }

    return videos;
  }

  async function collectSubscriptionChannels() {
    const subscriptions = [];
    
    const containerSelector = await getSelector('subscription_channels', 'default');
    const channelEls = findElements(containerSelector);
    console.log('[EchoBreaker] Found subscription channel elements:', channelEls.length);
    
    for (const el of channelEls) {
      try {
        const link = findElement('a', el);
        const titleEl = findElement('yt-formatted-string, #endpoint', el);
        const imgEl = findElement('img', el);
        const href = link?.getAttribute('href') || '';

        if (!href.includes('/@') && !href.includes('/channel/')) continue;

        const channelName = titleEl?.textContent?.trim();
        if (!channelName || channelName === 'Subscriptions' || channelName === '구독') continue;

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
    }

    return subscriptions;
  }

  function extractVideoId(href) {
    if (!href) return null;
    if (href.includes('/watch?v=')) {
      return new URLSearchParams(href.split('?')[1]).get('v');
    }
    if (href.includes('/shorts/')) {
      return href.split('/shorts/')[1]?.split('?')[0];
    }
    return null;
  }

  async function sendToServer(data) {
    console.log('[EchoBreaker] Sending data to server:', CONFIG.API_BASE_URL);
    
    // Get extension version
    const manifest = chrome.runtime.getManifest();
    const extensionVersion = manifest.version;
    
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/api/crawl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, extensionVersion })
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      const result = await response.json();
      console.log('[EchoBreaker] Data sent successfully:', result);
      setTimeout(() => flushPendingData(), 1000);
      
      return true;
    } catch (error) {
      console.error('[EchoBreaker] Failed to send data:', error);
      
      const stored = await chrome.storage.local.get(['pendingData']);
      const pending = stored.pendingData || [];
      pending.push({ ...data, timestamp: Date.now() });
      await chrome.storage.local.set({ pendingData: pending.slice(-10) });
      
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
