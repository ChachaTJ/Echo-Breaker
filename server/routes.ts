import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertVideoSchema, 
  insertSubscriptionSchema,
  insertSnapshotSchema,
  type CrawlDataPayload,
  type CategoryDistribution,
  type InsertRecommendation
} from "@shared/schema";
import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
// Initialize OpenAI client with Replit AI Integrations
let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (!openai && process.env.AI_INTEGRATIONS_OPENAI_BASE_URL && process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    openai = new OpenAI({
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
    });
  }
  return openai;
}

function isOpenAIAvailable(): boolean {
  return !!(process.env.AI_INTEGRATIONS_OPENAI_BASE_URL && process.env.AI_INTEGRATIONS_OPENAI_API_KEY);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Stats endpoint
  app.get("/api/stats", async (req, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to get stats" });
    }
  });

  // Videos endpoints
  app.get("/api/videos", async (req, res) => {
    try {
      const videos = await storage.getVideos();
      res.json(videos);
    } catch (error) {
      res.status(500).json({ error: "Failed to get videos" });
    }
  });

  app.post("/api/videos", async (req, res) => {
    try {
      const parsed = insertVideoSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid video data" });
      }
      const video = await storage.createVideo(parsed.data);
      res.json(video);
    } catch (error) {
      res.status(500).json({ error: "Failed to create video" });
    }
  });

  // Bulk crawl data endpoint (for Chrome extension)
  app.post("/api/crawl", async (req, res) => {
    try {
      const data = req.body as CrawlDataPayload;
      let results = { videos: 0, subscriptions: 0, recommended: 0 };
      
      if (data.videos && data.videos.length > 0) {
        await storage.createVideos(data.videos);
        results.videos = data.videos.length;
      }
      
      if (data.subscriptions && data.subscriptions.length > 0) {
        await storage.createSubscriptions(data.subscriptions);
        results.subscriptions = data.subscriptions.length;
      }
      
      if (data.recommendedVideos && data.recommendedVideos.length > 0) {
        // Store recommended videos as regular videos for analysis
        // (These are what YouTube is suggesting - important for detecting echo chamber)
        await storage.createVideos(data.recommendedVideos);
        results.recommended = data.recommendedVideos.length;
      }
      
      res.json({ 
        success: true, 
        message: "Data received",
        received: results
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to process crawl data" });
    }
  });

  // AI-powered DOM selector discovery endpoint
  // Cached selectors to reduce LLM calls
  const selectorCache: Map<string, { selector: string; timestamp: number }> = new Map();
  const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  app.post("/api/analyze-dom", async (req, res) => {
    try {
      const { html, target, pageType } = req.body;
      
      if (!html || !target) {
        return res.status(400).json({ error: "Missing html or target parameter" });
      }

      const cacheKey = `${pageType || 'unknown'}_${target}`;
      
      // Check cache first
      const cached = selectorCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        return res.json({ 
          selector: cached.selector, 
          source: 'cache',
          cacheKey 
        });
      }

      // Check if OpenAI is available
      const client = getOpenAIClient();
      if (!client) {
        // Return default selectors as fallback
        const defaultSelectors: Record<string, Record<string, string>> = {
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
            watch: '',
            home: 'a#thumbnail, a.ytd-thumbnail',
            default: 'a#thumbnail'
          },
          video_container: {
            home: 'ytd-rich-item-renderer, ytd-video-renderer',
            subscriptions: 'ytd-grid-video-renderer, ytd-rich-item-renderer',
            default: 'ytd-video-renderer'
          },
          sidebar_recommendations: {
            watch: 'ytd-compact-video-renderer',
            default: 'ytd-compact-video-renderer'
          },
          subscription_channels: {
            default: 'ytd-guide-entry-renderer a[href*="/@"], ytd-guide-entry-renderer a[href*="/channel/"]'
          }
        };

        const targetSelectors = defaultSelectors[target] || {};
        const selector = targetSelectors[pageType] || targetSelectors['default'] || '';
        
        return res.json({ 
          selector, 
          source: 'fallback',
          message: 'OpenAI not available, using default selectors'
        });
      }

      // Use LLM to analyze DOM and find selector
      const prompt = `You are a CSS selector expert. Analyze this HTML snippet from YouTube and provide the best CSS selector to find the "${target}".

Page type: ${pageType || 'unknown'}
Target element: ${target}

HTML snippet (first 3000 chars):
${html.substring(0, 3000)}

Rules:
1. Return ONLY a valid CSS selector string, nothing else
2. Use robust selectors that are less likely to break (prefer IDs and data attributes)
3. If multiple selectors work, separate them with comma
4. Consider YouTube's custom elements (ytd-*, yt-formatted-string, etc.)

Examples of good responses:
- For video_title: "h1.ytd-watch-metadata yt-formatted-string"
- For channel_name: "#owner #channel-name a"
- For video_container: "ytd-rich-item-renderer, ytd-video-renderer"

Your response (selector only):`;

      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 150,
        temperature: 0.1
      });

      const selector = response.choices[0]?.message?.content?.trim() || '';
      
      if (selector && !selector.includes(' ') || selector.includes(',') || selector.includes('#') || selector.includes('.') || selector.includes('[')) {
        // Cache the result
        selectorCache.set(cacheKey, { selector, timestamp: Date.now() });
        
        res.json({ 
          selector, 
          source: 'ai',
          cacheKey 
        });
      } else {
        res.json({ 
          selector: '', 
          source: 'ai_failed',
          message: 'LLM returned invalid selector'
        });
      }

    } catch (error) {
      console.error("DOM analysis error:", error);
      res.status(500).json({ error: "Failed to analyze DOM" });
    }
  });

  // Get cached selectors endpoint
  app.get("/api/selectors", (req, res) => {
    const selectors: Record<string, string> = {};
    selectorCache.forEach((value, key) => {
      selectors[key] = value.selector;
    });
    res.json(selectors);
  });

  // Subscriptions endpoints
  app.get("/api/subscriptions", async (req, res) => {
    try {
      const subscriptions = await storage.getSubscriptions();
      res.json(subscriptions);
    } catch (error) {
      res.status(500).json({ error: "Failed to get subscriptions" });
    }
  });

  // Analysis endpoints
  app.get("/api/analysis/latest", async (req, res) => {
    try {
      const analysis = await storage.getLatestAnalysis();
      res.json(analysis);
    } catch (error) {
      res.status(500).json({ error: "Failed to get analysis" });
    }
  });

  app.post("/api/analysis/run", async (req, res) => {
    try {
      const videos = await storage.getVideos();
      const subscriptions = await storage.getSubscriptions();

      if (videos.length === 0) {
        return res.status(400).json({ 
          error: "No videos to analyze. Please collect some data first." 
        });
      }

      // Ensure categories have colors
      const colors = [
        "hsl(203, 88%, 53%)",
        "hsl(160, 100%, 36%)",
        "hsl(42, 93%, 56%)",
        "hsl(147, 78%, 42%)",
        "hsl(341, 75%, 51%)",
        "hsl(262, 83%, 58%)",
      ];

      // Check if OpenAI is available
      const client = getOpenAIClient();
      if (!client) {
        // Fallback: Generate basic analysis without AI
        console.log("OpenAI not available, using fallback analysis");
        
        const channelNames = [...new Set(videos.map(v => v.channelName))];
        const categories = videos.map(v => v.category).filter(Boolean);
        const uniqueCategories = [...new Set(categories)];
        
        const categoriesWithColors: CategoryDistribution[] = uniqueCategories.length > 0 
          ? uniqueCategories.map((cat, i) => ({
              name: cat as string,
              count: categories.filter(c => c === cat).length,
              percentage: Math.round((categories.filter(c => c === cat).length / categories.length) * 100),
              color: colors[i % colors.length],
            }))
          : [
              { name: "News", count: Math.floor(videos.length * 0.3), percentage: 30, color: colors[0] },
              { name: "Entertainment", count: Math.floor(videos.length * 0.25), percentage: 25, color: colors[1] },
              { name: "Education", count: Math.floor(videos.length * 0.2), percentage: 20, color: colors[2] },
              { name: "Technology", count: Math.floor(videos.length * 0.15), percentage: 15, color: colors[3] },
              { name: "Other", count: Math.floor(videos.length * 0.1), percentage: 10, color: colors[4] },
            ];

        const analysis = await storage.createAnalysis({
          biasScore: 50,
          categories: categoriesWithColors,
          topTopics: channelNames.slice(0, 5),
          politicalLeaning: "center",
          summary: `Analyzed ${videos.length} videos from ${channelNames.length} unique channels. Connect to OpenAI for detailed bias analysis.`,
        });

        return res.json(analysis);
      }

      // Prepare video data for analysis
      const videoTitles = videos.slice(0, 50).map(v => `${v.title} - ${v.channelName}`);
      const channelNames = [...new Set(videos.map(v => v.channelName))];
      const categories = videos.map(v => v.category).filter(Boolean);

      const prompt = `Analyze the following YouTube viewing history and provide a bias analysis. 

Videos watched (titles and channels):
${videoTitles.join('\n')}

Channels frequently watched:
${channelNames.slice(0, 20).join(', ')}

Categories found:
${[...new Set(categories)].join(', ')}

Please analyze this data and provide:
1. A bias score from 0-100 (0 = heavily left-leaning, 50 = balanced, 100 = heavily right-leaning)
2. Political leaning classification (one of: left, center-left, center, center-right, right)
3. Top 5 topics/themes detected
4. Category distribution (with percentages)
5. A brief summary of the content consumption patterns

Respond in JSON format:
{
  "biasScore": number,
  "politicalLeaning": string,
  "topTopics": string[],
  "categories": [{"name": string, "count": number, "percentage": number, "color": string}],
  "summary": string
}`;

      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { 
            role: "system", 
            content: "You are an unbiased media analyst. Analyze YouTube viewing patterns to detect potential echo chambers and content bias. Be objective and provide actionable insights."
          },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 1024,
      });

      const analysisText = response.choices[0]?.message?.content || "{}";
      const analysisData = JSON.parse(analysisText);

      const categoriesWithColors: CategoryDistribution[] = (analysisData.categories || []).map(
        (cat: any, i: number) => ({
          ...cat,
          color: colors[i % colors.length],
        })
      );

      const analysis = await storage.createAnalysis({
        biasScore: analysisData.biasScore || 50,
        categories: categoriesWithColors,
        topTopics: analysisData.topTopics || [],
        politicalLeaning: analysisData.politicalLeaning || "center",
        summary: analysisData.summary || "Analysis complete.",
      });

      res.json(analysis);
    } catch (error) {
      console.error("Analysis error:", error);
      res.status(500).json({ error: "Failed to run analysis" });
    }
  });

  // Recommendations endpoints
  app.get("/api/recommendations", async (req, res) => {
    try {
      const recommendations = await storage.getRecommendations();
      res.json(recommendations);
    } catch (error) {
      res.status(500).json({ error: "Failed to get recommendations" });
    }
  });

  app.post("/api/recommendations/generate", async (req, res) => {
    try {
      const analysis = await storage.getLatestAnalysis();
      const videos = await storage.getVideos();

      if (!analysis) {
        return res.status(400).json({ 
          error: "No analysis available. Please run an analysis first." 
        });
      }

      // Check if OpenAI is available
      const client = getOpenAIClient();
      if (!client) {
        // Fallback: Generate recommendations based on actual video data
        console.log("OpenAI not available, using fallback recommendations based on collected data");
        
        const channelNames = [...new Set(videos.map(v => v.channelName))];
        const topTopics = analysis.topTopics || channelNames.slice(0, 5);
        
        // Generate 6 balanced recommendations based on analysis
        const fallbackRecs: InsertRecommendation[] = [
          {
            videoId: `rec_${Date.now()}_0`,
            title: `Alternative Views on ${topTopics[0] || 'Current Events'}`,
            channelName: "Balanced Perspectives",
            thumbnailUrl: null,
            reason: `Explore different perspectives on ${topTopics[0] || 'topics'} you've been watching`,
            category: "News & Politics",
            opposingViewpoint: "Counter-narrative perspective",
            watched: false,
          },
          {
            videoId: `rec_${Date.now()}_1`,
            title: `Understanding Both Sides: ${topTopics[1] || 'Media Literacy'}`,
            channelName: "Critical Thinking Channel",
            thumbnailUrl: null,
            reason: "Develop skills to evaluate content from multiple angles",
            category: "Education",
            opposingViewpoint: "Analytical approach",
            watched: false,
          },
          {
            videoId: `rec_${Date.now()}_2`,
            title: `International Perspectives on ${topTopics[2] || 'Global Issues'}`,
            channelName: "World Views Network",
            thumbnailUrl: null,
            reason: "See how different cultures approach similar topics",
            category: "Documentary",
            opposingViewpoint: "Global viewpoint",
            watched: false,
          },
          {
            videoId: `rec_${Date.now()}_3`,
            title: `Expert Analysis: ${topTopics[3] || 'Deep Dive'}`,
            channelName: "Academic Insights",
            thumbnailUrl: null,
            reason: "Get expert analysis beyond mainstream coverage",
            category: "Education",
            opposingViewpoint: "Academic perspective",
            watched: false,
          },
          {
            videoId: `rec_${Date.now()}_4`,
            title: `The Other Side: ${topTopics[4] || 'Challenging Assumptions'}`,
            channelName: "Debate Forum",
            thumbnailUrl: null,
            reason: "Challenge your current viewpoint with opposing arguments",
            category: "News & Politics",
            opposingViewpoint: "Opposing viewpoint",
            watched: false,
          },
          {
            videoId: `rec_${Date.now()}_5`,
            title: "Building Bridges: Finding Common Ground",
            channelName: "Unity Media",
            thumbnailUrl: null,
            reason: "Discover shared values across different perspectives",
            category: "Society",
            opposingViewpoint: "Centrist perspective",
            watched: false,
          },
        ];
        
        // Add recommendations without deleting existing ones
        const created = await storage.createRecommendations(fallbackRecs);
        return res.json(created);
      }

      const watchedChannels = [...new Set(videos.map(v => v.channelName))];
      const topTopics = analysis.topTopics || [];

      const prompt = `Based on this YouTube viewing pattern analysis, suggest 6 diverse videos that would help break the echo chamber.

Current bias score: ${analysis.biasScore} (0=left, 50=balanced, 100=right)
Political leaning: ${analysis.politicalLeaning}
Top topics: ${topTopics.join(', ')}
Frequently watched channels: ${watchedChannels.slice(0, 10).join(', ')}
Summary: ${analysis.summary}

Please suggest 6 real YouTube videos that:
1. Offer different perspectives from the user's current consumption
2. Are from reputable channels
3. Cover similar topics but from different viewpoints
4. Help balance the bias score toward 50

For each video, provide:
- A realistic video title
- Channel name
- Category
- Brief reason why it's recommended
- The opposing viewpoint it represents

Respond in JSON format:
{
  "recommendations": [
    {
      "videoId": "placeholder_id",
      "title": string,
      "channelName": string,
      "category": string,
      "reason": string,
      "opposingViewpoint": string
    }
  ]
}`;

      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { 
            role: "system", 
            content: "You are a media diversity consultant. Suggest videos that help users escape echo chambers by exposing them to diverse, reputable perspectives. Focus on quality journalism and thoughtful content from various viewpoints."
          },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 1024,
      });

      const recText = response.choices[0]?.message?.content || '{"recommendations":[]}';
      const recData = JSON.parse(recText);

      // Add new AI-generated recommendations (preserving existing ones)
      const recommendations: InsertRecommendation[] = (recData.recommendations || []).map(
        (rec: any, i: number) => ({
          videoId: rec.videoId || `rec_${Date.now()}_${i}`,
          title: rec.title || "Recommended Video",
          channelName: rec.channelName || "Unknown Channel",
          thumbnailUrl: null, // Will use default YouTube thumbnail
          reason: rec.reason || "Recommended for balance",
          category: rec.category || null,
          opposingViewpoint: rec.opposingViewpoint || null,
          watched: false,
        })
      );

      const created = await storage.createRecommendations(recommendations);
      res.json(created);
    } catch (error) {
      console.error("Recommendation error:", error);
      res.status(500).json({ error: "Failed to generate recommendations" });
    }
  });

  app.patch("/api/recommendations/:id/watched", async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await storage.updateRecommendation(id, { watched: true });
      if (!updated) {
        return res.status(404).json({ error: "Recommendation not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update recommendation" });
    }
  });

  // Snapshots endpoints
  app.get("/api/snapshots", async (req, res) => {
    try {
      const snapshots = await storage.getSnapshots();
      res.json(snapshots);
    } catch (error) {
      res.status(500).json({ error: "Failed to get snapshots" });
    }
  });

  app.post("/api/snapshots", async (req, res) => {
    try {
      const { name, description } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: "Name is required" });
      }

      // Get current recommended videos from YouTube (simulated with stored videos)
      const videos = await storage.getVideos();
      const videoIds = videos.slice(0, 20).map(v => v.videoId);
      const thumbnails = videos.slice(0, 4).map(v => 
        v.thumbnailUrl || `https://img.youtube.com/vi/${v.videoId}/mqdefault.jpg`
      );

      const snapshot = await storage.createSnapshot({
        name,
        description: description || null,
        videoIds,
        thumbnails,
        isActive: false,
      });

      res.json(snapshot);
    } catch (error) {
      res.status(500).json({ error: "Failed to create snapshot" });
    }
  });

  app.post("/api/snapshots/:id/activate", async (req, res) => {
    try {
      const { id } = req.params;
      const snapshot = await storage.getSnapshot(id);
      
      if (!snapshot) {
        return res.status(404).json({ error: "Snapshot not found" });
      }

      // Deactivate all other snapshots
      const allSnapshots = await storage.getSnapshots();
      for (const s of allSnapshots) {
        if (s.isActive) {
          await storage.updateSnapshot(s.id, { isActive: false });
        }
      }

      // Activate this snapshot
      await storage.updateSnapshot(id, { isActive: true });

      // Add snapshot videos to background playlist
      const videos = await storage.getVideos();
      const snapshotVideos = videos.filter(v => snapshot.videoIds?.includes(v.videoId));
      
      for (const video of snapshotVideos) {
        await storage.createPlaylistItem({
          snapshotId: id,
          videoId: video.videoId,
          title: video.title,
          channelName: video.channelName,
          thumbnailUrl: video.thumbnailUrl,
          status: "pending",
          playCount: 0,
        });
      }

      res.json({ success: true, message: "Snapshot activated" });
    } catch (error) {
      res.status(500).json({ error: "Failed to activate snapshot" });
    }
  });

  app.delete("/api/snapshots/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteSnapshot(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete snapshot" });
    }
  });

  // Playlist endpoints
  app.get("/api/playlist", async (req, res) => {
    try {
      const items = await storage.getPlaylistItems();
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to get playlist" });
    }
  });

  app.post("/api/playlist/:id/play", async (req, res) => {
    try {
      const { id } = req.params;
      const item = await storage.getPlaylistItem(id);
      
      if (!item) {
        return res.status(404).json({ error: "Playlist item not found" });
      }

      const newStatus = item.status === "playing" ? "pending" : "playing";
      const updated = await storage.updatePlaylistItem(id, { 
        status: newStatus,
        playCount: newStatus === "playing" ? (item.playCount || 0) + 1 : item.playCount
      });
      
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update playlist item" });
    }
  });

  app.delete("/api/playlist/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deletePlaylistItem(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete playlist item" });
    }
  });

  app.delete("/api/playlist/bulk", async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids)) {
        return res.status(400).json({ error: "Invalid ids" });
      }
      await storage.deletePlaylistItems(ids);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete playlist items" });
    }
  });

  // Data management endpoints
  app.get("/api/data/export", async (req, res) => {
    try {
      const data = await storage.exportAllData();
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=echobreaker-export.json');
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to export data" });
    }
  });

  app.delete("/api/data/all", async (req, res) => {
    try {
      await storage.deleteAllData();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete data" });
    }
  });

  return httpServer;
}
