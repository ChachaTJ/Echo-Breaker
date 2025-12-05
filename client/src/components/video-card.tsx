import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Play, Check } from "lucide-react";

interface VideoCardProps {
  videoId: string;
  title: string;
  channelName: string;
  thumbnailUrl?: string | null;
  viewCount?: string | null;
  reason?: string | null;
  category?: string | null;
  watched?: boolean;
  onMarkWatched?: () => void;
  compact?: boolean;
}

export function VideoCard({
  videoId,
  title,
  channelName,
  thumbnailUrl,
  viewCount,
  reason,
  category,
  watched,
  onMarkWatched,
  compact = false,
}: VideoCardProps) {
  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const defaultThumbnail = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-2 rounded-lg hover-elevate" data-testid={`video-card-${videoId}`}>
        <img
          src={thumbnailUrl || defaultThumbnail}
          alt={title}
          className="h-12 w-20 rounded object-cover shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium line-clamp-1">{title}</p>
          <p className="text-xs text-muted-foreground">{channelName}</p>
        </div>
        <a href={youtubeUrl} target="_blank" rel="noopener noreferrer">
          <Button size="icon" variant="ghost">
            <Play className="h-4 w-4" />
          </Button>
        </a>
      </div>
    );
  }

  return (
    <Card className="overflow-hidden hover-elevate group" data-testid={`video-card-${videoId}`}>
      <div className="relative aspect-video">
        <img
          src={thumbnailUrl || defaultThumbnail}
          alt={title}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <a 
            href={youtubeUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Button size="icon" variant="secondary" className="rounded-full">
              <Play className="h-5 w-5" />
            </Button>
          </a>
        </div>
        {watched && (
          <div className="absolute top-2 right-2">
            <Badge variant="secondary" className="gap-1">
              <Check className="h-3 w-3" />
              Watched
            </Badge>
          </div>
        )}
      </div>
      <CardContent className="p-4 space-y-3">
        <div className="space-y-1">
          <h3 className="font-medium line-clamp-2 leading-tight">{title}</h3>
          <p className="text-sm text-muted-foreground">{channelName}</p>
        </div>
        
        {viewCount && (
          <p className="text-xs text-muted-foreground">{viewCount} views</p>
        )}
        
        <div className="flex flex-wrap items-center gap-2">
          {category && (
            <Badge variant="outline" className="text-xs">
              {category}
            </Badge>
          )}
        </div>
        
        {reason && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Why recommended: </span>
              {reason}
            </p>
          </div>
        )}
        
        <div className="flex items-center gap-2 pt-2">
          <a href={youtubeUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
            <Button variant="outline" size="sm" className="w-full gap-2">
              <ExternalLink className="h-3 w-3" />
              Watch on YouTube
            </Button>
          </a>
          {onMarkWatched && !watched && (
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={onMarkWatched}
              data-testid={`button-mark-watched-${videoId}`}
            >
              <Check className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
