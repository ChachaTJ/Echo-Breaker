import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Play, Pause, Trash2, ExternalLink } from "lucide-react";
import type { PlaylistItem } from "@shared/schema";

interface PlaylistTableProps {
  items: PlaylistItem[];
  selectedIds: string[];
  onSelectItem: (id: string) => void;
  onSelectAll: () => void;
  onPlayItem: (id: string) => void;
  onRemoveItem: (id: string) => void;
  onRemoveSelected: () => void;
}

function getStatusBadge(status: string | null) {
  switch (status) {
    case 'playing':
      return <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">Playing</Badge>;
    case 'completed':
      return <Badge variant="secondary">Completed</Badge>;
    default:
      return <Badge variant="outline">Pending</Badge>;
  }
}

export function PlaylistTable({
  items,
  selectedIds,
  onSelectItem,
  onSelectAll,
  onPlayItem,
  onRemoveItem,
  onRemoveSelected,
}: PlaylistTableProps) {
  const allSelected = items.length > 0 && selectedIds.length === items.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < items.length;

  return (
    <div className="space-y-4">
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-muted p-3">
          <span className="text-sm">{selectedIds.length} item(s) selected</span>
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={onRemoveSelected}
            className="gap-2"
            data-testid="button-remove-selected"
          >
            <Trash2 className="h-4 w-4" />
            Remove Selected
          </Button>
        </div>
      )}

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox 
                  checked={allSelected}
                  onCheckedChange={onSelectAll}
                  className={someSelected ? "data-[state=checked]:bg-primary" : ""}
                  data-testid="checkbox-select-all"
                />
              </TableHead>
              <TableHead className="w-[100px]">Thumbnail</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-20">Plays</TableHead>
              <TableHead className="w-28 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  No videos in the background playlist.
                  <br />
                  <span className="text-sm">Create a snapshot and add videos to start algorithm regression.</span>
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id} data-testid={`playlist-row-${item.id}`}>
                  <TableCell>
                    <Checkbox 
                      checked={selectedIds.includes(item.id)}
                      onCheckedChange={() => onSelectItem(item.id)}
                      data-testid={`checkbox-item-${item.id}`}
                    />
                  </TableCell>
                  <TableCell>
                    <img
                      src={item.thumbnailUrl || `https://img.youtube.com/vi/${item.videoId}/default.jpg`}
                      alt={item.title}
                      className="h-14 w-24 rounded object-cover"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[300px]">
                      <p className="font-medium line-clamp-1">{item.title}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.channelName}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(item.status)}
                  </TableCell>
                  <TableCell className="text-center">
                    {item.playCount || 0}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <a 
                        href={`https://www.youtube.com/watch?v=${item.videoId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="ghost" size="icon">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </a>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => onPlayItem(item.id)}
                        data-testid={`button-play-${item.id}`}
                      >
                        {item.status === 'playing' ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => onRemoveItem(item.id)}
                        data-testid={`button-remove-${item.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
