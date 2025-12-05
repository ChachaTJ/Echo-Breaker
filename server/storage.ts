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
  videos,
  subscriptions,
  snapshots,
  analysisResults,
  recommendations,
  backgroundPlaylist,
  videoInsights,
  users
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, inArray } from "drizzle-orm";

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

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Videos
  async getVideos(): Promise<Video[]> {
    return await db.select().from(videos).orderBy(desc(videos.collectedAt));
  }

  async getVideo(id: string): Promise<Video | undefined> {
    const [video] = await db.select().from(videos).where(eq(videos.id, id));
    return video || undefined;
  }

  async createVideo(video: InsertVideo): Promise<Video> {
    // Check for duplicate by videoId
    const [existing] = await db.select().from(videos).where(eq(videos.videoId, video.videoId));
    
    if (existing) {
      const newSignificance = video.significanceWeight ?? 50;
      const existingSignificance = existing.significanceWeight ?? 50;
      
      if (newSignificance > existingSignificance) {
        const [updated] = await db
          .update(videos)
          .set({
            sourcePhase: (video.sourcePhase || existing.sourcePhase) as any,
            significanceWeight: newSignificance,
            collectedAt: new Date(),
          })
          .where(eq(videos.id, existing.id))
          .returning();
        return updated;
      }
      return existing;
    }
    
    const [newVideo] = await db.insert(videos).values(video as any).returning();
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
    await db.delete(videos);
  }

  // Subscriptions
  async getSubscriptions(): Promise<Subscription[]> {
    return await db.select().from(subscriptions).orderBy(desc(subscriptions.collectedAt));
  }

  async createSubscription(sub: InsertSubscription): Promise<Subscription> {
    // Check for duplicate by channelId
    const [existing] = await db.select().from(subscriptions).where(eq(subscriptions.channelId, sub.channelId));
    if (existing) {
      return existing;
    }
    const [newSub] = await db.insert(subscriptions).values(sub).returning();
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
    await db.delete(subscriptions);
  }

  // Snapshots
  async getSnapshots(): Promise<Snapshot[]> {
    return await db.select().from(snapshots).orderBy(desc(snapshots.createdAt));
  }

  async getSnapshot(id: string): Promise<Snapshot | undefined> {
    const [snapshot] = await db.select().from(snapshots).where(eq(snapshots.id, id));
    return snapshot || undefined;
  }

  async createSnapshot(snapshot: InsertSnapshot): Promise<Snapshot> {
    const [newSnapshot] = await db.insert(snapshots).values(snapshot).returning();
    return newSnapshot;
  }

  async updateSnapshot(id: string, data: Partial<Snapshot>): Promise<Snapshot | undefined> {
    const [updated] = await db
      .update(snapshots)
      .set(data)
      .where(eq(snapshots.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteSnapshot(id: string): Promise<void> {
    await db.delete(snapshots).where(eq(snapshots.id, id));
  }

  async deleteAllSnapshots(): Promise<void> {
    await db.delete(snapshots);
  }

  // Analysis
  async getLatestAnalysis(): Promise<AnalysisResult | null> {
    const [latest] = await db
      .select()
      .from(analysisResults)
      .orderBy(desc(analysisResults.analyzedAt))
      .limit(1);
    return latest || null;
  }

  async createAnalysis(analysis: InsertAnalysis): Promise<AnalysisResult> {
    const [newAnalysis] = await db.insert(analysisResults).values(analysis as any).returning();
    return newAnalysis;
  }

  async deleteAllAnalysis(): Promise<void> {
    await db.delete(analysisResults);
  }

  // Recommendations
  async getRecommendations(): Promise<Recommendation[]> {
    return await db.select().from(recommendations).orderBy(desc(recommendations.createdAt));
  }

  async getRecommendation(id: string): Promise<Recommendation | undefined> {
    const [rec] = await db.select().from(recommendations).where(eq(recommendations.id, id));
    return rec || undefined;
  }

  async createRecommendation(rec: InsertRecommendation): Promise<Recommendation> {
    const [newRec] = await db.insert(recommendations).values(rec).returning();
    return newRec;
  }

  async createRecommendations(recs: InsertRecommendation[]): Promise<Recommendation[]> {
    if (recs.length === 0) return [];
    return await db.insert(recommendations).values(recs).returning();
  }

  async updateRecommendation(id: string, data: Partial<Recommendation>): Promise<Recommendation | undefined> {
    const [updated] = await db
      .update(recommendations)
      .set(data)
      .where(eq(recommendations.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteAllRecommendations(): Promise<void> {
    await db.delete(recommendations);
  }

  // Playlist
  async getPlaylistItems(): Promise<PlaylistItem[]> {
    return await db.select().from(backgroundPlaylist).orderBy(backgroundPlaylist.addedAt);
  }

  async getPlaylistItem(id: string): Promise<PlaylistItem | undefined> {
    const [item] = await db.select().from(backgroundPlaylist).where(eq(backgroundPlaylist.id, id));
    return item || undefined;
  }

  async createPlaylistItem(item: InsertPlaylistItem): Promise<PlaylistItem> {
    const [newItem] = await db.insert(backgroundPlaylist).values(item).returning();
    return newItem;
  }

  async createPlaylistItems(items: InsertPlaylistItem[]): Promise<PlaylistItem[]> {
    if (items.length === 0) return [];
    return await db.insert(backgroundPlaylist).values(items).returning();
  }

  async updatePlaylistItem(id: string, data: Partial<PlaylistItem>): Promise<PlaylistItem | undefined> {
    const [updated] = await db
      .update(backgroundPlaylist)
      .set(data)
      .where(eq(backgroundPlaylist.id, id))
      .returning();
    return updated || undefined;
  }

  async deletePlaylistItem(id: string): Promise<void> {
    await db.delete(backgroundPlaylist).where(eq(backgroundPlaylist.id, id));
  }

  async deletePlaylistItems(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await db.delete(backgroundPlaylist).where(inArray(backgroundPlaylist.id, ids));
  }

  async deleteAllPlaylistItems(): Promise<void> {
    await db.delete(backgroundPlaylist);
  }

  // Video Insights
  async getVideoInsights(): Promise<VideoInsight[]> {
    return await db.select().from(videoInsights).orderBy(desc(videoInsights.analyzedAt));
  }

  async getVideoInsight(videoId: string): Promise<VideoInsight | undefined> {
    const [insight] = await db.select().from(videoInsights).where(eq(videoInsights.videoId, videoId));
    return insight || undefined;
  }

  async createVideoInsight(insight: InsertVideoInsight): Promise<VideoInsight> {
    // Check for existing insight for this videoId
    const [existing] = await db.select().from(videoInsights).where(eq(videoInsights.videoId, insight.videoId));
    if (existing) {
      const [updated] = await db
        .update(videoInsights)
        .set({ ...insight, analyzedAt: new Date() })
        .where(eq(videoInsights.videoId, insight.videoId))
        .returning();
      return updated;
    }
    const [newInsight] = await db.insert(videoInsights).values(insight).returning();
    return newInsight;
  }

  async createVideoInsights(insights: InsertVideoInsight[]): Promise<VideoInsight[]> {
    const results: VideoInsight[] = [];
    for (const i of insights) {
      const result = await this.createVideoInsight(i);
      results.push(result);
    }
    return results;
  }

  async deleteAllVideoInsights(): Promise<void> {
    await db.delete(videoInsights);
  }

  // Stats
  async getStats(): Promise<DashboardStats> {
    const latestAnalysis = await this.getLatestAnalysis();
    
    const [videoCount] = await db.select({ count: sql<number>`count(*)` }).from(videos);
    const [recCount] = await db.select({ count: sql<number>`count(*)` }).from(recommendations);
    const [snapCount] = await db.select({ count: sql<number>`count(*)` }).from(snapshots);
    
    return {
      totalVideosAnalyzed: Number(videoCount?.count ?? 0),
      biasScore: latestAnalysis?.biasScore ?? 50,
      recommendationsGiven: Number(recCount?.count ?? 0),
      snapshotsSaved: Number(snapCount?.count ?? 0),
    };
  }

  // Data export
  async exportAllData(): Promise<object> {
    const [
      allVideos,
      allSubs,
      allSnapshots,
      allAnalysis,
      allRecs,
      allPlaylist,
      allInsights
    ] = await Promise.all([
      this.getVideos(),
      this.getSubscriptions(),
      this.getSnapshots(),
      db.select().from(analysisResults),
      this.getRecommendations(),
      this.getPlaylistItems(),
      this.getVideoInsights()
    ]);

    return {
      videos: allVideos,
      subscriptions: allSubs,
      snapshots: allSnapshots,
      analysis: allAnalysis,
      recommendations: allRecs,
      playlist: allPlaylist,
      videoInsights: allInsights,
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

export const storage = new DatabaseStorage();
