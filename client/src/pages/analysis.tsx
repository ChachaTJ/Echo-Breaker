import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { BarChart3, RefreshCw, AlertTriangle, TrendingUp, Sparkles, FlaskConical, Gauge, Eye, PlayCircle, Brain, Shield, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BiasMeter } from "@/components/bias-meter";
import { CategoryChart } from "@/components/category-chart";
import { BiasVisualization } from "@/components/bias-visualization";
import { VideoConstellation } from "@/components/video-constellation";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import type { AnalysisResult, Video, CategoryDistribution, StanceBreakdown } from "@shared/schema";

interface AIClassification {
  category: string;
  color: string;
  percentage: number;
  description: string;
}

interface AIInsights {
  viewingPatternSummary: string;
  echoChamberRisk: 'low' | 'medium' | 'high';
  echoChamberExplanation: string;
  dominantThemes: string[];
  blindSpots: string[];
  diversityScore: number;
  aiClassifications: AIClassification[];
  recommendations: string[];
}

interface ConstellationData {
  videos: Array<{
    id: string;
    videoId: string;
    title: string;
    channelName: string;
    thumbnailUrl: string;
    position: [number, number, number];
    cluster: number;
    clusterName: string;
    sourcePhase?: 'home_feed' | 'watch_history' | 'subscriptions' | 'search' | 'recommended';
    significanceWeight?: number;
  }>;
  clusters: Array<{
    id: number;
    name: string;
    color: string;
  }>;
  similarityMatrix?: number[][];
  embeddings?: number[][];
}

// Stance colors for visualization
const STANCE_COLORS = {
  progressive: "#3B82F6", // blue
  conservative: "#EF4444", // red
  centrist: "#22C55E", // green
  nonPolitical: "#9CA3AF", // gray
};

// Generate mock constellation data for test mode
function generateMockConstellationData(): ConstellationData {
  const sampleVideos = [
    { title: "Machine Learning Basics", channel: "Tech Academy", cluster: 0 },
    { title: "Deep Learning Tutorial", channel: "AI Insights", cluster: 0 },
    { title: "Python for Beginners", channel: "Code Masters", cluster: 0 },
    { title: "Web Development 2024", channel: "Dev Pro", cluster: 0 },
    { title: "React Hooks Explained", channel: "Frontend Focus", cluster: 0 },
    { title: "Latest Tech News", channel: "Tech Today", cluster: 1 },
    { title: "Startup Funding Guide", channel: "Business Insider", cluster: 1 },
    { title: "Investment Strategies", channel: "Finance Pro", cluster: 1 },
    { title: "Cryptocurrency Update", channel: "Crypto Daily", cluster: 1 },
    { title: "How to Cook Pasta", channel: "Kitchen Master", cluster: 2 },
    { title: "Healthy Recipes", channel: "Food Network", cluster: 2 },
    { title: "Home Workout Routine", channel: "Fitness First", cluster: 2 },
    { title: "Meditation Guide", channel: "Zen Life", cluster: 2 },
    { title: "Travel Vlog Japan", channel: "World Explorer", cluster: 3 },
    { title: "City Walking Tour", channel: "Urban Adventures", cluster: 3 },
    { title: "Nature Documentary", channel: "Wild Planet", cluster: 3 },
    { title: "Ocean Life Mysteries", channel: "Deep Sea", cluster: 3 },
    { title: "Gaming News Weekly", channel: "Game Spot", cluster: 4 },
    { title: "New Game Review", channel: "IGN", cluster: 4 },
    { title: "Esports Highlights", channel: "ESL", cluster: 4 },
    { title: "Indie Game Showcase", channel: "Indie Corner", cluster: 4 },
    { title: "Music Production Tips", channel: "Beat Lab", cluster: 5 },
    { title: "Guitar Lessons", channel: "Music School", cluster: 5 },
    { title: "Album Review", channel: "Music Critics", cluster: 5 },
  ];

  const clusterCenters = [
    [-15, 10, -5],   // Tech
    [15, 12, 0],    // Business
    [-10, -15, 10], // Lifestyle
    [12, -10, -8],  // Travel
    [0, 15, 15],    // Gaming
    [-12, 0, -15],  // Music
  ];

  const sourcePhases: Array<'home_feed' | 'watch_history' | 'subscriptions' | 'search' | 'recommended'> = 
    ['home_feed', 'watch_history', 'subscriptions', 'search', 'recommended'];
  
  const videos = sampleVideos.map((video, i) => {
    const center = clusterCenters[video.cluster];
    const jitter = () => (Math.random() - 0.5) * 10;
    
    return {
      id: `mock-${i}`,
      videoId: `dQw4w9WgXcQ`,
      title: video.title,
      channelName: video.channel,
      thumbnailUrl: `https://picsum.photos/seed/${i}/320/180`,
      position: [
        center[0] + jitter(),
        center[1] + jitter(),
        center[2] + jitter(),
      ] as [number, number, number],
      cluster: video.cluster,
      clusterName: ["Technology", "Business", "Lifestyle", "Travel", "Gaming", "Music"][video.cluster],
      sourcePhase: sourcePhases[i % sourcePhases.length],
      significanceWeight: Math.floor(Math.random() * 50) + 30,
    };
  });

  const clusters = [
    { id: 0, name: "Technology", color: "#4ECDC4" },
    { id: 1, name: "Business", color: "#F7DC6F" },
    { id: 2, name: "Lifestyle", color: "#96CEB4" },
    { id: 3, name: "Travel", color: "#45B7D1" },
    { id: 4, name: "Gaming", color: "#BB8FCE" },
    { id: 5, name: "Music", color: "#DDA0DD" },
  ];

  return { videos, clusters };
}

function TopicBadge({ topic, index }: { topic: string; index: number }) {
  const colors = [
    "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    "bg-green-500/10 text-green-600 dark:text-green-400",
    "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    "bg-pink-500/10 text-pink-600 dark:text-pink-400",
  ];
  return (
    <Badge variant="outline" className={colors[index % colors.length]}>
      {topic}
    </Badge>
  );
}

export default function Analysis() {
  const { toast } = useToast();
  
  // Test mode state - synced with localStorage
  const [testMode, setTestMode] = useState(() => {
    return localStorage.getItem('constellation-test-mode') === 'true';
  });
  
  // Listen for localStorage changes from Settings page
  useEffect(() => {
    const handleStorage = () => {
      setTestMode(localStorage.getItem('constellation-test-mode') === 'true');
    };
    window.addEventListener('storage', handleStorage);
    
    // Also check on focus (for same-tab navigation)
    const handleFocus = () => {
      setTestMode(localStorage.getItem('constellation-test-mode') === 'true');
    };
    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);
  
  // Generate mock data only once per mount
  const [mockData] = useState(() => generateMockConstellationData());

  const { data: analysis, isLoading: analysisLoading } = useQuery<AnalysisResult | null>({
    queryKey: ['/api/analysis/latest'],
  });

  const { data: videos } = useQuery<Video[]>({
    queryKey: ['/api/videos'],
  });

  const { data: constellationData, isLoading: constellationLoading } = useQuery<ConstellationData>({
    queryKey: ['/api/analysis/constellation'],
    enabled: !testMode && (videos?.length || 0) >= 3,
  });
  
  // AI insights state
  const [aiInsights, setAiInsights] = useState<AIInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  
  // Use mock data in test mode, otherwise use real data
  const displayConstellationData = testMode ? mockData : constellationData;

  // Fetch AI insights
  const fetchAIInsights = async () => {
    setInsightsLoading(true);
    try {
      const response = await apiRequest('POST', '/api/analysis/constellation-insights');
      const data = await response.json();
      if (data.insights) {
        setAiInsights(data.insights);
      } else if (data.fallback) {
        setAiInsights(data.fallback);
      }
    } catch (error) {
      console.error('Failed to fetch AI insights:', error);
      toast({
        title: "AI 분석 실패",
        description: "AI 인사이트를 가져오는데 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setInsightsLoading(false);
    }
  };

  const runAnalysisMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/analysis/run'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/analysis/latest'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      toast({
        title: "Analysis Complete",
        description: "Your content has been analyzed successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Analysis Failed",
        description: "Could not complete the analysis. Please try again.",
        variant: "destructive",
      });
    },
  });

  const categories = analysis?.categories || [];
  const topTopics = analysis?.topTopics || [];

  const channelData = videos?.reduce((acc, video) => {
    const channel = video.channelName;
    acc[channel] = (acc[channel] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const topChannels = Object.entries(channelData)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([name, count]) => ({ name: name.slice(0, 20), count }));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Content Analysis</h1>
          <p className="text-muted-foreground mt-1">
            Deep dive into your YouTube consumption patterns
          </p>
        </div>
        <Button 
          onClick={() => runAnalysisMutation.mutate()} 
          disabled={runAnalysisMutation.isPending}
          className="gap-2"
          data-testid="button-run-analysis"
        >
          <RefreshCw className={`h-4 w-4 ${runAnalysisMutation.isPending ? 'animate-spin' : ''}`} />
          {runAnalysisMutation.isPending ? 'Analyzing...' : 'Run Analysis'}
        </Button>
      </div>

      {analysisLoading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-48 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[300px] w-full" />
            </CardContent>
          </Card>
        </div>
      ) : analysis ? (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <BiasMeter
              score={analysis.biasScore}
              politicalLeaning={analysis.politicalLeaning || undefined}
              summary={analysis.summary || undefined}
            />
            <CategoryChart 
              categories={categories} 
              title="Content Distribution"
              description="Categories of videos you've been watching"
            />
          </div>

          {/* Entropy Score and Stance Breakdown */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Entropy Score Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gauge className="h-5 w-5" />
                  Viewpoint Diversity
                </CardTitle>
                <CardDescription>
                  Shannon entropy score - higher means more diverse perspectives
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-4xl font-bold">
                      {analysis.entropyScore ?? '--'}
                    </span>
                    <span className="text-sm text-muted-foreground">/100</span>
                  </div>
                  <Progress 
                    value={analysis.entropyScore ?? 50} 
                    className="h-3"
                  />
                  <p className="text-sm text-muted-foreground">
                    {(analysis.entropyScore ?? 50) >= 70 
                      ? "Great diversity! You consume content from varied perspectives."
                      : (analysis.entropyScore ?? 50) >= 40
                      ? "Moderate diversity. Consider exploring different viewpoints."
                      : "Low diversity detected. Your content leans heavily toward one perspective."}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Stance Breakdown Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Political Stance Distribution
                </CardTitle>
                <CardDescription>
                  Content classification by political perspective
                </CardDescription>
              </CardHeader>
              <CardContent>
                {analysis.stanceBreakdown ? (
                  <div className="space-y-3">
                    {[
                      { key: 'progressive' as const, label: 'Progressive', color: STANCE_COLORS.progressive },
                      { key: 'conservative' as const, label: 'Conservative', color: STANCE_COLORS.conservative },
                      { key: 'centrist' as const, label: 'Centrist', color: STANCE_COLORS.centrist },
                      { key: 'nonPolitical' as const, label: 'Non-Political', color: STANCE_COLORS.nonPolitical },
                    ].map(({ key, label, color }) => {
                      const data = analysis.stanceBreakdown?.[key];
                      return (
                        <div key={key} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: color }}
                              />
                              {label}
                            </span>
                            <span className="font-medium">
                              {data?.count ?? 0} ({data?.percentage ?? 0}%)
                            </span>
                          </div>
                          <Progress 
                            value={data?.percentage ?? 0} 
                            className="h-2"
                            style={{ 
                              '--progress-indicator': color 
                            } as React.CSSProperties}
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Run analysis with Gemini to see stance breakdown.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 3D Video Constellation - Moved up for prominence */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    Filter Bubble Visualization
                    {testMode && (
                      <Badge variant="outline" className="ml-2 text-orange-600 dark:text-orange-400 border-orange-500/50">
                        <FlaskConical className="h-3 w-3 mr-1" />
                        Test Mode
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    3D soap bubbles show your video ecosystem - color indicates source type
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!testMode && constellationLoading ? (
                <Skeleton className="h-[500px] w-full rounded-lg" />
              ) : displayConstellationData && displayConstellationData.videos.length > 0 ? (
                <div className="h-[500px] w-full">
                  <VideoConstellation
                    videos={displayConstellationData.videos}
                    clusters={displayConstellationData.clusters}
                    similarityMatrix={displayConstellationData.similarityMatrix}
                    aiClassifications={aiInsights?.aiClassifications}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[300px] text-center text-muted-foreground">
                  <Sparkles className="h-12 w-12 mb-4 opacity-50" />
                  <p>Collect more videos to see the filter bubble</p>
                  <p className="text-sm mt-1">At least 3 videos are needed</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Insights Panel */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    AI 시청 패턴 분석
                  </CardTitle>
                  <CardDescription>
                    Gemini AI가 분석한 당신의 시청 패턴과 에코 체임버 위험도
                  </CardDescription>
                </div>
                <Button
                  onClick={fetchAIInsights}
                  disabled={insightsLoading || (videos?.length || 0) < 3}
                  className="gap-2"
                  data-testid="button-fetch-ai-insights"
                >
                  <Brain className={`h-4 w-4 ${insightsLoading ? 'animate-pulse' : ''}`} />
                  {insightsLoading ? 'AI 분석 중...' : 'AI 분석 실행'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {insightsLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-20 w-full" />
                  <div className="grid gap-4 md:grid-cols-2">
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                  </div>
                </div>
              ) : aiInsights ? (
                <div className="space-y-6">
                  {/* Pattern Summary */}
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm leading-relaxed">{aiInsights.viewingPatternSummary}</p>
                  </div>

                  {/* Echo Chamber Risk & Diversity Score */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="p-4 rounded-lg border">
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className="h-4 w-4" />
                        <span className="font-medium">에코 체임버 위험도</span>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge 
                          variant={aiInsights.echoChamberRisk === 'high' ? 'destructive' : aiInsights.echoChamberRisk === 'medium' ? 'default' : 'secondary'}
                          className="text-sm"
                        >
                          {aiInsights.echoChamberRisk === 'high' ? '높음' : aiInsights.echoChamberRisk === 'medium' ? '중간' : '낮음'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{aiInsights.echoChamberExplanation}</p>
                    </div>

                    <div className="p-4 rounded-lg border">
                      <div className="flex items-center gap-2 mb-2">
                        <Gauge className="h-4 w-4" />
                        <span className="font-medium">다양성 점수</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-3xl font-bold">{aiInsights.diversityScore}</span>
                        <span className="text-muted-foreground">/100</span>
                      </div>
                      <Progress value={aiInsights.diversityScore} className="mt-2 h-2" />
                    </div>
                  </div>

                  {/* AI Classifications */}
                  {aiInsights.aiClassifications && aiInsights.aiClassifications.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        AI 분류 카테고리
                      </h4>
                      <div className="space-y-2">
                        {aiInsights.aiClassifications.map((cat, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <div 
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: cat.color }}
                            />
                            <span className="text-sm font-medium min-w-[100px]">{cat.category}</span>
                            <div className="flex-1">
                              <Progress value={cat.percentage} className="h-2" />
                            </div>
                            <span className="text-sm text-muted-foreground min-w-[60px] text-right">
                              {cat.percentage}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Dominant Themes & Blind Spots */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        주요 테마
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {aiInsights.dominantThemes.map((theme, i) => (
                          <Badge key={i} variant="outline">{theme}</Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                        시청하지 않는 분야
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {aiInsights.blindSpots.map((spot, i) => (
                          <Badge key={i} variant="secondary" className="opacity-70">{spot}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Recommendations */}
                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-primary" />
                      AI 추천
                    </h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {aiInsights.recommendations.map((rec, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-primary">•</span>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                  <Brain className="h-12 w-12 mb-4 opacity-30" />
                  <p>AI 분석을 실행하여 시청 패턴 인사이트를 확인하세요</p>
                  <p className="text-sm mt-1">최소 3개의 영상이 필요합니다</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Source Phase Legend */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlayCircle className="h-5 w-5" />
                Video Sources
              </CardTitle>
              <CardDescription>
                Bubble ring style indicates how you discovered each video
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border border-pink-500" style={{ borderStyle: 'dashed' }} />
                  <span className="text-sm">Shorts</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-solid border-blue-500" />
                  <span className="text-sm">Video</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-dashed border-violet-500" />
                  <span className="text-sm">Playlist</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-dashed border-green-500" />
                  <span className="text-sm">Home Feed</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-dotted border-purple-500" />
                  <span className="text-sm">Subscriptions</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-solid border-yellow-500" style={{ borderStyle: 'double' }} />
                  <span className="text-sm">Search</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border border-orange-500/50" />
                  <span className="text-sm">Recommended</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <BiasVisualization videos={videos || []} analysis={analysis} />

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Top Topics
                </CardTitle>
                <CardDescription>
                  Most frequent topics in your viewing history
                </CardDescription>
              </CardHeader>
              <CardContent>
                {topTopics.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {topTopics.map((topic, i) => (
                      <TopicBadge key={topic} topic={topic} index={i} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No topics identified yet.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Most Watched Channels</CardTitle>
                <CardDescription>
                  Your top 10 channels by video count
                </CardDescription>
              </CardHeader>
              <CardContent>
                {topChannels.length > 0 ? (
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topChannels} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" />
                        <YAxis 
                          type="category" 
                          dataKey="name" 
                          width={120}
                          tick={{ fontSize: 12 }}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No channel data available.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {analysis.biasScore < 35 || analysis.biasScore > 65 ? (
            <Card className="border-orange-500/50 bg-orange-500/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                  <AlertTriangle className="h-5 w-5" />
                  Echo Chamber Warning
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Your content consumption appears to be skewed towards one perspective. 
                  Consider checking out some of our recommended videos to get a more balanced view.
                  A healthy information diet includes diverse viewpoints and sources.
                </p>
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <BarChart3 className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Analysis Available</h3>
              <p className="text-muted-foreground max-w-md mb-6">
                We need some data to analyze your viewing patterns. 
                Install the Chrome extension and browse YouTube, then run an analysis.
              </p>
              <Button 
                onClick={() => runAnalysisMutation.mutate()} 
                disabled={runAnalysisMutation.isPending}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${runAnalysisMutation.isPending ? 'animate-spin' : ''}`} />
                Run Analysis
              </Button>
            </CardContent>
          </Card>
          
          {/* Show constellation in test mode even without analysis */}
          {testMode && displayConstellationData && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5" />
                      Video Constellation
                      <Badge variant="outline" className="ml-2 text-orange-600 dark:text-orange-400 border-orange-500/50">
                        <FlaskConical className="h-3 w-3 mr-1" />
                        Test Mode
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      3D visualization preview with sample data
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[500px] w-full">
                  <VideoConstellation
                    videos={displayConstellationData.videos}
                    clusters={displayConstellationData.clusters}
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
