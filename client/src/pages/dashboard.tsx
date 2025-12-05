import { useQuery } from "@tanstack/react-query";
import { Video, BarChart3, Lightbulb, Camera, RefreshCw } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { BiasMeter } from "@/components/bias-meter";
import { CategoryChart } from "@/components/category-chart";
import { VideoCard } from "@/components/video-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SyncStatus } from "@/components/sync-status";
import type { DashboardStats, AnalysisResult, Recommendation, CategoryDistribution } from "@shared/schema";

function StatsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-16" />
              </div>
              <Skeleton className="h-12 w-12 rounded-lg" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AnalysisSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/stats'],
  });

  const { data: analysis, isLoading: analysisLoading } = useQuery<AnalysisResult | null>({
    queryKey: ['/api/analysis/latest'],
  });

  const { data: recommendations, isLoading: recsLoading } = useQuery<Recommendation[]>({
    queryKey: ['/api/recommendations'],
  });

  const defaultStats: DashboardStats = {
    totalVideosAnalyzed: stats?.totalVideosAnalyzed || 0,
    biasScore: stats?.biasScore || 50,
    recommendationsGiven: stats?.recommendationsGiven || 0,
    snapshotsSaved: stats?.snapshotsSaved || 0,
  };

  const defaultCategories: CategoryDistribution[] = analysis?.categories || [
    { name: "Technology", count: 0, percentage: 0, color: "hsl(var(--chart-1))" },
    { name: "Politics", count: 0, percentage: 0, color: "hsl(var(--chart-2))" },
    { name: "Entertainment", count: 0, percentage: 0, color: "hsl(var(--chart-3))" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Overview of your content consumption and bias analysis
          </p>
        </div>
        <SyncStatus 
          status="idle" 
          lastSyncTime={null}
        />
      </div>

      {statsLoading ? (
        <StatsSkeleton />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Videos Analyzed"
            value={defaultStats.totalVideosAnalyzed}
            icon={Video}
            description="From YouTube history"
          />
          <StatCard
            title="Bias Score"
            value={defaultStats.biasScore}
            icon={BarChart3}
            description="50 = Perfectly balanced"
          />
          <StatCard
            title="Recommendations"
            value={defaultStats.recommendationsGiven}
            icon={Lightbulb}
            description="Diverse videos suggested"
          />
          <StatCard
            title="Snapshots Saved"
            value={defaultStats.snapshotsSaved}
            icon={Camera}
            description="Algorithm states preserved"
          />
        </div>
      )}

      {analysisLoading ? (
        <AnalysisSkeleton />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <BiasMeter
            score={analysis?.biasScore || 50}
            politicalLeaning={analysis?.politicalLeaning || undefined}
            summary={analysis?.summary || "No analysis available yet. Install the Chrome extension and browse YouTube to start collecting data."}
          />
          <CategoryChart categories={defaultCategories} />
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Recommended for Balance</h2>
            <p className="text-sm text-muted-foreground">
              Videos that might broaden your perspective
            </p>
          </div>
          <Button variant="outline" className="gap-2" data-testid="button-refresh-recommendations">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {recsLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <Skeleton className="aspect-video" />
                <CardContent className="p-4 space-y-2">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : recommendations && recommendations.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recommendations.slice(0, 6).map((rec) => (
              <VideoCard
                key={rec.id}
                videoId={rec.videoId}
                title={rec.title}
                channelName={rec.channelName}
                thumbnailUrl={rec.thumbnailUrl}
                reason={rec.reason}
                category={rec.category}
                watched={rec.watched || false}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Lightbulb className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No Recommendations Yet</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Install the Chrome extension and browse YouTube to collect data. 
                Once we analyze your viewing patterns, we'll suggest videos to diversify your content.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
