import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Camera, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SnapshotCard } from "@/components/snapshot-card";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Snapshot } from "@shared/schema";

export default function Snapshots() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newSnapshotName, setNewSnapshotName] = useState("");
  const [newSnapshotDescription, setNewSnapshotDescription] = useState("");

  const { data: snapshots, isLoading } = useQuery<Snapshot[]>({
    queryKey: ['/api/snapshots'],
  });

  const createSnapshotMutation = useMutation({
    mutationFn: (data: { name: string; description: string }) => 
      apiRequest('POST', '/api/snapshots', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      setIsDialogOpen(false);
      setNewSnapshotName("");
      setNewSnapshotDescription("");
      toast({
        title: "Snapshot Created",
        description: "Your current algorithm state has been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Creation Failed",
        description: "Could not create snapshot. Please try again.",
        variant: "destructive",
      });
    },
  });

  const activateSnapshotMutation = useMutation({
    mutationFn: (id: string) => apiRequest('POST', `/api/snapshots/${id}/activate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['/api/playlist'] });
      toast({
        title: "Snapshot Activated",
        description: "Videos have been added to the background playlist for regression.",
      });
    },
    onError: () => {
      toast({
        title: "Activation Failed",
        description: "Could not activate snapshot. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteSnapshotMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/snapshots/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      toast({
        title: "Snapshot Deleted",
        description: "The snapshot has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Deletion Failed",
        description: "Could not delete snapshot. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCreateSnapshot = () => {
    if (!newSnapshotName.trim()) return;
    createSnapshotMutation.mutate({
      name: newSnapshotName,
      description: newSnapshotDescription,
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Algorithm Snapshots</h1>
          <p className="text-muted-foreground mt-1">
            Save and restore your YouTube recommendation state
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-create-snapshot">
              <Plus className="h-4 w-4" />
              Create Snapshot
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Snapshot</DialogTitle>
              <DialogDescription>
                Save the current state of your YouTube recommendations. 
                You can restore this state later to "reset" your algorithm.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="snapshot-name">Name</Label>
                <Input
                  id="snapshot-name"
                  placeholder="e.g., Before Election Season"
                  value={newSnapshotName}
                  onChange={(e) => setNewSnapshotName(e.target.value)}
                  data-testid="input-snapshot-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="snapshot-description">Description (optional)</Label>
                <Textarea
                  id="snapshot-description"
                  placeholder="Describe this snapshot state..."
                  value={newSnapshotDescription}
                  onChange={(e) => setNewSnapshotDescription(e.target.value)}
                  data-testid="input-snapshot-description"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateSnapshot}
                disabled={!newSnapshotName.trim() || createSnapshotMutation.isPending}
                data-testid="button-confirm-create"
              >
                {createSnapshotMutation.isPending ? 'Creating...' : 'Create Snapshot'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6 space-y-4">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <div className="grid grid-cols-4 gap-1">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <Skeleton key={j} className="aspect-video" />
                  ))}
                </div>
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : snapshots && snapshots.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {snapshots.map((snapshot) => (
            <SnapshotCard
              key={snapshot.id}
              snapshot={snapshot}
              onActivate={() => activateSnapshotMutation.mutate(snapshot.id)}
              onDelete={() => deleteSnapshotMutation.mutate(snapshot.id)}
              isActivating={activateSnapshotMutation.isPending}
              isDeleting={deleteSnapshotMutation.isPending}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Camera className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Snapshots Yet</h3>
            <p className="text-muted-foreground max-w-md mb-6">
              Save your current YouTube recommendation state as a snapshot. 
              When your algorithm drifts, you can restore this state by playing videos from the snapshot in the background.
            </p>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Your First Snapshot
                </Button>
              </DialogTrigger>
            </Dialog>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-6">
          <h3 className="font-semibold mb-2">How Snapshots Work</h3>
          <div className="grid gap-4 md:grid-cols-3 text-sm text-muted-foreground">
            <div className="space-y-1">
              <span className="font-medium text-foreground">1. Create a Snapshot</span>
              <p>Save the current videos that YouTube is recommending to you.</p>
            </div>
            <div className="space-y-1">
              <span className="font-medium text-foreground">2. Algorithm Drifts</span>
              <p>Over time, YouTube may push you toward more extreme content.</p>
            </div>
            <div className="space-y-1">
              <span className="font-medium text-foreground">3. Restore State</span>
              <p>Activate a snapshot to add its videos to the background playlist for "regression."</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
