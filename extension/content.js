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

  // =============================================
  // yt-dlp Inspired Regex Patterns
  // Reference: https://github.com/yt-dlp/yt-dlp
  // =============================================
  const YT_REGEX = {
    // Video ID: 11 characters [a-zA-Z0-9_-]
    VIDEO_ID: /[a-zA-Z0-9_-]{11}/,
    // Extract video ID from various URL patterns
    VIDEO_ID_URL: /(?:v=|\/v\/|\/embed\/|\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    // Channel UCID: UC + 22 characters
    CHANNEL_UCID: /UC[0-9A-Za-z_-]{22}/,
    // Channel Handle: @username
    CHANNEL_HANDLE: /@[0-9A-Za-z_]+/,
    // Playlist ID patterns
    PLAYLIST_ID: /(?:PL|LL|EC|UU|FL|RD|UL|TL|PU|OLAK5uy_)[0-9A-Za-z_-]{10,}|RDMM|WL|LL|LM/,
    // View count patterns (1.2M, 123K, 1,234 views)
    VIEW_COUNT: /([0-9][0-9.,]*[KMB]?)\s*(?:views?|조회|회|視聴)/i,
    // Upload date patterns (2 days ago, 3주 전, etc.)
    UPLOAD_DATE: /(\d+)\s*(?:second|minute|hour|day|week|month|year|초|분|시간|일|주|개월|년)s?\s*(?:ago|전)?/i,
    // Duration patterns (1:23:45, 12:34)
    DURATION: /(?:(\d+):)?(\d{1,2}):(\d{2})/,
    // content-id class pattern (YouTube Dec 2024 DOM)
    CONTENT_ID_CLASS: /content-id-([a-zA-Z0-9_-]{11})/,
    // Shorts detection patterns
    SHORTS_URL: /\/shorts\/[a-zA-Z0-9_-]{11}/,
    SHORTS_CLASS: /shorts|reel|vertical/i,
  };

  // Default selectors (fallback) - yt-dlp inspired multi-tier approach
  const DEFAULT_SELECTORS = {
    video_title: {
      watch: 'h1.ytd-watch-metadata yt-formatted-string, h1 yt-formatted-string, #title h1',
      home: '#video-title, a#video-title-link, h3[title], .yt-core-attributed-string, #video-title-link yt-formatted-string',
      search: '#video-title, h3.title-and-badge, ytd-video-renderer #video-title',
      default: '#video-title, h3[title], .yt-core-attributed-string'
    },
    channel_name: {
      watch: '#owner #channel-name a, ytd-channel-name a, #upload-info #channel-name a',
      home: '#channel-name a, ytd-channel-name a, .yt-lockup-metadata-view-model__subtitle a, #text-container yt-formatted-string a',
      search: '#channel-name a, ytd-channel-name a, .ytd-channel-name a',
      default: '#channel-name a, .yt-lockup-metadata-view-model__subtitle a'
    },
    video_link: {
      home: 'a#thumbnail, a.ytd-thumbnail, ytd-thumbnail a, a[href*="/watch?v="], a[href*="/shorts/"]',
      search: 'a#thumbnail, a.ytd-thumbnail',
      default: 'a#thumbnail, a[href*="/watch?v="]'
    },
    video_container: {
      home: 'ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer',
      subscriptions: 'ytd-grid-video-renderer, ytd-rich-item-renderer, ytd-video-renderer',
      history: 'ytd-video-renderer',
      search: 'ytd-video-renderer',
      default: 'ytd-rich-item-renderer, ytd-video-renderer'
    },
    shorts_container: {
      home: 'ytd-reel-item-renderer, ytd-rich-item-renderer:has([is-shorts])',
      shorts: 'ytd-reel-video-renderer',
      default: 'ytd-reel-item-renderer'
    },
    sidebar_recommendations: {
      watch: 'ytd-compact-video-renderer',
      default: 'ytd-compact-video-renderer'
    },
    subscription_channels: {
      default: 'ytd-guide-entry-renderer'
    },
    // Metadata selectors (yt-dlp style)
    metadata: {
      watch: '#info-container, #info, ytd-video-primary-info-renderer',
      home: '#metadata, #metadata-line, .yt-lockup-metadata-view-model',
      default: '#metadata, #metadata-line'
    }
  };

  // State
  let lastSync = 0;
  let isCollecting = false;
  let syncIntervalId = null;
  let cachedSelectors = {};
  let selectorFailures = {};
  
  // =============================================
  // Debug Logging Helper (sends to background)
  // =============================================
  
  async function log(level, message, details = null) {
    // Console log for DevTools debugging
    const prefix = `[EchoBreaker]`;
    if (level === 'error') {
      console.error(prefix, message, details || '');
    } else if (level === 'warning') {
      console.warn(prefix, message, details || '');
    } else {
      console.log(prefix, message, details || '');
    }
    
    // Send to background for popup display
    try {
      await chrome.runtime.sendMessage({
        type: 'LOG_EVENT',
        entry: {
          level,
          message,
          details: details || {},
          source: 'content',
          url: window.location.href
        }
      });
    } catch (e) {
      // Background might not be ready
    }
  }

  // =============================================
  // SELF-HEALING SCRAPER SYSTEM
  // =============================================
  
  // HTML Diet Function - reduces tokens before sending to AI
  function cleanHTML(htmlString) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlString, 'text/html');
      
      // Remove scripts, styles, SVG, images, paths, icons
      const toRemove = doc.querySelectorAll('script, style, svg, img, path, yt-icon, iron-iconset-svg, noscript, link');
      toRemove.forEach(el => el.remove());
      
      // Keep only essential attributes
      const keepAttrs = ['id', 'class', 'href', 'title', 'aria-label', 'data-lockup-view-model-type'];
      const allElements = doc.body.getElementsByTagName("*");
      for (let el of allElements) {
        const attrs = Array.from(el.attributes);
        attrs.forEach(attr => {
          if (!keepAttrs.includes(attr.name)) {
            el.removeAttribute(attr.name);
          }
        });
      }
      
      // Clean up whitespace and limit length
      return doc.body.innerHTML.replace(/\s+/g, ' ').trim().slice(0, 4000);
    } catch (e) {
      return htmlString.slice(0, 4000);
    }
  }

  // Get cached selectors from chrome.storage
  async function getCachedSelectors(pageType) {
    try {
      const key = `selectors_${pageType}`;
      const stored = await chrome.storage.local.get([key]);
      if (stored[key] && stored[key].timestamp) {
        // Cache valid for 24 hours
        const age = Date.now() - stored[key].timestamp;
        if (age < 24 * 60 * 60 * 1000) {
          await log('info', `캐싱된 셀렉터 로드`, { pageType, age: Math.round(age / 60000) + '분' });
          return stored[key].selectors;
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  // Save selectors to cache
  async function cacheSelectors(pageType, selectors) {
    try {
      const key = `selectors_${pageType}`;
      await chrome.storage.local.set({
        [key]: {
          selectors,
          timestamp: Date.now()
        }
      });
      await log('success', `셀렉터 캐싱 완료`, { pageType });
    } catch (e) {
      console.error('[EchoBreaker] Failed to cache selectors:', e);
    }
  }

  // Request AI to analyze HTML and return selectors
  async function requestAISelectors(htmlSnippet, pageType) {
    try {
      await log('info', `AI 셀렉터 분석 요청`, { pageType, htmlLen: htmlSnippet.length });
      
      const response = await fetch(`${CONFIG.API_BASE_URL}/api/analyze-selectors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ htmlSnippet, pageType })
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.selectors) {
        await log('success', `AI 셀렉터 분석 성공`, data.selectors);
        return data.selectors;
      }
      return null;
    } catch (e) {
      await log('error', `AI 셀렉터 분석 실패`, { error: e.message });
      return null;
    }
  }

  // Extract data from a card using selectors (yt-dlp inspired approach)
  function extractWithSelectors(card, selectors) {
    try {
      let videoId = null;
      let title = '';
      let channelName = 'Unknown';
      let channelId = null;
      let isShort = false;
      let metadata = { viewCount: null, uploadDate: null, duration: null };
      
      const lockupModel = card.querySelector('.yt-lockup-view-model') || card;
      const lockupClasses = lockupModel.className || '';
      const cardHtml = card.outerHTML || '';
      
      // === VIDEO ID EXTRACTION (yt-dlp multi-tier approach) ===
      
      // Tier 1: Try provided videoIdSelector
      if (selectors.videoIdSelector && !videoId) {
        const linkEl = card.querySelector(selectors.videoIdSelector);
        if (linkEl) {
          const href = linkEl.getAttribute('href') || '';
          const urlMatch = href.match(YT_REGEX.VIDEO_ID_URL);
          if (urlMatch) {
            videoId = urlMatch[1];
            if (href.includes('/shorts/')) isShort = true;
          }
          // Try data attributes
          if (!videoId) {
            const dataId = linkEl.getAttribute('data-id') || linkEl.getAttribute('data-video-id');
            if (dataId && YT_REGEX.VIDEO_ID.test(dataId)) videoId = dataId;
          }
        }
      }
      
      // Tier 2: content-id class (YouTube Dec 2024 DOM)
      if (!videoId) {
        const contentIdMatch = lockupClasses.match(YT_REGEX.CONTENT_ID_CLASS);
        if (contentIdMatch) videoId = contentIdMatch[1];
      }
      
      // Tier 3: data attributes on card/lockup
      if (!videoId) {
        const attrs = ['data-id', 'data-video-id', 'data-context-item-id'];
        for (const attr of attrs) {
          const val = card.getAttribute(attr) || lockupModel.getAttribute(attr);
          if (val && YT_REGEX.VIDEO_ID.test(val)) {
            videoId = val.match(YT_REGEX.VIDEO_ID)[0];
            break;
          }
        }
      }
      
      // Tier 4: href links with yt-dlp regex
      if (!videoId) {
        const links = card.querySelectorAll('a[href]');
        for (const link of links) {
          const href = link.getAttribute('href') || '';
          const urlMatch = href.match(YT_REGEX.VIDEO_ID_URL);
          if (urlMatch) {
            videoId = urlMatch[1];
            if (YT_REGEX.SHORTS_URL.test(href)) isShort = true;
            break;
          }
        }
      }
      
      // Tier 5: Scan HTML for any valid video ID pattern (last resort)
      if (!videoId) {
        const htmlMatch = cardHtml.match(/(?:v=|\/v\/|\/embed\/|\/shorts\/|content-id-)([a-zA-Z0-9_-]{11})/);
        if (htmlMatch) videoId = htmlMatch[1];
      }
      
      // === SHORTS DETECTION (yt-dlp style) ===
      if (!isShort) {
        isShort = YT_REGEX.SHORTS_CLASS.test(lockupClasses) ||
                  !!card.querySelector('a[href*="/shorts/"]') ||
                  !!card.querySelector('[is-shorts]') ||
                  lockupClasses.includes('shorts') ||
                  lockupClasses.includes('reel');
      }
      
      // === TITLE EXTRACTION ===
      const titleSelectors = selectors.titleSelector ? 
        selectors.titleSelector.split(',').map(s => s.trim()) : [];
      titleSelectors.push('#video-title', 'h3[title]', '.yt-core-attributed-string', 'a[title]');
      
      for (const sel of titleSelectors) {
        if (title) break;
        try {
          const el = card.querySelector(sel);
          if (el) {
            title = el.getAttribute('title') || el.textContent?.trim() || '';
          }
        } catch (e) { /* invalid selector */ }
      }
      
      // === CHANNEL EXTRACTION (with yt-dlp UCID/Handle patterns) ===
      const channelSelectors = selectors.channelSelector ?
        selectors.channelSelector.split(',').map(s => s.trim()) : [];
      channelSelectors.push('#channel-name a', '.yt-lockup-metadata-view-model__subtitle a', 'ytd-channel-name a');
      
      for (const sel of channelSelectors) {
        if (channelName !== 'Unknown') break;
        try {
          const el = card.querySelector(sel);
          if (el) {
            channelName = el.textContent?.trim() || 'Unknown';
            // Extract channel ID if available
            const href = el.getAttribute('href') || '';
            const ucidMatch = href.match(YT_REGEX.CHANNEL_UCID);
            const handleMatch = href.match(YT_REGEX.CHANNEL_HANDLE);
            if (ucidMatch) channelId = ucidMatch[0];
            else if (handleMatch) channelId = handleMatch[0];
          }
        } catch (e) { /* invalid selector */ }
      }
      
      // === METADATA EXTRACTION (yt-dlp regex patterns) ===
      const metaSelectors = selectors.metaSelector ?
        [selectors.metaSelector] : [];
      metaSelectors.push('#metadata-line', '#metadata', '.yt-lockup-metadata-view-model', '.inline-metadata-item');
      
      for (const sel of metaSelectors) {
        try {
          const metaEls = card.querySelectorAll(sel);
          for (const metaEl of metaEls) {
            const text = metaEl.textContent?.trim() || '';
            // View count (multi-language support)
            if (!metadata.viewCount) {
              const viewMatch = text.match(YT_REGEX.VIEW_COUNT);
              if (viewMatch) metadata.viewCount = viewMatch[1];
            }
            // Upload date (multi-language support)
            if (!metadata.uploadDate) {
              const dateMatch = text.match(YT_REGEX.UPLOAD_DATE);
              if (dateMatch) metadata.uploadDate = text;
            }
          }
        } catch (e) { /* invalid selector */ }
      }
      
      // Duration from overlay
      const durationEl = card.querySelector('#time-status, .ytd-thumbnail-overlay-time-status-renderer, [overlay-style="DEFAULT"]');
      if (durationEl) {
        const durationMatch = durationEl.textContent?.match(YT_REGEX.DURATION);
        if (durationMatch) {
          metadata.duration = durationEl.textContent.trim();
        }
      }
      
      // Validate video ID format (must be exactly 11 chars)
      if (videoId && !YT_REGEX.VIDEO_ID.test(videoId)) {
        videoId = null;
      }
      
      if (!videoId) return null;
      if (!title) title = 'Untitled';
      
      return { videoId, title, channelName, channelId, isShort, metadata };
    } catch (e) {
      return null;
    }
  }

  // Extract all cards using selectors
  function extractAllWithSelectors(cards, selectors) {
    const videos = [];
    const shorts = [];
    
    for (const card of cards) {
      const result = extractWithSelectors(card, selectors);
      if (result) {
        const videoData = {
          videoId: result.videoId,
          title: result.title,
          channelName: result.channelName,
          channelId: result.channelId,
          thumbnailUrl: `https://img.youtube.com/vi/${result.videoId}/mqdefault.jpg`,
          source: result.isShort ? 'shorts' : 'home_feed',
          sourcePhase: result.isShort ? 'shorts' : 'home_feed',
          viewCount: result.metadata?.viewCount,
          uploadDate: result.metadata?.uploadDate,
          duration: result.metadata?.duration,
          collectedAt: new Date().toISOString()
        };
        
        if (result.isShort) {
          shorts.push(videoData);
        } else {
          videos.push(videoData);
        }
      }
    }
    
    return { videos, shorts };
  }

  // Main Self-Healing Crawl Function
  async function selfHealingCrawl(pageType = 'home') {
    await log('info', `Self-Healing 크롤링 시작`, { pageType });
    
    // Determine card selector based on page type
    let cardSelector = 'ytd-rich-item-renderer';
    if (pageType === 'watch') {
      cardSelector = 'ytd-compact-video-renderer';
    } else if (pageType === 'search') {
      cardSelector = 'ytd-video-renderer';
    }
    
    const cards = document.querySelectorAll(cardSelector);
    if (cards.length === 0) {
      await log('warning', `영상 카드를 찾을 수 없음`, { cardSelector });
      return { videos: [], shorts: [] };
    }
    
    await log('info', `카드 ${cards.length}개 발견`);
    
    // Step 1: Try cached selectors
    let selectors = await getCachedSelectors(pageType);
    let videos = [];
    let shorts = [];
    
    if (selectors) {
      await log('info', `캐싱된 셀렉터로 추출 시도`);
      const result = extractAllWithSelectors(cards, selectors);
      videos = result.videos;
      shorts = result.shorts;
    }
    
    // Step 2: Try default selectors
    if (videos.length === 0 && shorts.length === 0) {
      await log('info', `기본 셀렉터로 추출 시도`);
      
      // Build default selectors object from DEFAULT_SELECTORS
      const defaultSels = {
        titleSelector: DEFAULT_SELECTORS.video_title[pageType] || DEFAULT_SELECTORS.video_title.default,
        channelSelector: DEFAULT_SELECTORS.channel_name[pageType] || DEFAULT_SELECTORS.channel_name.default,
        videoIdSelector: DEFAULT_SELECTORS.video_link[pageType] || DEFAULT_SELECTORS.video_link.default,
        metaSelector: null
      };
      
      const result = extractAllWithSelectors(cards, defaultSels);
      videos = result.videos;
      shorts = result.shorts;
      
      if (videos.length > 0 || shorts.length > 0) {
        await log('success', `기본 셀렉터 성공`, { videos: videos.length, shorts: shorts.length });
        // Cache successful default selectors
        await cacheSelectors(pageType, defaultSels);
      }
    }
    
    // Step 3: If failed, request AI analysis
    if (videos.length === 0 && shorts.length === 0) {
      await log('warning', `기본 셀렉터 실패 - AI 분석 요청`);
      
      // Get sample HTML
      const sampleCard = cards[0];
      const rawHtml = sampleCard.outerHTML;
      const cleanedHtml = cleanHTML(rawHtml);
      
      await log('info', `HTML 다이어트`, { 
        before: rawHtml.length, 
        after: cleanedHtml.length,
        reduction: Math.round((1 - cleanedHtml.length / rawHtml.length) * 100) + '%'
      });
      
      // Request AI selectors
      selectors = await requestAISelectors(cleanedHtml, pageType);
      
      if (selectors) {
        await cacheSelectors(pageType, selectors);
        const result = extractAllWithSelectors(cards, selectors);
        videos = result.videos;
        shorts = result.shorts;
      }
    }
    
    // Step 4: Final fallback - hardcoded extraction for YouTube's December 2024 DOM
    if (videos.length === 0 && shorts.length === 0) {
      await log('warning', `AI도 실패 - 폴백 추출 사용`);
      
      for (const card of cards) {
        try {
          const lockupModel = card.querySelector('.yt-lockup-view-model') || card;
          const lockupClasses = lockupModel.className || '';
          
          // Check for shorts
          let isShort = lockupClasses.includes('yt-lockup-view-model--shorts') ||
                        !!card.querySelector('a[href*="/shorts/"]');
          
          // Get video ID
          let videoId = null;
          const contentIdMatch = lockupClasses.match(/content-id-([a-zA-Z0-9_-]+)/);
          if (contentIdMatch) videoId = contentIdMatch[1];
          
          if (!videoId) {
            const link = card.querySelector('a[href*="/watch?v="], a[href*="/shorts/"]');
            if (link) {
              const href = link.getAttribute('href');
              const watchMatch = href.match(/[?&]v=([a-zA-Z0-9_-]+)/);
              const shortsMatch = href.match(/\/shorts\/([a-zA-Z0-9_-]+)/);
              videoId = watchMatch?.[1] || shortsMatch?.[1];
              if (shortsMatch) isShort = true;
            }
          }
          
          if (!videoId) continue;
          
          // Get title
          let title = '';
          const h3 = card.querySelector('h3[title]');
          if (h3) title = h3.getAttribute('title');
          if (!title) {
            const span = card.querySelector('.yt-core-attributed-string');
            if (span) title = span.textContent?.trim();
          }
          if (!title) title = 'Untitled';
          
          // Get channel
          let channelName = 'Unknown';
          const subtitleEl = card.querySelector('.yt-lockup-metadata-view-model__subtitle a');
          if (subtitleEl) channelName = subtitleEl.textContent?.trim();
          
          const videoData = {
            videoId,
            title,
            channelName,
            thumbnailUrl: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
            source: isShort ? 'shorts' : 'home_feed',
            sourcePhase: isShort ? 'shorts' : 'home_feed',
            collectedAt: new Date().toISOString()
          };
          
          if (isShort) shorts.push(videoData);
          else videos.push(videoData);
        } catch (e) {
          continue;
        }
      }
    }
    
    await log('success', `Self-Healing 완료`, { videos: videos.length, shorts: shorts.length });
    return { videos, shorts };
  }
  
  // =============================================
  // Visual Feedback System
  // =============================================
  
  function createCrawlIndicator() {
    // Remove existing indicator if any
    const existing = document.getElementById('echobreaker-crawl-indicator');
    if (existing) existing.remove();
    
    const indicator = document.createElement('div');
    indicator.id = 'echobreaker-crawl-indicator';
    indicator.innerHTML = `
      <style>
        #echobreaker-crawl-indicator {
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 12px 20px;
          border-radius: 12px;
          font-family: 'YouTube Sans', 'Roboto', sans-serif;
          font-size: 13px;
          font-weight: 500;
          z-index: 9999999;
          display: flex;
          align-items: center;
          gap: 10px;
          box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
          animation: echobreaker-slide-in 0.3s ease-out;
          opacity: 0.95;
        }
        @keyframes echobreaker-slide-in {
          from { transform: translateX(100px); opacity: 0; }
          to { transform: translateX(0); opacity: 0.95; }
        }
        @keyframes echobreaker-slide-out {
          from { transform: translateX(0); opacity: 0.95; }
          to { transform: translateX(100px); opacity: 0; }
        }
        @keyframes echobreaker-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.7; }
        }
        #echobreaker-crawl-indicator .eb-icon {
          width: 20px;
          height: 20px;
          animation: echobreaker-pulse 1.5s infinite;
        }
        #echobreaker-crawl-indicator .eb-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        #echobreaker-crawl-indicator .eb-title {
          font-weight: 600;
        }
        #echobreaker-crawl-indicator .eb-count {
          font-size: 11px;
          opacity: 0.9;
        }
        #echobreaker-crawl-indicator.success {
          background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
        }
        #echobreaker-crawl-indicator.error {
          background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%);
        }
      </style>
      <svg class="eb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 6v6l4 2"/>
      </svg>
      <div class="eb-text">
        <span class="eb-title">EchoBreaker 수집 중...</span>
        <span class="eb-count" id="eb-count-text">데이터 분석 중</span>
      </div>
    `;
    document.body.appendChild(indicator);
    return indicator;
  }
  
  function updateCrawlIndicator(status, data = {}) {
    const indicator = document.getElementById('echobreaker-crawl-indicator');
    if (!indicator) return;
    
    const countText = indicator.querySelector('#eb-count-text');
    const titleText = indicator.querySelector('.eb-title');
    
    if (status === 'collecting') {
      titleText.textContent = 'EchoBreaker 수집 중...';
      countText.textContent = '페이지 분석 중';
    } else if (status === 'success') {
      indicator.classList.add('success');
      titleText.textContent = 'EchoBreaker 수집 완료!';
      const total = (data.videos || 0) + (data.shorts || 0) + (data.recommended || 0);
      countText.textContent = `동영상 ${data.videos || 0}개, 추천 ${data.recommended || 0}개 수집`;
      
      // Remove after 3 seconds with animation
      setTimeout(() => {
        indicator.style.animation = 'echobreaker-slide-out 0.3s ease-in forwards';
        setTimeout(() => indicator.remove(), 300);
      }, 3000);
    } else if (status === 'error') {
      indicator.classList.add('error');
      titleText.textContent = 'EchoBreaker 수집 실패';
      countText.textContent = data.message || '서버 연결 오류';
      
      setTimeout(() => {
        indicator.style.animation = 'echobreaker-slide-out 0.3s ease-in forwards';
        setTimeout(() => indicator.remove(), 300);
      }, 4000);
    } else if (status === 'nodata') {
      indicator.classList.add('error');
      titleText.textContent = 'EchoBreaker';
      countText.textContent = '수집할 데이터 없음';
      
      setTimeout(() => {
        indicator.style.animation = 'echobreaker-slide-out 0.3s ease-in forwards';
        setTimeout(() => indicator.remove(), 300);
      }, 2000);
    }
  }
  
  function removeCrawlIndicator() {
    const indicator = document.getElementById('echobreaker-crawl-indicator');
    if (indicator) {
      indicator.style.animation = 'echobreaker-slide-out 0.3s ease-in forwards';
      setTimeout(() => indicator.remove(), 300);
    }
  }

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

    // Initial data collection - wait for page to be ready
    console.log('[EchoBreaker] Waiting for page content to load...');
    waitForContent().then(() => {
      console.log('[EchoBreaker] Content detected, starting collection...');
      collectData();
      setTimeout(() => flushPendingData(), 2000);
    });
    
    observePageChanges();
  }
  
  // Wait for YouTube content to load before collecting
  function waitForContent(maxWait = 15000) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      function check() {
        // Check for various content indicators
        const hasVideoRenderers = document.querySelectorAll('ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer').length > 0;
        const hasVideoTitles = document.querySelectorAll('#video-title').length > 0;
        const hasThumbnails = document.querySelectorAll('a#thumbnail, ytd-thumbnail').length > 0;
        const isWatchPage = window.location.href.includes('/watch');
        const hasWatchContent = isWatchPage && document.querySelector('ytd-watch-metadata, h1.ytd-watch-metadata');
        
        console.log('[EchoBreaker] Content check:', {
          hasVideoRenderers,
          hasVideoTitles,
          hasThumbnails,
          isWatchPage,
          hasWatchContent,
          elapsed: Date.now() - startTime
        });
        
        if (hasVideoRenderers || hasVideoTitles || hasThumbnails || hasWatchContent) {
          console.log('[EchoBreaker] Content found after', Date.now() - startTime, 'ms');
          resolve(true);
          return;
        }
        
        if (Date.now() - startTime >= maxWait) {
          console.log('[EchoBreaker] Max wait reached, proceeding anyway');
          resolve(false);
          return;
        }
        
        // Check again after 500ms
        setTimeout(check, 500);
      }
      
      // Start checking after a short initial delay
      setTimeout(check, 1000);
    });
  }
  
  function observePageChanges() {
    let lastUrl = window.location.href;
    
    const observer = new MutationObserver(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        console.log('[EchoBreaker] Page changed, waiting for content...');
        waitForContent().then(() => collectData());
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
    if (url.includes('/shorts/')) return 'shorts';
    if (url.includes('/watch')) {
      // Check if watching from a playlist
      if (url.includes('list=')) return 'playlist';
      return 'watch';
    }
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
      await log('warning', '수집 중 - 건너뜀');
      return;
    }
    isCollecting = true;

    const pageType = detectPageType();
    await log('info', `데이터 수집 시작`, { 
      pageType, 
      url: window.location.href.substring(0, 50) 
    });
    
    // Reset debug counter
    window._ebDebugCount = 0;
    
    // Show visual indicator
    createCrawlIndicator();
    updateCrawlIndicator('collecting');

    try {
      const data = {
        videos: [],
        shorts: [],
        subscriptions: [],
        recommendedVideos: []
      };

      if (pageType === 'home') {
        // Collect both regular videos and shorts from home page
        const homeContent = await collectHomePageContent();
        data.recommendedVideos = homeContent.videos;
        data.shorts = homeContent.shorts;
      } else if (pageType === 'shorts') {
        // Currently watching a short
        const currentShort = await collectCurrentShort();
        if (currentShort) data.shorts.push(currentShort);
      } else if (pageType === 'playlist') {
        // Watching from a playlist
        const currentVideo = await collectCurrentVideo('playlist');
        if (currentVideo) data.videos.push(currentVideo);
        data.recommendedVideos = await collectSidebarRecommendations();
      } else if (pageType === 'watch') {
        // Regular video watch
        const currentVideo = await collectCurrentVideo('video');
        if (currentVideo) data.videos.push(currentVideo);
        data.recommendedVideos = await collectSidebarRecommendations();
      } else if (pageType === 'subscriptions') {
        data.videos = await collectFeedVideos('subscriptions');
      } else if (pageType === 'history') {
        data.videos = await collectFeedVideos('history');
      }

      data.subscriptions = await collectSubscriptionChannels();

      const totalItems = data.videos.length + data.shorts.length + data.recommendedVideos.length + data.subscriptions.length;
      
      await log('info', `DOM 수집 완료`, {
        videos: data.videos.length,
        shorts: data.shorts.length,
        recommended: data.recommendedVideos.length,
        subscriptions: data.subscriptions.length,
        total: totalItems
      });
      
      if (totalItems > 0) {
        const success = await sendToServer(data);
        if (success) {
          lastSync = Date.now();
          // Update visual indicator with success
          updateCrawlIndicator('success', {
            videos: data.videos.length,
            shorts: data.shorts.length,
            recommended: data.recommendedVideos.length
          });
          
          await log('success', `서버 전송 성공`, {
            videos: data.videos.length,
            shorts: data.shorts.length,
            recommended: data.recommendedVideos.length
          });
          
          chrome.runtime.sendMessage({ 
            type: 'SYNC_COMPLETE', 
            data: {
              videosCount: data.videos.length,
              shortsCount: data.shorts.length,
              recommendedCount: data.recommendedVideos.length,
              subscriptionsCount: data.subscriptions.length
            }
          }).catch(() => {});
        } else {
          updateCrawlIndicator('error', { message: '서버 전송 실패' });
        }
      } else {
        await log('warning', '수집할 데이터 없음', { pageType });
        updateCrawlIndicator('nodata');
      }

    } catch (error) {
      await log('error', `수집 오류: ${error.message}`);
      updateCrawlIndicator('error', { message: error.message });
    } finally {
      isCollecting = false;
    }
  }

  // Collect current video being watched (regular video or from playlist)
  async function collectCurrentVideo(sourcePhase = 'video') {
    try {
      const pageType = 'watch';
      const titleSelector = await getSelector('video_title', pageType);
      const channelSelector = await getSelector('channel_name', pageType);
      
      const titleEl = findElement(titleSelector);
      const channelEl = findElement(channelSelector);
      const videoId = new URLSearchParams(window.location.search).get('v');
      const playlistId = new URLSearchParams(window.location.search).get('list');

      console.log('[EchoBreaker] Current video - Title:', titleEl?.textContent?.substring(0, 30), 'ID:', videoId, 'Source:', sourcePhase);

      if (!videoId) return null;

      return {
        videoId,
        title: titleEl?.textContent?.trim() || document.title.replace(' - YouTube', ''),
        channelName: channelEl?.textContent?.trim() || 'Unknown',
        channelId: channelEl?.href?.split('/').pop() || null,
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        viewCount: null,
        category: null,
        tags: null,
        source: sourcePhase, // 'video' or 'playlist'
        playlistId: playlistId || null,
        collectedAt: new Date().toISOString()
      };
    } catch (e) {
      console.error('[EchoBreaker] Error collecting current video:', e);
      return null;
    }
  }

  // =============================================
  // AI-Powered Video Extraction
  // =============================================
  
  async function extractVideosWithAI(pageType) {
    try {
      // Get the main content area HTML
      const contentArea = document.querySelector('ytd-rich-grid-renderer') || 
                          document.querySelector('#contents') ||
                          document.querySelector('ytd-browse') ||
                          document.body;
      
      // Get outer HTML, limit to reasonable size
      const html = contentArea.outerHTML.substring(0, 20000);
      
      await log('info', `AI에 DOM 전송 중...`, { htmlSize: html.length });
      
      const response = await fetch(`${CONFIG.API_BASE_URL}/api/extract-videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html, pageType })
      });
      
      if (!response.ok) {
        await log('error', `AI 추출 API 오류: ${response.status}`);
        return [];
      }
      
      const result = await response.json();
      
      if (result.videos && result.videos.length > 0) {
        await log('success', `AI가 ${result.videos.length}개 비디오 발견`, { 
          source: result.source,
          sample: result.videos[0]?.title?.substring(0, 30)
        });
        return result.videos;
      } else {
        await log('warning', `AI 추출 결과 없음`, { source: result.source });
        return [];
      }
      
    } catch (error) {
      await log('error', `AI 추출 실패: ${error.message}`);
      return [];
    }
  }

  // Collect current short being watched
  async function collectCurrentShort() {
    try {
      const url = window.location.href;
      const shortsMatch = url.match(/\/shorts\/([a-zA-Z0-9_-]+)/);
      const videoId = shortsMatch ? shortsMatch[1] : null;
      
      if (!videoId) return null;
      
      // Get title and channel from Shorts player UI
      const titleEl = findElement('h2.ytd-reel-video-renderer yt-formatted-string, yt-formatted-string.title, #shorts-title');
      const channelEl = findElement('#channel-name a, ytd-channel-name a, .ytd-reel-video-renderer #channel-name');
      
      console.log('[EchoBreaker] Current short - ID:', videoId, 'Title:', titleEl?.textContent?.substring(0, 30));
      
      return {
        videoId,
        title: titleEl?.textContent?.trim() || document.title.replace(' - YouTube', ''),
        channelName: channelEl?.textContent?.trim() || 'Unknown',
        channelId: extractChannelId(channelEl?.href),
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        viewCount: null,
        duration: 'SHORT',
        source: 'shorts',
        collectedAt: new Date().toISOString()
      };
    } catch (e) {
      console.error('[EchoBreaker] Error collecting current short:', e);
      return null;
    }
  }

  // Collect both regular videos and shorts from home page
  // Uses Self-Healing Scraper with AI-powered selector discovery
  async function collectHomePageContent() {
    // Check if shorts collection is enabled
    const stored = await chrome.storage.local.get(['collectShorts']);
    const collectShortsEnabled = stored.collectShorts !== false;
    
    // Use Self-Healing Crawl for home page
    const result = await selfHealingCrawl('home');
    
    // Filter shorts if disabled
    if (!collectShortsEnabled) {
      result.shorts = [];
    }
    
    console.log('[EchoBreaker] Collected from home:', { 
      videos: result.videos.length, 
      shorts: result.shorts.length 
    });
    
    return result;
  }
  
  // Extract short data from a DOM element - YouTube December 2024 DOM structure
  async function extractShortFromElement(el) {
    try {
      let videoId = null;
      let title = 'Short';
      let channelName = 'Unknown';
      
      // Find the yt-lockup-view-model container
      const lockupModel = el.querySelector('.yt-lockup-view-model') || 
                          el.querySelector('yt-lockup-view-model') ||
                          el;
      const lockupClasses = lockupModel.className || '';
      
      // === Extract Video ID ===
      // Method 1: From content-id-{videoId} class
      const contentIdMatch = lockupClasses.match(/content-id-([a-zA-Z0-9_-]+)/);
      if (contentIdMatch) {
        videoId = contentIdMatch[1];
      }
      
      // Method 2: From shorts link href
      if (!videoId) {
        const shortsLink = el.querySelector('a[href*="/shorts/"]');
        if (shortsLink) {
          const href = shortsLink.getAttribute('href');
          const match = href.match(/\/shorts\/([a-zA-Z0-9_-]+)/);
          if (match) {
            videoId = match[1];
          }
        }
      }
      
      // === Extract Title ===
      // Method 1: From h3 title attribute
      const h3 = el.querySelector('h3[title]');
      if (h3) {
        title = h3.getAttribute('title') || 'Short';
      }
      
      // Method 2: From yt-core-attributed-string span
      if (title === 'Short') {
        const titleSpan = el.querySelector('.yt-core-attributed-string');
        if (titleSpan?.textContent?.trim()) {
          title = titleSpan.textContent.trim();
        }
      }
      
      // Method 3: From link aria-label
      if (title === 'Short') {
        const titleLink = el.querySelector('a[aria-label]');
        if (titleLink) {
          const ariaLabel = titleLink.getAttribute('aria-label');
          if (ariaLabel && ariaLabel.length > 2) {
            title = ariaLabel;
          }
        }
      }
      
      // Method 4: Old style
      if (title === 'Short') {
        const titleEl = el.querySelector('#video-title');
        if (titleEl?.textContent?.trim()) {
          title = titleEl.textContent.trim();
        }
      }
      
      // === Extract Channel Name ===
      const subtitleEl = el.querySelector('.yt-lockup-metadata-view-model__subtitle a');
      if (subtitleEl?.textContent?.trim()) {
        channelName = subtitleEl.textContent.trim();
      }
      
      if (!videoId) return null;
      
      return {
        videoId,
        title,
        channelName,
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        duration: 'SHORT',
        source: 'shorts',
        sourcePhase: 'shorts',
        collectedAt: new Date().toISOString()
      };
    } catch (e) {
      return null;
    }
  }
  
  // Extract video data from a DOM element - YouTube December 2024 DOM structure
  // New structure: yt-lockup-view-model with content-id-{videoId} class
  async function extractVideoFromElement(el) {
    try {
      let videoId = null;
      let title = '';
      let channelName = 'Unknown';
      let isShort = false;
      let extractMethod = '';
      
      // Find the yt-lockup-view-model container (new December 2024 layout)
      const lockupModel = el.querySelector('.yt-lockup-view-model') || 
                          el.querySelector('yt-lockup-view-model') ||
                          el;
      
      // === Check if this is a Short ===
      // Method 1: Check for shorts-specific class
      const lockupClasses = lockupModel.className || '';
      if (lockupClasses.includes('yt-lockup-view-model--shorts')) {
        isShort = true;
      }
      // Method 2: Check data attribute
      if (lockupModel.getAttribute('data-lockup-view-model-type') === 'ShortsVideo') {
        isShort = true;
      }
      // Method 3: Check for shorts link
      const shortsLink = el.querySelector('a[href*="/shorts/"]');
      if (shortsLink) {
        isShort = true;
      }
      
      // === Extract Video ID ===
      // Method 1: From content-id-{videoId} class (most reliable for new layout)
      const contentIdMatch = lockupClasses.match(/content-id-([a-zA-Z0-9_-]+)/);
      if (contentIdMatch) {
        videoId = contentIdMatch[1];
        extractMethod = 'class';
      }
      
      // Method 2: From watch link href
      if (!videoId) {
        const watchLink = el.querySelector('a[href*="/watch?v="]');
        if (watchLink) {
          const href = watchLink.getAttribute('href');
          videoId = extractVideoId(href);
          if (videoId) extractMethod = 'href';
        }
      }
      
      // Method 3: From shorts link href
      if (!videoId && shortsLink) {
        const href = shortsLink.getAttribute('href');
        const match = href.match(/\/shorts\/([a-zA-Z0-9_-]+)/);
        if (match) {
          videoId = match[1];
          extractMethod = 'shorts-href';
        }
      }
      
      // === Extract Title ===
      // Method 1: From h3 title attribute (most reliable)
      const h3 = el.querySelector('h3[title]');
      if (h3) {
        title = h3.getAttribute('title') || '';
      }
      
      // Method 2: From yt-core-attributed-string span
      if (!title) {
        const titleSpan = el.querySelector('.yt-core-attributed-string');
        if (titleSpan?.textContent?.trim()) {
          title = titleSpan.textContent.trim();
        }
      }
      
      // Method 3: From link aria-label
      if (!title) {
        const titleLink = el.querySelector('a.yt-lockup-metadata-view-model_title, a[aria-label]');
        if (titleLink) {
          const ariaLabel = titleLink.getAttribute('aria-label');
          if (ariaLabel) {
            // aria-label format: "제목 X분 Y초" - extract title before duration
            const durationMatch = ariaLabel.match(/(.+?)\s+\d+분|\d+초|(\d+:\d+)/);
            title = durationMatch ? durationMatch[1].trim() : ariaLabel;
          }
        }
      }
      
      // Method 4: Old style #video-title
      if (!title) {
        const videoTitle = el.querySelector('#video-title');
        if (videoTitle?.textContent?.trim()) {
          title = videoTitle.textContent.trim();
        }
      }
      
      // === Extract Channel Name ===
      // Method 1: New layout subtitle
      const subtitleEl = el.querySelector('.yt-lockup-metadata-view-model__subtitle a');
      if (subtitleEl?.textContent?.trim()) {
        channelName = subtitleEl.textContent.trim();
      }
      
      // Method 2: Old layout channel name
      if (channelName === 'Unknown') {
        const channelEl = el.querySelector('#channel-name a, ytd-channel-name a, ytd-channel-name #text');
        if (channelEl?.textContent?.trim()) {
          channelName = channelEl.textContent.trim();
        }
      }
      
      // Debug logging (first 5 elements)
      if (!window._ebDebugCount) window._ebDebugCount = 0;
      if (window._ebDebugCount < 5) {
        await log('info', `추출 #${window._ebDebugCount + 1}`, {
          method: extractMethod,
          videoId: videoId?.substring(0, 11),
          title: title?.substring(0, 25),
          channel: channelName?.substring(0, 15),
          isShort
        });
        window._ebDebugCount++;
      }

      // Must have video ID
      if (!videoId) return null;
      
      // Skip shorts here (they're handled separately by extractShortFromElement)
      if (isShort) return null;
      
      // Must have title (but be lenient)
      if (!title) title = 'Untitled';

      return {
        videoId,
        title,
        channelName,
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        source: 'home_feed',
        sourcePhase: 'home_feed',
        collectedAt: new Date().toISOString()
      };
    } catch (e) {
      return null;
    }
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
    
    await log('info', `사이드바 분석`, {
      selector: containerSelector,
      found: videoEls.length
    });
    
    // If no elements found, try AI extraction
    if (videoEls.length === 0) {
      await log('warning', `사이드바 셀렉터 실패 - AI 추출 시작`);
      const aiVideos = await extractVideosWithAI('watch');
      if (aiVideos.length > 0) {
        await log('success', `AI 사이드바 추출 성공`, { count: aiVideos.length });
        return aiVideos.map(v => ({
          videoId: v.videoId,
          title: v.title,
          channelName: v.channelName,
          thumbnailUrl: v.thumbnail,
          source: 'sidebar_recommendation',
          sourcePhase: 'recommended',
          significanceWeight: 35,
          collectedAt: new Date().toISOString()
        }));
      }
    }

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
          sourcePhase: 'recommended',
          significanceWeight: 35,
          collectedAt: new Date().toISOString()
        });
      } catch (e) {
        // Skip
      }
    }

    // If elements found but no videos extracted, try AI
    if (videoEls.length > 0 && videos.length === 0) {
      await log('warning', `사이드바 ${videoEls.length}개 요소 발견, 추출 실패 - AI 시도`);
      const aiVideos = await extractVideosWithAI('watch');
      if (aiVideos.length > 0) {
        await log('success', `AI 사이드바 추출 성공`, { count: aiVideos.length });
        return aiVideos.map(v => ({
          videoId: v.videoId,
          title: v.title,
          channelName: v.channelName,
          thumbnailUrl: v.thumbnail,
          source: 'sidebar_recommendation',
          sourcePhase: 'recommended',
          significanceWeight: 35,
          collectedAt: new Date().toISOString()
        }));
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
    await log('info', `서버 전송 중...`, { url: CONFIG.API_BASE_URL });
    
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
      await log('error', `서버 전송 실패: ${error.message}`, {
        serverUrl: CONFIG.API_BASE_URL
      });
      
      const stored = await chrome.storage.local.get(['pendingData']);
      const pending = stored.pendingData || [];
      pending.push({ ...data, timestamp: Date.now() });
      await chrome.storage.local.set({ pendingData: pending.slice(-10) });
      
      return false;
    }
  }

  // ========================================
  // VISUAL OVERLAY SYSTEM
  // Echo chamber dimming + Diversity badges
  // ========================================

  // Inject CSS styles for overlays
  function injectOverlayStyles() {
    if (document.getElementById('echobreaker-overlay-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'echobreaker-overlay-styles';
    style.textContent = `
      /* Echo chamber dimming */
      .echobreaker-echo-chamber {
        opacity: 0.4 !important;
        transition: opacity 0.3s ease !important;
      }
      .echobreaker-echo-chamber:hover {
        opacity: 0.9 !important;
      }
      
      /* Diversity highlight - green border */
      .echobreaker-diverse {
        outline: 3px solid #22c55e !important;
        outline-offset: 2px !important;
      }
      
      /* Stance badges */
      .echobreaker-badge {
        position: absolute !important;
        top: 4px !important;
        right: 4px !important;
        padding: 2px 6px !important;
        border-radius: 4px !important;
        font-size: 10px !important;
        font-weight: bold !important;
        color: white !important;
        z-index: 1000 !important;
        pointer-events: none !important;
        text-shadow: 0 1px 2px rgba(0,0,0,0.5) !important;
      }
      .echobreaker-badge-progressive {
        background: linear-gradient(135deg, #3b82f6, #1d4ed8) !important;
      }
      .echobreaker-badge-conservative {
        background: linear-gradient(135deg, #ef4444, #b91c1c) !important;
      }
      .echobreaker-badge-centrist {
        background: linear-gradient(135deg, #a855f7, #7c3aed) !important;
      }
      .echobreaker-badge-non-political {
        background: linear-gradient(135deg, #6b7280, #4b5563) !important;
      }
      
      /* Echo warning icon */
      .echobreaker-echo-warning {
        position: absolute !important;
        bottom: 4px !important;
        right: 4px !important;
        width: 24px !important;
        height: 24px !important;
        background: rgba(239, 68, 68, 0.9) !important;
        border-radius: 50% !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        z-index: 1000 !important;
        pointer-events: none !important;
      }
      .echobreaker-echo-warning::after {
        content: "!" !important;
        color: white !important;
        font-weight: bold !important;
        font-size: 14px !important;
      }
      
      /* Diversity star */
      .echobreaker-diverse-star {
        position: absolute !important;
        bottom: 4px !important;
        left: 4px !important;
        width: 24px !important;
        height: 24px !important;
        background: rgba(34, 197, 94, 0.9) !important;
        border-radius: 50% !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        z-index: 1000 !important;
        pointer-events: none !important;
      }
      .echobreaker-diverse-star::after {
        content: "+" !important;
        color: white !important;
        font-weight: bold !important;
        font-size: 16px !important;
      }
    `;
    document.head.appendChild(style);
  }

  // Cache for video stances
  let stanceCache = {};
  let lastStanceCheck = 0;
  const STANCE_CHECK_INTERVAL = 30000; // Check every 30 seconds

  // Get video stances from server
  async function getVideoStances(videoIds) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_VIDEO_STANCES',
        videoIds
      });
      return response || { stances: {} };
    } catch (error) {
      console.log('[EchoBreaker] Failed to get stances:', error.message);
      return { stances: {} };
    }
  }

  // Apply visual overlays to video thumbnails
  async function applyVisualOverlays() {
    // Only check periodically to avoid too many API calls
    if (Date.now() - lastStanceCheck < STANCE_CHECK_INTERVAL) return;
    lastStanceCheck = Date.now();
    
    injectOverlayStyles();
    
    // Find all video elements - use specific YouTube custom elements
    const videoElements = document.querySelectorAll('ytd-compact-video-renderer, ytd-video-renderer, ytd-rich-item-renderer');
    if (videoElements.length === 0) return;
    
    // Extract video IDs - deduplicate and map to root element only
    const videoIdMap = new Map();
    const processedIds = new Set();
    
    videoElements.forEach(el => {
      // Skip if already processed to avoid duplicates
      if (el.dataset.echobreakerProcessed === 'true') {
        // Already processed this element, check if videoId already mapped
        const existingId = el.dataset.echobreakerVideoId;
        if (existingId) {
          processedIds.add(existingId);
        }
        return;
      }
      
      const link = el.querySelector('a#thumbnail, a[href*="/watch"], a[href*="/shorts/"]');
      if (link) {
        const href = link.getAttribute('href');
        const videoId = extractVideoId(href);
        if (videoId && !processedIds.has(videoId)) {
          videoIdMap.set(videoId, el);
          processedIds.add(videoId);
          el.dataset.echobreakerVideoId = videoId;
        }
      }
    });
    
    if (videoIdMap.size === 0) return;
    
    const videoIds = Array.from(videoIdMap.keys());
    console.log('[EchoBreaker] Checking stances for', videoIds.length, 'videos');
    
    // Get stances from server
    const response = await getVideoStances(videoIds);
    const { stances, dominantStance, totalAnalyzed, totalPolitical } = response;
    
    // Only apply overlays if we have enough political content analyzed
    if (!totalPolitical || totalPolitical < 5) {
      console.log('[EchoBreaker] Not enough political videos analyzed yet:', totalPolitical || 0);
      return;
    }
    
    // Apply overlays
    let echoCount = 0;
    let diverseCount = 0;
    
    videoIds.forEach(videoId => {
      const el = videoIdMap.get(videoId);
      if (!el) return;
      
      const stanceInfo = stances[videoId];
      
      // Mark as processed
      el.dataset.echobreakerProcessed = 'true';
      
      // First, clean up ALL existing overlays on this element
      el.querySelectorAll('.echobreaker-badge, .echobreaker-echo-warning, .echobreaker-diverse-star').forEach(b => b.remove());
      el.classList.remove('echobreaker-echo-chamber', 'echobreaker-diverse');
      
      // Skip if no stance info (unanalyzed video)
      if (!stanceInfo) return;
      
      // Find the thumbnail container - be specific to avoid nested elements
      const thumbnail = el.querySelector('ytd-thumbnail, a#thumbnail');
      if (!thumbnail) return;
      
      // Ensure thumbnail container has position relative
      const thumbnailStyle = getComputedStyle(thumbnail);
      if (thumbnailStyle.position === 'static') {
        thumbnail.style.position = 'relative';
      }
      
      // Apply echo chamber dimming
      if (stanceInfo.isEchoChamber) {
        el.classList.add('echobreaker-echo-chamber');
        
        // Add warning icon (only if not already present)
        if (!thumbnail.querySelector('.echobreaker-echo-warning')) {
          const warning = document.createElement('div');
          warning.className = 'echobreaker-echo-warning';
          thumbnail.appendChild(warning);
        }
        echoCount++;
      }
      
      // Apply diversity highlight
      if (stanceInfo.isDiverse) {
        el.classList.add('echobreaker-diverse');
        
        // Add star icon (only if not already present)
        if (!thumbnail.querySelector('.echobreaker-diverse-star')) {
          const star = document.createElement('div');
          star.className = 'echobreaker-diverse-star';
          thumbnail.appendChild(star);
        }
        diverseCount++;
      }
      
      // Add stance badge if political content
      if (stanceInfo.stance && stanceInfo.stance !== 'non-political') {
        // Only add if not already present
        if (!thumbnail.querySelector('.echobreaker-badge')) {
          const badge = document.createElement('div');
          badge.className = `echobreaker-badge echobreaker-badge-${stanceInfo.stance}`;
          
          const labels = {
            'progressive': 'L',
            'conservative': 'R',
            'centrist': 'C'
          };
          badge.textContent = labels[stanceInfo.stance] || '';
          
          thumbnail.appendChild(badge);
        }
      }
    });
    
    if (echoCount > 0 || diverseCount > 0) {
      console.log(`[EchoBreaker] Applied overlays: ${echoCount} echo chamber, ${diverseCount} diverse (dominant: ${dominantStance})`);
    }
  }

  // Watch for DOM changes to apply overlays to new videos
  function observeForOverlays() {
    // Apply overlays on initial load
    setTimeout(() => applyVisualOverlays(), 3000);
    
    // Watch for new videos being loaded
    const overlayObserver = new MutationObserver((mutations) => {
      let shouldCheck = false;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === 1 && (
              node.tagName === 'YTD-COMPACT-VIDEO-RENDERER' ||
              node.tagName === 'YTD-VIDEO-RENDERER' ||
              node.tagName === 'YTD-RICH-ITEM-RENDERER'
            )) {
              shouldCheck = true;
              break;
            }
          }
        }
        if (shouldCheck) break;
      }
      
      if (shouldCheck) {
        // Debounce
        setTimeout(() => applyVisualOverlays(), 1000);
      }
    });
    
    // Wait for body
    if (document.body) {
      overlayObserver.observe(document.body, { childList: true, subtree: true });
    } else {
      const waiter = setInterval(() => {
        if (document.body) {
          clearInterval(waiter);
          overlayObserver.observe(document.body, { childList: true, subtree: true });
        }
      }, 100);
    }
  }

  // Initialize overlay system after main init
  function initOverlays() {
    console.log('[EchoBreaker] Initializing overlay system');
    injectOverlayStyles();
    observeForOverlays();
  }

  // ========================================
  // AI DIVERSE RECOMMENDATIONS INJECTION
  // Insert AI-recommended videos into YouTube DOM
  // ========================================

  // Inject styles for EchoBreaker recommendation cards (YouTube-matching style)
  function injectRecommendationStyles() {
    if (document.getElementById('echobreaker-rec-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'echobreaker-rec-styles';
    style.textContent = `
      /* EchoBreaker Recommendation Container - YouTube style */
      .echobreaker-rec-container {
        margin: 0 0 16px 0 !important;
        padding: 12px !important;
        background: var(--yt-spec-badge-chip-background, rgba(0, 0, 0, 0.05)) !important;
        border: 1px solid #22c55e !important;
        border-radius: 12px !important;
        position: relative !important;
      }
      
      html[dark] .echobreaker-rec-container,
      [dark] .echobreaker-rec-container {
        background: rgba(34, 197, 94, 0.08) !important;
      }
      
      .echobreaker-rec-header {
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        margin-bottom: 12px !important;
        padding-bottom: 8px !important;
        border-bottom: 1px solid rgba(34, 197, 94, 0.2) !important;
      }
      
      .echobreaker-rec-logo {
        width: 20px !important;
        height: 20px !important;
        background: linear-gradient(135deg, #22c55e, #16a34a) !important;
        border-radius: 4px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        color: white !important;
        font-weight: bold !important;
        font-size: 11px !important;
      }
      
      .echobreaker-rec-title {
        font-size: 13px !important;
        font-weight: 500 !important;
        color: #22c55e !important;
        font-family: "Roboto", "Arial", sans-serif !important;
      }
      
      .echobreaker-rec-subtitle {
        font-size: 11px !important;
        color: var(--yt-spec-text-secondary, #606060) !important;
        margin-left: auto !important;
        font-family: "Roboto", "Arial", sans-serif !important;
      }
      
      /* Video Card - Match YouTube's compact video renderer exactly */
      .echobreaker-video-card {
        display: flex !important;
        gap: 8px !important;
        padding: 0 !important;
        margin-bottom: 8px !important;
        cursor: pointer !important;
        text-decoration: none !important;
        border-radius: 8px !important;
        overflow: hidden !important;
      }
      
      .echobreaker-video-card:hover .echobreaker-video-title {
        color: var(--yt-spec-text-primary, #0f0f0f) !important;
      }
      
      .echobreaker-video-card:last-child {
        margin-bottom: 0 !important;
      }
      
      /* Thumbnail - YouTube uses 168x94 for sidebar (16:9 ratio) */
      .echobreaker-video-thumbnail-wrapper {
        position: relative !important;
        flex-shrink: 0 !important;
        width: 168px !important;
        height: 94px !important;
        border-radius: 8px !important;
        overflow: hidden !important;
        background: #000 !important;
      }
      
      .echobreaker-video-thumbnail {
        width: 100% !important;
        height: 100% !important;
        object-fit: cover !important;
      }
      
      .echobreaker-safe-badge-overlay {
        position: absolute !important;
        bottom: 4px !important;
        right: 4px !important;
        display: flex !important;
        align-items: center !important;
        gap: 2px !important;
        font-size: 10px !important;
        background: rgba(34, 197, 94, 0.9) !important;
        color: white !important;
        padding: 2px 4px !important;
        border-radius: 2px !important;
        font-family: "Roboto", "Arial", sans-serif !important;
        font-weight: 500 !important;
      }
      
      .echobreaker-video-info {
        flex: 1 !important;
        min-width: 0 !important;
        padding: 0 8px 0 0 !important;
      }
      
      .echobreaker-video-title {
        font-size: 14px !important;
        font-weight: 500 !important;
        color: var(--yt-spec-text-primary, #0f0f0f) !important;
        line-height: 20px !important;
        margin-bottom: 4px !important;
        display: -webkit-box !important;
        -webkit-line-clamp: 2 !important;
        -webkit-box-orient: vertical !important;
        overflow: hidden !important;
        font-family: "Roboto", "Arial", sans-serif !important;
      }
      
      html[dark] .echobreaker-video-title,
      [dark] .echobreaker-video-title {
        color: var(--yt-spec-text-primary, #f1f1f1) !important;
      }
      
      .echobreaker-video-channel {
        font-size: 12px !important;
        color: var(--yt-spec-text-secondary, #606060) !important;
        margin-bottom: 4px !important;
        font-family: "Roboto", "Arial", sans-serif !important;
        line-height: 18px !important;
      }
      
      html[dark] .echobreaker-video-channel,
      [dark] .echobreaker-video-channel {
        color: var(--yt-spec-text-secondary, #aaa) !important;
      }
      
      .echobreaker-video-reason {
        font-size: 11px !important;
        color: #22c55e !important;
        display: -webkit-box !important;
        -webkit-line-clamp: 2 !important;
        -webkit-box-orient: vertical !important;
        overflow: hidden !important;
        font-family: "Roboto", "Arial", sans-serif !important;
        line-height: 16px !important;
      }
    `;
    document.head.appendChild(style);
  }

  // Cache for recommendations
  let cachedRecommendations = null;
  let lastRecFetch = 0;
  const REC_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  // Get AI diverse recommendations
  async function getDiverseRecommendations() {
    // Use cache if fresh
    if (cachedRecommendations && (Date.now() - lastRecFetch < REC_CACHE_DURATION)) {
      return cachedRecommendations;
    }
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_DIVERSE_RECOMMENDATIONS'
      });
      
      if (response && response.recommendations) {
        cachedRecommendations = response;
        lastRecFetch = Date.now();
        return response;
      }
    } catch (error) {
      console.log('[EchoBreaker] Failed to get recommendations:', error.message);
    }
    
    return { recommendations: [] };
  }

  // Create recommendation card HTML (YouTube compact-video-renderer style)
  function createRecommendationCard(rec) {
    const card = document.createElement('a');
    card.className = 'echobreaker-video-card';
    card.href = rec.noCookieUrl || rec.youtubeUrl;
    card.target = '_blank';
    card.rel = 'noopener noreferrer';
    card.dataset.videoId = rec.videoId;
    
    // Use maxresdefault for better quality, fallback to mqdefault
    const thumbnailUrl = `https://img.youtube.com/vi/${rec.videoId}/mqdefault.jpg`;
    
    card.innerHTML = `
      <div class="echobreaker-video-thumbnail-wrapper">
        <img class="echobreaker-video-thumbnail" 
             src="${thumbnailUrl}" 
             alt="${rec.title}">
      </div>
      <div class="echobreaker-video-info">
        <div class="echobreaker-video-title">${rec.title}</div>
        <div class="echobreaker-video-channel">${rec.channelName}</div>
        <div class="echobreaker-video-reason">${rec.reason}</div>
      </div>
    `;
    
    // Open video normally
    card.addEventListener('click', (e) => {
      e.preventDefault();
      window.open(`https://www.youtube.com/watch?v=${rec.videoId}`, '_blank');
    });
    
    return card;
  }

  // Create the full recommendation container
  function createRecommendationContainer(recommendations, targetPerspective) {
    const container = document.createElement('div');
    container.className = 'echobreaker-rec-container';
    container.id = 'echobreaker-diverse-recs';
    
    const header = document.createElement('div');
    header.className = 'echobreaker-rec-header';
    header.innerHTML = `
      <div class="echobreaker-rec-logo">E</div>
      <span class="echobreaker-rec-title">EchoBreaker: Diverse Perspectives</span>
      <span class="echobreaker-rec-subtitle">AI-curated ${targetPerspective || 'balanced'} content</span>
    `;
    
    container.appendChild(header);
    
    // Add video cards
    recommendations.forEach(rec => {
      container.appendChild(createRecommendationCard(rec));
    });
    
    return container;
  }

  // Find best insertion point in YouTube DOM (returns only ONE point to prevent duplicates)
  function findInsertionPoint() {
    const url = location.href;
    
    // Watch page - use sidebar
    if (url.includes('/watch')) {
      const sidebarSelectors = [
        '#secondary-inner ytd-watch-next-secondary-results-renderer #items',
        '#secondary ytd-watch-next-secondary-results-renderer #items',
        '#related #items',
        'ytd-watch-next-secondary-results-renderer #items'
      ];
      
      for (const selector of sidebarSelectors) {
        const element = document.querySelector(selector);
        if (element && element.offsetParent !== null) {
          console.log('[EchoBreaker] Found watch sidebar:', selector);
          return { element, position: 'prepend', type: 'watch' };
        }
      }
    }
    
    // Home page - use the main grid
    if (url === 'https://www.youtube.com/' || url.includes('youtube.com/?')) {
      const homeSelectors = [
        'ytd-rich-grid-renderer #contents'
      ];
      
      for (const selector of homeSelectors) {
        const element = document.querySelector(selector);
        if (element && element.offsetParent !== null && element.children.length > 0) {
          console.log('[EchoBreaker] Found home grid:', selector);
          return { element, position: 'prepend', type: 'home' };
        }
      }
    }
    
    // Search results page
    if (url.includes('/results')) {
      const searchSelectors = [
        'ytd-section-list-renderer #contents'
      ];
      
      for (const selector of searchSelectors) {
        const element = document.querySelector(selector);
        if (element && element.offsetParent !== null) {
          console.log('[EchoBreaker] Found search results:', selector);
          return { element, position: 'prepend', type: 'search' };
        }
      }
    }
    
    return null;
  }

  // Inject recommendations into YouTube DOM
  let injectionAttempts = 0;
  const MAX_INJECTION_ATTEMPTS = 10;
  
  async function injectDiverseRecommendations() {
    // Don't inject if already present
    if (document.getElementById('echobreaker-diverse-recs')) {
      console.log('[EchoBreaker] Recommendations already injected');
      return true;
    }
    
    injectRecommendationStyles();
    
    console.log('[EchoBreaker] Fetching diverse recommendations...');
    const response = await getDiverseRecommendations();
    const { recommendations, targetPerspective } = response;
    
    if (!recommendations || recommendations.length === 0) {
      console.log('[EchoBreaker] No diverse recommendations available');
      return false;
    }
    
    const insertPoint = findInsertionPoint();
    if (!insertPoint) {
      injectionAttempts++;
      console.log(`[EchoBreaker] No insertion point found (attempt ${injectionAttempts}/${MAX_INJECTION_ATTEMPTS})`);
      
      // Retry if page is still loading
      if (injectionAttempts < MAX_INJECTION_ATTEMPTS) {
        setTimeout(() => injectDiverseRecommendations(), 2000);
      }
      return false;
    }
    
    // Reset attempts on success
    injectionAttempts = 0;
    
    const container = createRecommendationContainer(recommendations, targetPerspective);
    
    try {
      if (insertPoint.position === 'prepend') {
        insertPoint.element.insertBefore(container, insertPoint.element.firstChild);
      } else {
        insertPoint.element.appendChild(container);
      }
      
      console.log(`[EchoBreaker] Successfully injected ${recommendations.length} diverse recommendations`);
      return true;
    } catch (error) {
      console.error('[EchoBreaker] Failed to inject recommendations:', error);
      return false;
    }
  }

  // Watch for page navigation to inject recommendations
  let recInjectionInProgress = false;
  
  function observeForRecommendationInjection() {
    console.log('[EchoBreaker] Starting recommendation injection observer');
    
    // Single injection attempt with lock to prevent duplicates
    const tryInject = async () => {
      if (recInjectionInProgress) return;
      if (document.getElementById('echobreaker-diverse-recs')) return;
      
      recInjectionInProgress = true;
      try {
        await injectDiverseRecommendations();
      } finally {
        recInjectionInProgress = false;
      }
    };
    
    // Single initial attempt after page loads
    setTimeout(tryInject, 2000);
    
    // Watch for YouTube SPA navigation
    let lastUrl = location.href;
    
    const checkUrlChange = () => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        console.log('[EchoBreaker] URL changed, reinitializing recommendations');
        
        // Remove existing container on navigation
        const existing = document.getElementById('echobreaker-diverse-recs');
        if (existing) {
          existing.remove();
        }
        
        // Reset injection attempts
        injectionAttempts = 0;
        recInjectionInProgress = false;
        
        // Re-inject after navigation
        setTimeout(tryInject, 2000);
      }
    };
    
    // Use popstate and yt-navigate-finish for SPA navigation
    window.addEventListener('popstate', checkUrlChange);
    window.addEventListener('yt-navigate-finish', checkUrlChange);
    
    // Also observe body for mutations that might indicate page change
    const navObserver = new MutationObserver(() => {
      checkUrlChange();
    });
    
    if (document.body) {
      navObserver.observe(document.body, { childList: true, subtree: false });
    }
  }

  // Initialize recommendation injection
  async function initRecommendations() {
    // Check if feature is enabled
    const stored = await chrome.storage.local.get(['enableRecCards']);
    if (stored.enableRecCards === false) {
      console.log('[EchoBreaker] AI recommendation cards disabled');
      return;
    }
    console.log('[EchoBreaker] Initializing AI recommendation injection system');
    injectRecommendationStyles();
    observeForRecommendationInjection();
  }

  // Initialize overlays with settings check
  async function initOverlaysWithSettings() {
    const stored = await chrome.storage.local.get(['enableStanceOverlays']);
    if (stored.enableStanceOverlays === false) {
      console.log('[EchoBreaker] Stance overlays disabled');
      return;
    }
    initOverlays();
  }
  
  // Listen for settings changes
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      if (changes.enableRecCards) {
        if (changes.enableRecCards.newValue === false) {
          // Remove existing recommendations
          const existing = document.getElementById('echobreaker-diverse-recs');
          if (existing) existing.remove();
        } else {
          initRecommendations();
        }
      }
      if (changes.enableStanceOverlays) {
        if (changes.enableStanceOverlays.newValue === false) {
          // Remove existing overlays
          document.querySelectorAll('.echobreaker-stance-overlay').forEach(el => el.remove());
        } else {
          initOverlaysWithSettings();
        }
      }
    }
  });

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      init();
      setTimeout(initOverlaysWithSettings, 2000);
      setTimeout(initRecommendations, 3000);
    });
  } else {
    init();
    setTimeout(initOverlaysWithSettings, 2000);
    setTimeout(initRecommendations, 3000);
  }
})();
