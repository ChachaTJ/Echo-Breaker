import { useQuery, useMutation } from "@tanstack/react-query";
import { BarChart3, RefreshCw, AlertTriangle, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { BiasMeter } from "@/components/bias-meter";
import { CategoryChart } from "@/components/category-chart";
import { BiasVisualization } from "@/components/bias-visualization";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { AnalysisResult, Video, CategoryDistribution } from "@shared/schema";

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

  const { data: analysis, isLoading: analysisLoading } = useQuery<AnalysisResult | null>({
    queryKey: ['/api/analysis/latest'],
  });

  const { data: videos } = useQuery<Video[]>({
    queryKey: ['/api/videos'],
  });

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

          <BiasVisualization videos={videos || []} analysis={analysis} />

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
      )}
    </div>
  );
}
