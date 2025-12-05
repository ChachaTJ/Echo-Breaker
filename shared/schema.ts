import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Video source phase enum - where the video was collected from
export type VideoSourcePhase = 'watch_history' | 'home_feed' | 'search' | 'recommended' | 'subscriptions';

// Video data collected from YouTube
export const videos = pgTable("videos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  videoId: text("video_id").notNull(),
  title: text("title").notNull(),
  channelName: text("channel_name").notNull(),
  channelId: text("channel_id"),
  thumbnailUrl: text("thumbnail_url"),
  viewCount: text("view_count"),
  duration: text("duration"),
  category: text("category"),
  tags: text("tags").array(),
  sourcePhase: text("source_phase").$type<VideoSourcePhase>().default('home_feed'),
  significanceWeight: integer("significance_weight").default(50), // 0-100, watch_history=100, home_feed=50
  collectedAt: timestamp("collected_at").defaultNow(),
});

export const insertVideoSchema = createInsertSchema(videos).omit({ id: true, collectedAt: true });
export type InsertVideo = z.infer<typeof insertVideoSchema>;
export type Video = typeof videos.$inferSelect;

// Subscriptions collected from YouTube
export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  channelId: text("channel_id").notNull(),
  channelName: text("channel_name").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  subscriberCount: text("subscriber_count"),
  videoCount: text("video_count"),
  collectedAt: timestamp("collected_at").defaultNow(),
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({ id: true, collectedAt: true });
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptions.$inferSelect;

// Algorithm snapshots - saved state of YouTube recommendations
export const snapshots = pgTable("snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  videoIds: text("video_ids").array(),
  thumbnails: text("thumbnails").array(),
  createdAt: timestamp("created_at").defaultNow(),
  isActive: boolean("is_active").default(false),
});

export const insertSnapshotSchema = createInsertSchema(snapshots).omit({ id: true, createdAt: true });
export type InsertSnapshot = z.infer<typeof insertSnapshotSchema>;
export type Snapshot = typeof snapshots.$inferSelect;

// Video insights from Gemini AI analysis
export const videoInsights = pgTable("video_insights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  videoId: text("video_id").notNull(),
  contentType: text("content_type"), // political, entertainment, education, news, lifestyle, tech, etc.
  stance: text("stance"), // progressive, conservative, centrist, non-political
  stanceProbabilities: jsonb("stance_probabilities").$type<StanceProbabilities>(),
  isPolitical: boolean("is_political").default(false),
  topics: text("topics").array(),
  sentiment: text("sentiment"), // positive, negative, neutral
  geminiModel: text("gemini_model"),
  transcriptUsed: boolean("transcript_used").default(false),
  analyzedAt: timestamp("analyzed_at").defaultNow(),
});

export const insertVideoInsightSchema = createInsertSchema(videoInsights).omit({ id: true, analyzedAt: true });
export type InsertVideoInsight = z.infer<typeof insertVideoInsightSchema>;
export type VideoInsight = typeof videoInsights.$inferSelect;

// Stance probability distribution
export interface StanceProbabilities {
  progressive: number;
  conservative: number;
  centrist: number;
  nonPolitical: number;
}

// Stance breakdown for analysis
export interface StanceBreakdown {
  progressive: { count: number; percentage: number };
  conservative: { count: number; percentage: number };
  centrist: { count: number; percentage: number };
  nonPolitical: { count: number; percentage: number };
}

// Source comparison metrics
export interface SourceComparison {
  watchHistory: { count: number; entropyScore: number; stanceBreakdown: StanceBreakdown };
  homeFeed: { count: number; entropyScore: number; stanceBreakdown: StanceBreakdown };
}

// Analysis results from AI
export const analysisResults = pgTable("analysis_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  biasScore: integer("bias_score").notNull(), // 0-100, 50 is balanced
  categories: jsonb("categories").$type<CategoryDistribution[]>(),
  topTopics: text("top_topics").array(),
  politicalLeaning: text("political_leaning"), // left, center-left, center, center-right, right
  summary: text("summary"),
  // New entropy-based diversity metrics
  entropyScore: integer("entropy_score"), // 0-100, higher = more diverse viewpoints
  stanceBreakdown: jsonb("stance_breakdown").$type<StanceBreakdown>(),
  sourceComparisons: jsonb("source_comparisons").$type<SourceComparison>(),
  politicalVideoCount: integer("political_video_count").default(0),
  analyzedAt: timestamp("analyzed_at").defaultNow(),
});

export const insertAnalysisSchema = createInsertSchema(analysisResults).omit({ id: true, analyzedAt: true });
export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
export type AnalysisResult = typeof analysisResults.$inferSelect;

// Recommended videos for balance
export const recommendations = pgTable("recommendations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  videoId: text("video_id").notNull(),
  title: text("title").notNull(),
  channelName: text("channel_name").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  reason: text("reason"), // Why this video is recommended
  category: text("category"),
  opposingViewpoint: text("opposing_viewpoint"),
  watched: boolean("watched").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRecommendationSchema = createInsertSchema(recommendations).omit({ id: true, createdAt: true });
export type InsertRecommendation = z.infer<typeof insertRecommendationSchema>;
export type Recommendation = typeof recommendations.$inferSelect;

// Background playlist for algorithm regression
export const backgroundPlaylist = pgTable("background_playlist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  snapshotId: varchar("snapshot_id").references(() => snapshots.id),
  videoId: text("video_id").notNull(),
  title: text("title").notNull(),
  channelName: text("channel_name").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  status: text("status").default("pending"), // pending, playing, completed
  playCount: integer("play_count").default(0),
  addedAt: timestamp("added_at").defaultNow(),
});

export const insertPlaylistItemSchema = createInsertSchema(backgroundPlaylist).omit({ id: true, addedAt: true });
export type InsertPlaylistItem = z.infer<typeof insertPlaylistItemSchema>;
export type PlaylistItem = typeof backgroundPlaylist.$inferSelect;

// Users table (simplified)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Type definitions for JSON columns
export interface CategoryDistribution {
  name: string;
  count: number;
  percentage: number;
  color: string;
}

// API request/response types
export interface CrawlDataPayload {
  videos: InsertVideo[];
  subscriptions: InsertSubscription[];
  recommendedVideos: InsertVideo[];
  watchHistoryVideos?: InsertVideo[]; // Videos from watch history (higher significance)
}

export interface AnalysisRequest {
  videos: Video[];
  subscriptions: Subscription[];
}

export interface DashboardStats {
  totalVideosAnalyzed: number;
  biasScore: number;
  recommendationsGiven: number;
  snapshotsSaved: number;
}
