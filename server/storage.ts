import { 
  type User, type InsertUser,
  type Video, type InsertVideo,
  type Subscription, type InsertSubscription,
  type Snapshot, type InsertSnapshot,
  type AnalysisResult, type InsertAnalysis,
  type Recommendation, type InsertRecommendation,
  type PlaylistItem, type InsertPlaylistItem,
  type VideoInsight, type InsertVideoInsight,
  type DashboardStats,
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Videos
  getVideos(): Promise<Video[]>;
  getVideo(id: string): Promise<Video | undefined>;
  createVideo(video: InsertVideo): Promise<Video>;
  createVideos(videos: InsertVideo[]): Promise<Video[]>;
  deleteAllVideos(): Promise<void>;

  // Subscriptions
  getSubscriptions(): Promise<Subscription[]>;
  createSubscription(sub: InsertSubscription): Promise<Subscription>;
  createSubscriptions(subs: InsertSubscription[]): Promise<Subscription[]>;
  deleteAllSubscriptions(): Promise<void>;

  // Snapshots
  getSnapshots(): Promise<Snapshot[]>;
  getSnapshot(id: string): Promise<Snapshot | undefined>;
  createSnapshot(snapshot: InsertSnapshot): Promise<Snapshot>;
  updateSnapshot(id: string, data: Partial<Snapshot>): Promise<Snapshot | undefined>;
  deleteSnapshot(id: string): Promise<void>;
  deleteAllSnapshots(): Promise<void>;

  // Analysis
  getLatestAnalysis(): Promise<AnalysisResult | null>;
  createAnalysis(analysis: InsertAnalysis): Promise<AnalysisResult>;
  deleteAllAnalysis(): Promise<void>;

  // Recommendations
  getRecommendations(): Promise<Recommendation[]>;
  getRecommendation(id: string): Promise<Recommendation | undefined>;
  createRecommendation(rec: InsertRecommendation): Promise<Recommendation>;
  createRecommendations(recs: InsertRecommendation[]): Promise<Recommendation[]>;
  updateRecommendation(id: string, data: Partial<Recommendation>): Promise<Recommendation | undefined>;
  deleteAllRecommendations(): Promise<void>;

  // Playlist
  getPlaylistItems(): Promise<PlaylistItem[]>;
  getPlaylistItem(id: string): Promise<PlaylistItem | undefined>;
  createPlaylistItem(item: InsertPlaylistItem): Promise<PlaylistItem>;
  createPlaylistItems(items: InsertPlaylistItem[]): Promise<PlaylistItem[]>;
  updatePlaylistItem(id: string, data: Partial<PlaylistItem>): Promise<PlaylistItem | undefined>;
  deletePlaylistItem(id: string): Promise<void>;
  deletePlaylistItems(ids: string[]): Promise<void>;
  deleteAllPlaylistItems(): Promise<void>;

  // Video Insights
  getVideoInsights(): Promise<VideoInsight[]>;
  getVideoInsight(videoId: string): Promise<VideoInsight | undefined>;
  createVideoInsight(insight: InsertVideoInsight): Promise<VideoInsight>;
  createVideoInsights(insights: InsertVideoInsight[]): Promise<VideoInsight[]>;
  deleteAllVideoInsights(): Promise<void>;

  // Stats
  getStats(): Promise<DashboardStats>;

  // Data export
  exportAllData(): Promise<object>;
  deleteAllData(): Promise<void>;
}

function generateId(): string {
  return crypto.randomUUID();
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private videos: Map<string, Video> = new Map();
  private subscriptions: Map<string, Subscription> = new Map();
  private snapshots: Map<string, Snapshot> = new Map();
  private analysisResults: AnalysisResult[] = [];
  private recommendations: Map<string, Recommendation> = new Map();
  private playlistItems: Map<string, PlaylistItem> = new Map();
  private videoInsights: Map<string, VideoInsight> = new Map();

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const user: User = {
      id: generateId(),
      username: insertUser.username,
      password: insertUser.password,
    };
    this.users.set(user.id, user);
    return user;
  }

  // Videos
  async getVideos(): Promise<Video[]> {
    return Array.from(this.videos.values())
      .sort((a, b) => new Date(b.collectedAt!).getTime() - new Date(a.collectedAt!).getTime());
  }

  async getVideo(id: string): Promise<Video | undefined> {
    return this.videos.get(id);
  }

  async createVideo(video: InsertVideo): Promise<Video> {
    const existing = Array.from(this.videos.values()).find(v => v.videoId === video.videoId);
    
    if (existing) {
      const newSignificance = video.significanceWeight ?? 50;
      const existingSignificance = existing.significanceWeight ?? 50;
      
      if (newSignificance > existingSignificance) {
        const updated: Video = {
          ...existing,
          sourcePhase: (video.sourcePhase || existing.sourcePhase) as any,
          significanceWeight: newSignificance,
          collectedAt: new Date(),
        };
        this.videos.set(existing.id, updated);
        return updated;
      }
      return existing;
    }
    
    const newVideo: Video = {
      id: generateId(),
      videoId: video.videoId,
      title: video.title,
      channelName: video.channelName,
      channelId: video.channelId || null,
      thumbnailUrl: video.thumbnailUrl || null,
      viewCount: video.viewCount || null,
      duration: video.duration || null,
      category: video.category || null,
      tags: video.tags || null,
      sourcePhase: (video.sourcePhase || 'home_feed') as any,
      significanceWeight: video.significanceWeight ?? 50,
      collectedAt: new Date(),
    };
    this.videos.set(newVideo.id, newVideo);
    return newVideo;
  }

  async createVideos(videosToCreate: InsertVideo[]): Promise<Video[]> {
    const results: Video[] = [];
    for (const v of videosToCreate) {
      const result = await this.createVideo(v);
      results.push(result);
    }
    return results;
  }

  async deleteAllVideos(): Promise<void> {
    this.videos.clear();
  }

  // Subscriptions
  async getSubscriptions(): Promise<Subscription[]> {
    return Array.from(this.subscriptions.values())
      .sort((a, b) => new Date(b.collectedAt!).getTime() - new Date(a.collectedAt!).getTime());
  }

  async createSubscription(sub: InsertSubscription): Promise<Subscription> {
    const existing = Array.from(this.subscriptions.values()).find(s => s.channelId === sub.channelId);
    if (existing) {
      return existing;
    }
    
    const newSub: Subscription = {
      id: generateId(),
      channelId: sub.channelId,
      channelName: sub.channelName,
      thumbnailUrl: sub.thumbnailUrl || null,
      subscriberCount: sub.subscriberCount || null,
      videoCount: sub.videoCount || null,
      collectedAt: new Date(),
    };
    this.subscriptions.set(newSub.id, newSub);
    return newSub;
  }

  async createSubscriptions(subs: InsertSubscription[]): Promise<Subscription[]> {
    const results: Subscription[] = [];
    for (const s of subs) {
      const result = await this.createSubscription(s);
      results.push(result);
    }
    return results;
  }

  async deleteAllSubscriptions(): Promise<void> {
    this.subscriptions.clear();
  }

  // Snapshots
  async getSnapshots(): Promise<Snapshot[]> {
    return Array.from(this.snapshots.values())
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  async getSnapshot(id: string): Promise<Snapshot | undefined> {
    return this.snapshots.get(id);
  }

  async createSnapshot(snapshot: InsertSnapshot): Promise<Snapshot> {
    const newSnapshot: Snapshot = {
      id: generateId(),
      name: snapshot.name,
      description: snapshot.description || null,
      videoIds: snapshot.videoIds || null,
      thumbnails: snapshot.thumbnails || null,
      isActive: snapshot.isActive ?? false,
      createdAt: new Date(),
    };
    this.snapshots.set(newSnapshot.id, newSnapshot);
    return newSnapshot;
  }

  async updateSnapshot(id: string, data: Partial<Snapshot>): Promise<Snapshot | undefined> {
    const existing = this.snapshots.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...data };
    this.snapshots.set(id, updated);
    return updated;
  }

  async deleteSnapshot(id: string): Promise<void> {
    this.snapshots.delete(id);
  }

  async deleteAllSnapshots(): Promise<void> {
    this.snapshots.clear();
  }

  // Analysis
  async getLatestAnalysis(): Promise<AnalysisResult | null> {
    if (this.analysisResults.length === 0) return null;
    return this.analysisResults[this.analysisResults.length - 1];
  }

  async createAnalysis(analysis: InsertAnalysis): Promise<AnalysisResult> {
    const newAnalysis: AnalysisResult = {
      id: generateId(),
      biasScore: analysis.biasScore,
      categories: (analysis.categories as any) || null,
      topTopics: analysis.topTopics || null,
      politicalLeaning: analysis.politicalLeaning || null,
      summary: analysis.summary || null,
      entropyScore: analysis.entropyScore || null,
      stanceBreakdown: analysis.stanceBreakdown || null,
      sourceComparisons: analysis.sourceComparisons || null,
      politicalVideoCount: analysis.politicalVideoCount ?? 0,
      analyzedAt: new Date(),
    };
    this.analysisResults.push(newAnalysis);
    return newAnalysis;
  }

  async deleteAllAnalysis(): Promise<void> {
    this.analysisResults = [];
  }

  // Recommendations
  async getRecommendations(): Promise<Recommendation[]> {
    return Array.from(this.recommendations.values())
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  async getRecommendation(id: string): Promise<Recommendation | undefined> {
    return this.recommendations.get(id);
  }

  async createRecommendation(rec: InsertRecommendation): Promise<Recommendation> {
    const newRec: Recommendation = {
      id: generateId(),
      videoId: rec.videoId,
      title: rec.title,
      channelName: rec.channelName,
      thumbnailUrl: rec.thumbnailUrl || null,
      reason: rec.reason || null,
      category: rec.category || null,
      opposingViewpoint: rec.opposingViewpoint || null,
      watched: rec.watched ?? false,
      createdAt: new Date(),
    };
    this.recommendations.set(newRec.id, newRec);
    return newRec;
  }

  async createRecommendations(recs: InsertRecommendation[]): Promise<Recommendation[]> {
    const results: Recommendation[] = [];
    for (const r of recs) {
      const result = await this.createRecommendation(r);
      results.push(result);
    }
    return results;
  }

  async updateRecommendation(id: string, data: Partial<Recommendation>): Promise<Recommendation | undefined> {
    const existing = this.recommendations.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...data };
    this.recommendations.set(id, updated);
    return updated;
  }

  async deleteAllRecommendations(): Promise<void> {
    this.recommendations.clear();
  }

  // Playlist
  async getPlaylistItems(): Promise<PlaylistItem[]> {
    return Array.from(this.playlistItems.values())
      .sort((a, b) => new Date(a.addedAt!).getTime() - new Date(b.addedAt!).getTime());
  }

  async getPlaylistItem(id: string): Promise<PlaylistItem | undefined> {
    return this.playlistItems.get(id);
  }

  async createPlaylistItem(item: InsertPlaylistItem): Promise<PlaylistItem> {
    const newItem: PlaylistItem = {
      id: generateId(),
      videoId: item.videoId,
      title: item.title,
      channelName: item.channelName,
      thumbnailUrl: item.thumbnailUrl || null,
      snapshotId: item.snapshotId || null,
      status: item.status || 'pending',
      playCount: item.playCount ?? 0,
      addedAt: new Date(),
    };
    this.playlistItems.set(newItem.id, newItem);
    return newItem;
  }

  async createPlaylistItems(items: InsertPlaylistItem[]): Promise<PlaylistItem[]> {
    const results: PlaylistItem[] = [];
    for (const item of items) {
      const result = await this.createPlaylistItem(item);
      results.push(result);
    }
    return results;
  }

  async updatePlaylistItem(id: string, data: Partial<PlaylistItem>): Promise<PlaylistItem | undefined> {
    const existing = this.playlistItems.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...data };
    this.playlistItems.set(id, updated);
    return updated;
  }

  async deletePlaylistItem(id: string): Promise<void> {
    this.playlistItems.delete(id);
  }

  async deletePlaylistItems(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.playlistItems.delete(id);
    }
  }

  async deleteAllPlaylistItems(): Promise<void> {
    this.playlistItems.clear();
  }

  // Video Insights
  async getVideoInsights(): Promise<VideoInsight[]> {
    return Array.from(this.videoInsights.values());
  }

  async getVideoInsight(videoId: string): Promise<VideoInsight | undefined> {
    return Array.from(this.videoInsights.values()).find(i => i.videoId === videoId);
  }

  async createVideoInsight(insight: InsertVideoInsight): Promise<VideoInsight> {
    const existing = Array.from(this.videoInsights.values()).find(i => i.videoId === insight.videoId);
    if (existing) {
      const updated: VideoInsight = {
        ...existing,
        contentType: insight.contentType || existing.contentType,
        stance: insight.stance || existing.stance,
        stanceProbabilities: insight.stanceProbabilities || existing.stanceProbabilities,
        isPolitical: insight.isPolitical ?? existing.isPolitical,
        topics: insight.topics || existing.topics,
        sentiment: insight.sentiment || existing.sentiment,
        geminiModel: insight.geminiModel || existing.geminiModel,
        transcriptUsed: insight.transcriptUsed ?? existing.transcriptUsed,
        analyzedAt: new Date(),
      };
      this.videoInsights.set(existing.id, updated);
      return updated;
    }
    
    const newInsight: VideoInsight = {
      id: generateId(),
      videoId: insight.videoId,
      contentType: insight.contentType || null,
      stance: insight.stance || null,
      stanceProbabilities: insight.stanceProbabilities || null,
      isPolitical: insight.isPolitical ?? false,
      topics: insight.topics || null,
      sentiment: insight.sentiment || null,
      geminiModel: insight.geminiModel || null,
      transcriptUsed: insight.transcriptUsed ?? false,
      analyzedAt: new Date(),
    };
    this.videoInsights.set(newInsight.id, newInsight);
    return newInsight;
  }

  async createVideoInsights(insights: InsertVideoInsight[]): Promise<VideoInsight[]> {
    const results: VideoInsight[] = [];
    for (const insight of insights) {
      const result = await this.createVideoInsight(insight);
      results.push(result);
    }
    return results;
  }

  async deleteAllVideoInsights(): Promise<void> {
    this.videoInsights.clear();
  }

  // Stats
  async getStats(): Promise<DashboardStats> {
    const latestAnalysis = await this.getLatestAnalysis();
    
    return {
      totalVideosAnalyzed: this.videos.size,
      biasScore: latestAnalysis?.biasScore ?? 50,
      recommendationsGiven: this.recommendations.size,
      snapshotsSaved: this.snapshots.size,
    };
  }

  // Data export
  async exportAllData(): Promise<object> {
    return {
      videos: await this.getVideos(),
      subscriptions: await this.getSubscriptions(),
      snapshots: await this.getSnapshots(),
      analysis: this.analysisResults,
      recommendations: await this.getRecommendations(),
      playlist: await this.getPlaylistItems(),
      videoInsights: await this.getVideoInsights(),
      exportedAt: new Date().toISOString(),
    };
  }

  async deleteAllData(): Promise<void> {
    await Promise.all([
      this.deleteAllVideos(),
      this.deleteAllSubscriptions(),
      this.deleteAllSnapshots(),
      this.deleteAllAnalysis(),
      this.deleteAllRecommendations(),
      this.deleteAllPlaylistItems(),
      this.deleteAllVideoInsights()
    ]);
  }
}

export const storage = new MemStorage();
