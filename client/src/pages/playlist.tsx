import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ListVideo, Play, Pause, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PlaylistTable } from "@/components/playlist-table";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { PlaylistItem } from "@shared/schema";

export default function Playlist() {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data: playlist, isLoading } = useQuery<PlaylistItem[]>({
    queryKey: ['/api/playlist'],
  });

  const playItemMutation = useMutation({
    mutationFn: (id: string) => apiRequest('POST', `/api/playlist/${id}/play`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/playlist'] });
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/playlist/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/playlist'] });
      toast({
        title: "Item Removed",
        description: "The video has been removed from the playlist.",
      });
    },
  });

  const removeSelectedMutation = useMutation({
    mutationFn: () => apiRequest('DELETE', '/api/playlist/bulk', { ids: selectedIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/playlist'] });
      setSelectedIds([]);
      toast({
        title: "Items Removed",
        description: `${selectedIds.length} videos have been removed from the playlist.`,
      });
    },
  });

  const handleSelectItem = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id) 
        : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (!playlist) return;
    if (selectedIds.length === playlist.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(playlist.map(item => item.id));
    }
  };

  const stats = {
    total: playlist?.length || 0,
    pending: playlist?.filter(p => p.status === 'pending').length || 0,
    playing: playlist?.filter(p => p.status === 'playing').length || 0,
    completed: playlist?.filter(p => p.status === 'completed').length || 0,
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Background Playlist</h1>
          <p className="text-muted-foreground mt-1">
            Videos queued for background playback to regress your algorithm
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Total</span>
              <span className="text-2xl font-bold">{stats.total}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Pending</span>
              <span className="text-2xl font-bold">{stats.pending}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Playing</span>
              <span className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.playing}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Completed</span>
              <span className="text-2xl font-bold">{stats.completed}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-6 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-5 w-5" />
                <Skeleton className="h-14 w-24" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-8 w-24" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <PlaylistTable
          items={playlist || []}
          selectedIds={selectedIds}
          onSelectItem={handleSelectItem}
          onSelectAll={handleSelectAll}
          onPlayItem={(id) => playItemMutation.mutate(id)}
          onRemoveItem={(id) => removeItemMutation.mutate(id)}
          onRemoveSelected={() => removeSelectedMutation.mutate()}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>How Background Playback Works</CardTitle>
          <CardDescription>
            Use the Chrome extension to automatically play videos in the background
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 text-sm">
            <div className="space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <ListVideo className="h-5 w-5" />
              </div>
              <h4 className="font-medium">Queue Videos</h4>
              <p className="text-muted-foreground">
                Activate a snapshot to add its videos to this playlist, or manually add videos.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <Play className="h-5 w-5" />
              </div>
              <h4 className="font-medium">Background Play</h4>
              <p className="text-muted-foreground">
                The Chrome extension will play these videos in a background tab with the sound muted.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <Pause className="h-5 w-5" />
              </div>
              <h4 className="font-medium">Algorithm Reset</h4>
              <p className="text-muted-foreground">
                YouTube's algorithm will gradually shift back toward the content from your snapshot.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
