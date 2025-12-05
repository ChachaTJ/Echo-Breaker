import { useQuery, useMutation } from "@tanstack/react-query";
import { Lightbulb, RefreshCw, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VideoCard } from "@/components/video-card";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Recommendation } from "@shared/schema";

export default function Recommendations() {
  const { toast } = useToast();

  const { data: recommendations, isLoading } = useQuery<Recommendation[]>({
    queryKey: ['/api/recommendations'],
  });

  const refreshMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/recommendations/generate'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recommendations'] });
      toast({
        title: "Recommendations Updated",
        description: "New recommendations have been generated based on your data.",
      });
    },
    onError: () => {
      toast({
        title: "Generation Failed",
        description: "Could not generate recommendations. Please try again.",
        variant: "destructive",
      });
    },
  });

  const markWatchedMutation = useMutation({
    mutationFn: (id: string) => apiRequest('PATCH', `/api/recommendations/${id}/watched`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recommendations'] });
    },
  });

  const unwatched = recommendations?.filter(r => !r.watched) || [];
  const watched = recommendations?.filter(r => r.watched) || [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Recommendations</h1>
          <p className="text-muted-foreground mt-1">
            Curated videos to broaden your perspective and break the echo chamber
          </p>
        </div>
        <Button 
          onClick={() => refreshMutation.mutate()} 
          disabled={refreshMutation.isPending}
          className="gap-2"
          data-testid="button-generate-recommendations"
        >
          <RefreshCw className={`h-4 w-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
          {refreshMutation.isPending ? 'Generating...' : 'Generate New'}
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
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
        <Tabs defaultValue="unwatched" className="space-y-6">
          <TabsList>
            <TabsTrigger value="unwatched" data-testid="tab-unwatched">
              Unwatched ({unwatched.length})
            </TabsTrigger>
            <TabsTrigger value="watched" data-testid="tab-watched">
              Watched ({watched.length})
            </TabsTrigger>
            <TabsTrigger value="all" data-testid="tab-all">
              All ({recommendations.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="unwatched" className="space-y-4">
            {unwatched.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {unwatched.map((rec) => (
                  <VideoCard
                    key={rec.id}
                    videoId={rec.videoId}
                    title={rec.title}
                    channelName={rec.channelName}
                    thumbnailUrl={rec.thumbnailUrl}
                    reason={rec.reason}
                    category={rec.category}
                    watched={false}
                    onMarkWatched={() => markWatchedMutation.mutate(rec.id)}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Lightbulb className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">All Caught Up!</h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    You've watched all the recommendations. Generate new ones to discover more diverse content.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="watched" className="space-y-4">
            {watched.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {watched.map((rec) => (
                  <VideoCard
                    key={rec.id}
                    videoId={rec.videoId}
                    title={rec.title}
                    channelName={rec.channelName}
                    thumbnailUrl={rec.thumbnailUrl}
                    reason={rec.reason}
                    category={rec.category}
                    watched={true}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-sm text-muted-foreground">
                    No watched recommendations yet.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="all" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {recommendations.map((rec) => (
                <VideoCard
                  key={rec.id}
                  videoId={rec.videoId}
                  title={rec.title}
                  channelName={rec.channelName}
                  thumbnailUrl={rec.thumbnailUrl}
                  reason={rec.reason}
                  category={rec.category}
                  watched={rec.watched || false}
                  onMarkWatched={rec.watched ? undefined : () => markWatchedMutation.mutate(rec.id)}
                />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Lightbulb className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Recommendations Yet</h3>
            <p className="text-muted-foreground max-w-md mb-6">
              We need to analyze your viewing patterns first. 
              Run an analysis from the Analysis page, then come back to see personalized recommendations.
            </p>
            <Button 
              onClick={() => refreshMutation.mutate()} 
              disabled={refreshMutation.isPending}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
              Generate Recommendations
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
