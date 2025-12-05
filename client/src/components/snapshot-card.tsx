import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Trash2, Clock } from "lucide-react";
import { format } from "date-fns";
import type { Snapshot } from "@shared/schema";

interface SnapshotCardProps {
  snapshot: Snapshot;
  onActivate?: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
  isActivating?: boolean;
}

export function SnapshotCard({ 
  snapshot, 
  onActivate, 
  onDelete,
  isDeleting,
  isActivating
}: SnapshotCardProps) {
  const thumbnails = snapshot.thumbnails?.slice(0, 4) || [];
  const videoCount = snapshot.videoIds?.length || 0;

  return (
    <Card className="overflow-hidden" data-testid={`snapshot-card-${snapshot.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <CardTitle className="flex items-center gap-2 text-lg">
              {snapshot.name}
              {snapshot.isActive && (
                <Badge variant="default" className="text-xs">Active</Badge>
              )}
            </CardTitle>
            {snapshot.description && (
              <CardDescription className="mt-1 line-clamp-2">
                {snapshot.description}
              </CardDescription>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-4 gap-1 rounded-lg overflow-hidden">
          {thumbnails.length > 0 ? (
            thumbnails.map((thumb, i) => (
              <div key={i} className="aspect-video bg-muted">
                <img 
                  src={thumb} 
                  alt={`Thumbnail ${i + 1}`}
                  className="h-full w-full object-cover"
                />
              </div>
            ))
          ) : (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-video bg-muted" />
            ))
          )}
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{snapshot.createdAt ? format(new Date(snapshot.createdAt), 'MMM d, yyyy h:mm a') : 'Unknown date'}</span>
          </div>
          <span>{videoCount} videos</span>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            onClick={onActivate} 
            disabled={snapshot.isActive || isActivating}
            className="flex-1 gap-2"
            data-testid={`button-activate-snapshot-${snapshot.id}`}
          >
            <Play className="h-4 w-4" />
            {isActivating ? 'Activating...' : snapshot.isActive ? 'Currently Active' : 'Restore This State'}
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={onDelete}
            disabled={isDeleting}
            data-testid={`button-delete-snapshot-${snapshot.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
