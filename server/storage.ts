import { 
  type User, type InsertUser,
  type Video, type InsertVideo,
  type Subscription, type InsertSubscription,
  type Snapshot, type InsertSnapshot,
  type AnalysisResult, type InsertAnalysis,
  type Recommendation, type InsertRecommendation,
  type PlaylistItem, type InsertPlaylistItem,
  type VideoInsight, type InsertVideoInsight,
  type DashboardStats
} from "@shared/schema";
import { randomUUID } from "crypto";

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

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private videos: Map<string, Video>;
  private subscriptions: Map<string, Subscription>;
  private snapshots: Map<string, Snapshot>;
  private analysisResults: AnalysisResult[];
  private recommendations: Map<string, Recommendation>;
  private playlistItems: Map<string, PlaylistItem>;
  private videoInsights: Map<string, VideoInsight>;

  constructor() {
    this.users = new Map();
    this.videos = new Map();
    this.subscriptions = new Map();
    this.snapshots = new Map();
    this.analysisResults = [];
    this.recommendations = new Map();
    this.playlistItems = new Map();
    this.videoInsights = new Map();
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Videos
  async getVideos(): Promise<Video[]> {
    return Array.from(this.videos.values()).sort((a, b) => 
      new Date(b.collectedAt || 0).getTime() - new Date(a.collectedAt || 0).getTime()
    );
  }

  async getVideo(id: string): Promise<Video | undefined> {
    return this.videos.get(id);
  }

  async createVideo(video: InsertVideo): Promise<Video> {
    const id = randomUUID();
    const newVideo: Video = { 
      ...video, 
      id, 
      collectedAt: new Date(),
      channelId: video.channelId || null,
      thumbnailUrl: video.thumbnailUrl || null,
      viewCount: video.viewCount || null,
      duration: video.duration || null,
      category: video.category || null,
      tags: video.tags || null,
      sourcePhase: (video.sourcePhase || 'home_feed') as Video['sourcePhase'],
      significanceWeight: video.significanceWeight ?? 50,
    };
    this.videos.set(id, newVideo);
    return newVideo;
  }

  async createVideos(videos: InsertVideo[]): Promise<Video[]> {
    return Promise.all(videos.map(v => this.createVideo(v)));
  }

  async deleteAllVideos(): Promise<void> {
    this.videos.clear();
  }

  // Subscriptions
  async getSubscriptions(): Promise<Subscription[]> {
    return Array.from(this.subscriptions.values());
  }

  async createSubscription(sub: InsertSubscription): Promise<Subscription> {
    const id = randomUUID();
    const newSub: Subscription = { 
      ...sub, 
      id, 
      collectedAt: new Date(),
      thumbnailUrl: sub.thumbnailUrl || null,
      subscriberCount: sub.subscriberCount || null,
      videoCount: sub.videoCount || null,
    };
    this.subscriptions.set(id, newSub);
    return newSub;
  }

  async createSubscriptions(subs: InsertSubscription[]): Promise<Subscription[]> {
    return Promise.all(subs.map(s => this.createSubscription(s)));
  }

  async deleteAllSubscriptions(): Promise<void> {
    this.subscriptions.clear();
  }

  // Snapshots
  async getSnapshots(): Promise<Snapshot[]> {
    return Array.from(this.snapshots.values()).sort((a, b) => 
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
  }

  async getSnapshot(id: string): Promise<Snapshot | undefined> {
    return this.snapshots.get(id);
  }

  async createSnapshot(snapshot: InsertSnapshot): Promise<Snapshot> {
    const id = randomUUID();
    const newSnapshot: Snapshot = { 
      ...snapshot, 
      id, 
      createdAt: new Date(),
      description: snapshot.description || null,
      videoIds: snapshot.videoIds || null,
      thumbnails: snapshot.thumbnails || null,
      isActive: snapshot.isActive ?? false,
    };
    this.snapshots.set(id, newSnapshot);
    return newSnapshot;
  }

  async updateSnapshot(id: string, data: Partial<Snapshot>): Promise<Snapshot | undefined> {
    const snapshot = this.snapshots.get(id);
    if (!snapshot) return undefined;
    const updated = { ...snapshot, ...data };
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
    const id = randomUUID();
    const newAnalysis: AnalysisResult = { 
      ...analysis, 
      id, 
      analyzedAt: new Date(),
      categories: (analysis.categories || null) as AnalysisResult['categories'],
      topTopics: analysis.topTopics || null,
      politicalLeaning: analysis.politicalLeaning || null,
      summary: analysis.summary || null,
      entropyScore: analysis.entropyScore ?? null,
      stanceBreakdown: analysis.stanceBreakdown || null,
      sourceComparisons: analysis.sourceComparisons || null,
      politicalVideoCount: analysis.politicalVideoCount ?? 0,
    };
    this.analysisResults.push(newAnalysis);
    return newAnalysis;
  }

  async deleteAllAnalysis(): Promise<void> {
    this.analysisResults = [];
  }

  // Recommendations
  async getRecommendations(): Promise<Recommendation[]> {
    return Array.from(this.recommendations.values()).sort((a, b) => 
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
  }

  async getRecommendation(id: string): Promise<Recommendation | undefined> {
    return this.recommendations.get(id);
  }

  async createRecommendation(rec: InsertRecommendation): Promise<Recommendation> {
    const id = randomUUID();
    const newRec: Recommendation = { 
      ...rec, 
      id, 
      createdAt: new Date(),
      thumbnailUrl: rec.thumbnailUrl || null,
      reason: rec.reason || null,
      category: rec.category || null,
      opposingViewpoint: rec.opposingViewpoint || null,
      watched: rec.watched ?? false,
    };
    this.recommendations.set(id, newRec);
    return newRec;
  }

  async createRecommendations(recs: InsertRecommendation[]): Promise<Recommendation[]> {
    return Promise.all(recs.map(r => this.createRecommendation(r)));
  }

  async updateRecommendation(id: string, data: Partial<Recommendation>): Promise<Recommendation | undefined> {
    const rec = this.recommendations.get(id);
    if (!rec) return undefined;
    const updated = { ...rec, ...data };
    this.recommendations.set(id, updated);
    return updated;
  }

  async deleteAllRecommendations(): Promise<void> {
    this.recommendations.clear();
  }

  // Playlist
  async getPlaylistItems(): Promise<PlaylistItem[]> {
    return Array.from(this.playlistItems.values()).sort((a, b) => 
      new Date(a.addedAt || 0).getTime() - new Date(b.addedAt || 0).getTime()
    );
  }

  async getPlaylistItem(id: string): Promise<PlaylistItem | undefined> {
    return this.playlistItems.get(id);
  }

  async createPlaylistItem(item: InsertPlaylistItem): Promise<PlaylistItem> {
    const id = randomUUID();
    const newItem: PlaylistItem = { 
      ...item, 
      id, 
      addedAt: new Date(),
      snapshotId: item.snapshotId || null,
      thumbnailUrl: item.thumbnailUrl || null,
      status: item.status || "pending",
      playCount: item.playCount ?? 0,
    };
    this.playlistItems.set(id, newItem);
    return newItem;
  }

  async createPlaylistItems(items: InsertPlaylistItem[]): Promise<PlaylistItem[]> {
    return Promise.all(items.map(i => this.createPlaylistItem(i)));
  }

  async updatePlaylistItem(id: string, data: Partial<PlaylistItem>): Promise<PlaylistItem | undefined> {
    const item = this.playlistItems.get(id);
    if (!item) return undefined;
    const updated = { ...item, ...data };
    this.playlistItems.set(id, updated);
    return updated;
  }

  async deletePlaylistItem(id: string): Promise<void> {
    this.playlistItems.delete(id);
  }

  async deletePlaylistItems(ids: string[]): Promise<void> {
    ids.forEach(id => this.playlistItems.delete(id));
  }

  async deleteAllPlaylistItems(): Promise<void> {
    this.playlistItems.clear();
  }

  // Video Insights
  async getVideoInsights(): Promise<VideoInsight[]> {
    return Array.from(this.videoInsights.values()).sort((a, b) => 
      new Date(b.analyzedAt || 0).getTime() - new Date(a.analyzedAt || 0).getTime()
    );
  }

  async getVideoInsight(videoId: string): Promise<VideoInsight | undefined> {
    return Array.from(this.videoInsights.values()).find(i => i.videoId === videoId);
  }

  async createVideoInsight(insight: InsertVideoInsight): Promise<VideoInsight> {
    const id = randomUUID();
    const newInsight: VideoInsight = {
      ...insight,
      id,
      analyzedAt: new Date(),
      contentType: insight.contentType || null,
      stance: insight.stance || null,
      stanceProbabilities: insight.stanceProbabilities || null,
      isPolitical: insight.isPolitical ?? false,
      topics: insight.topics || null,
      sentiment: insight.sentiment || null,
      geminiModel: insight.geminiModel || null,
      transcriptUsed: insight.transcriptUsed ?? false,
    };
    this.videoInsights.set(id, newInsight);
    return newInsight;
  }

  async createVideoInsights(insights: InsertVideoInsight[]): Promise<VideoInsight[]> {
    return Promise.all(insights.map(i => this.createVideoInsight(i)));
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
    await this.deleteAllVideos();
    await this.deleteAllSubscriptions();
    await this.deleteAllSnapshots();
    await this.deleteAllAnalysis();
    await this.deleteAllRecommendations();
    await this.deleteAllPlaylistItems();
    await this.deleteAllVideoInsights();
  }
}

export const storage = new MemStorage();
