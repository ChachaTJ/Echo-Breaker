import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Settings as SettingsIcon, Download, Trash2, Moon, Sun, Monitor, Cpu, RefreshCw, Wifi, WifiOff, Activity, Video, Users, ThumbsUp, Clock, Eye, ExternalLink, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useTheme } from "@/components/theme-provider";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function Settings() {
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  
  const [autoSync, setAutoSync] = useState(true);
  const [syncInterval, setSyncInterval] = useState([15]);
  const [diversityLevel, setDiversityLevel] = useState([50]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  
  // Constellation test mode
  const [constellationTestMode, setConstellationTestMode] = useState(() => {
    return localStorage.getItem('constellation-test-mode') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('constellation-test-mode', constellationTestMode.toString());
  }, [constellationTestMode]);

  // AI Selector Discovery - fetch cached selectors
  const { data: cachedSelectors, isLoading: selectorsLoading, refetch: refetchSelectors } = useQuery<Record<string, string>>({
    queryKey: ['/api/selectors'],
  });

  // Extension connection status
  interface ExtensionStatus {
    appVersion: string;
    extensionConnected: boolean;
    extensionVersion: string | null;
    lastSeen: string | null;
    userAgent: string | null;
  }
  const { data: extensionStatus, refetch: refetchExtensionStatus } = useQuery<ExtensionStatus>({
    queryKey: ['/api/extension/status'],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Data collection logs
  interface CollectionLog {
    timestamp: string;
    type: 'videos' | 'subscriptions' | 'recommended';
    count: number;
    source: string;
  }
  interface CollectionData {
    logs: CollectionLog[];
    totalCollected: {
      videos: number;
      subscriptions: number;
      recommended: number;
    };
  }
  const { data: collectionData, refetch: refetchCollection } = useQuery<CollectionData>({
    queryKey: ['/api/collection/logs'],
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  // Recent collected videos with full details
  interface RecentVideo {
    id: string;
    videoId: string;
    title: string;
    channelName: string;
    channelId: string | null;
    thumbnailUrl: string;
    viewCount: number | null;
    viewCountText: string | null;
    duration: string | null;
    uploadTime: string | null;
    source: string;
    collectedAt: string;
  }
  const { data: recentVideos, refetch: refetchVideos } = useQuery<RecentVideo[]>({
    queryKey: ['/api/collection/recent-videos'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const formatTimeAgo = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const clearDataMutation = useMutation({
    mutationFn: () => apiRequest('DELETE', '/api/data/all'),
    onSuccess: () => {
      queryClient.clear();
      toast({
        title: "Data Cleared",
        description: "All your data has been deleted.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Could not clear data. Please try again.",
        variant: "destructive",
      });
    },
  });

  const exportDataMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/data/export');
      if (!response.ok) throw new Error('Export failed');
      return response.blob();
    },
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `echobreaker-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({
        title: "Export Complete",
        description: "Your data has been downloaded.",
      });
    },
    onError: () => {
      toast({
        title: "Export Failed",
        description: "Could not export data. Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Customize your EchoBreaker experience
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {extensionStatus?.extensionConnected ? (
                    <Wifi className="h-5 w-5 text-green-500" />
                  ) : (
                    <WifiOff className="h-5 w-5 text-muted-foreground" />
                  )}
                  Extension Status
                </CardTitle>
                <CardDescription>
                  Connection status with Chrome extension
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => refetchExtensionStatus()}
                data-testid="button-refresh-extension-status"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Connection</Label>
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${extensionStatus?.extensionConnected ? 'bg-green-500' : 'bg-muted-foreground'}`} />
                    <span className="text-sm font-medium">
                      {extensionStatus?.extensionConnected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Last Seen</Label>
                  <span className="text-sm font-medium">
                    {formatTimeAgo(extensionStatus?.lastSeen || null)}
                  </span>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Dashboard Version</Label>
                  <Badge variant="secondary">{extensionStatus?.appVersion || '...'}</Badge>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Extension Version</Label>
                  <Badge variant="outline">
                    {extensionStatus?.extensionVersion || 'Not detected'}
                  </Badge>
                </div>
              </div>
              
              {!extensionStatus?.extensionConnected && (
                <div className="text-sm text-muted-foreground border rounded-md p-3 bg-muted/50">
                  Extension not connected. Make sure the Chrome extension is installed and you have visited YouTube recently.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Data Collection
                </CardTitle>
                <CardDescription>
                  Monitor data being collected from YouTube
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => refetchCollection()}
                data-testid="button-refresh-collection"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col items-center p-3 rounded-md bg-muted/50">
                  <Video className="h-5 w-5 mb-1 text-blue-500" />
                  <span className="text-lg font-bold">{collectionData?.totalCollected?.videos || 0}</span>
                  <span className="text-xs text-muted-foreground">Videos</span>
                </div>
                <div className="flex flex-col items-center p-3 rounded-md bg-muted/50">
                  <Users className="h-5 w-5 mb-1 text-green-500" />
                  <span className="text-lg font-bold">{collectionData?.totalCollected?.subscriptions || 0}</span>
                  <span className="text-xs text-muted-foreground">Subscriptions</span>
                </div>
                <div className="flex flex-col items-center p-3 rounded-md bg-muted/50">
                  <ThumbsUp className="h-5 w-5 mb-1 text-orange-500" />
                  <span className="text-lg font-bold">{collectionData?.totalCollected?.recommended || 0}</span>
                  <span className="text-xs text-muted-foreground">Recommended</span>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Recent Activity</Label>
                {collectionData?.logs && collectionData.logs.length > 0 ? (
                  <ScrollArea className="h-[150px] rounded-md border p-2">
                    <div className="space-y-2">
                      {collectionData.logs.slice().reverse().slice(0, 20).map((log, index) => (
                        <div key={index} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            {log.type === 'videos' && <Video className="h-3 w-3 text-blue-500" />}
                            {log.type === 'subscriptions' && <Users className="h-3 w-3 text-green-500" />}
                            {log.type === 'recommended' && <ThumbsUp className="h-3 w-3 text-orange-500" />}
                            <span className="capitalize">{log.type}</span>
                            <Badge variant="secondary" className="text-xs">+{log.count}</Badge>
                          </div>
                          <span className="text-muted-foreground">
                            {formatTimeAgo(log.timestamp)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-sm text-muted-foreground border rounded-md p-4 text-center">
                    No data collected yet.
                    <br />
                    <span className="text-xs">
                      Browse YouTube with the extension installed to start collecting data.
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recently Collected Videos - YouTube-style grid */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Video className="h-5 w-5" />
                  Recently Collected Videos
                </CardTitle>
                <CardDescription>
                  Videos detected on your YouTube feed
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => refetchVideos()}
                data-testid="button-refresh-videos"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentVideos && recentVideos.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {recentVideos.slice(0, 12).map((video) => (
                  <a
                    key={video.id}
                    href={`https://www.youtube.com/watch?v=${video.videoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block rounded-md overflow-visible hover-elevate"
                    data-testid={`card-video-${video.videoId}`}
                  >
                    {/* Thumbnail */}
                    <div className="relative aspect-video rounded-md overflow-hidden bg-muted">
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      {/* Duration badge */}
                      {video.duration && (
                        <div className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1 rounded">
                          {video.duration}
                        </div>
                      )}
                      {/* Source badge */}
                      <div className="absolute top-1 left-1">
                        <Badge 
                          variant="secondary" 
                          className="text-[10px] bg-black/60 text-white border-0"
                        >
                          {video.source === 'home_feed' ? 'Home' : 
                           video.source === 'sidebar_recommendation' ? 'Sidebar' : 
                           video.source}
                        </Badge>
                      </div>
                    </div>
                    
                    {/* Video info */}
                    <div className="pt-2 space-y-1">
                      <h4 className="text-sm font-medium line-clamp-2 leading-tight group-hover:text-blue-500 dark:group-hover:text-blue-400">
                        {video.title}
                      </h4>
                      <p className="text-xs text-muted-foreground truncate">
                        {video.channelName}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {video.viewCountText && (
                          <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            {video.viewCountText}
                          </span>
                        )}
                        {video.uploadTime && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {video.uploadTime}
                          </span>
                        )}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Video className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No videos collected yet.</p>
                <p className="text-xs mt-1">
                  Browse YouTube with the extension installed to start collecting videos.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Customize how EchoBreaker looks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Theme</Label>
                <p className="text-sm text-muted-foreground">
                  Select your preferred color scheme
                </p>
              </div>
              <Select value={theme} onValueChange={(value: "light" | "dark" | "system") => setTheme(value)}>
                <SelectTrigger className="w-[180px]" data-testid="select-theme">
                  <SelectValue placeholder="Select theme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">
                    <div className="flex items-center gap-2">
                      <Sun className="h-4 w-4" />
                      Light
                    </div>
                  </SelectItem>
                  <SelectItem value="dark">
                    <div className="flex items-center gap-2">
                      <Moon className="h-4 w-4" />
                      Dark
                    </div>
                  </SelectItem>
                  <SelectItem value="system">
                    <div className="flex items-center gap-2">
                      <Monitor className="h-4 w-4" />
                      System
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5" />
              Developer Mode
            </CardTitle>
            <CardDescription>Test features without real data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="constellation-test">3D Constellation Test Mode</Label>
                <p className="text-sm text-muted-foreground">
                  Show sample data in the 3D visualization without real video data
                </p>
              </div>
              <Switch
                id="constellation-test"
                checked={constellationTestMode}
                onCheckedChange={setConstellationTestMode}
                data-testid="switch-constellation-test"
              />
            </div>
            {constellationTestMode && (
              <div className="text-sm text-orange-600 dark:text-orange-400 bg-orange-500/10 rounded-md p-3">
                Test mode is active. The Analysis page will show sample videos in the 3D constellation.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sync Settings</CardTitle>
            <CardDescription>Control how data is collected from YouTube</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="auto-sync">Auto Sync</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically sync data when browsing YouTube
                </p>
              </div>
              <Switch
                id="auto-sync"
                checked={autoSync}
                onCheckedChange={setAutoSync}
                data-testid="switch-auto-sync"
              />
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Sync Interval (minutes)</Label>
                <span className="text-sm text-muted-foreground">{syncInterval[0]} min</span>
              </div>
              <Slider
                value={syncInterval}
                onValueChange={setSyncInterval}
                min={5}
                max={60}
                step={5}
                disabled={!autoSync}
                data-testid="slider-sync-interval"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recommendation Preferences</CardTitle>
            <CardDescription>Customize how recommendations are generated</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Diversity Level</Label>
                  <p className="text-sm text-muted-foreground">
                    How different should recommendations be from your usual content?
                  </p>
                </div>
                <span className="text-sm font-medium">{diversityLevel[0]}%</span>
              </div>
              <Slider
                value={diversityLevel}
                onValueChange={setDiversityLevel}
                min={10}
                max={100}
                step={10}
                data-testid="slider-diversity"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Similar</span>
                <span>Balanced</span>
                <span>Very Different</span>
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="notifications">Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified about new recommendations and analysis updates
                </p>
              </div>
              <Switch
                id="notifications"
                checked={notificationsEnabled}
                onCheckedChange={setNotificationsEnabled}
                data-testid="switch-notifications"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data Management</CardTitle>
            <CardDescription>Export or delete your data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Export Data</Label>
                <p className="text-sm text-muted-foreground">
                  Download all your data as a JSON file
                </p>
              </div>
              <Button 
                variant="outline" 
                onClick={() => exportDataMutation.mutate()}
                disabled={exportDataMutation.isPending}
                className="gap-2"
                data-testid="button-export-data"
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-destructive">Delete All Data</Label>
                <p className="text-sm text-muted-foreground">
                  Permanently delete all your data including videos, analysis, and snapshots
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="gap-2" data-testid="button-delete-data">
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete all your data
                      including collected videos, analysis results, snapshots, and recommendations.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => clearDataMutation.mutate()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      data-testid="button-confirm-delete"
                    >
                      Delete Everything
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Chrome Extension</CardTitle>
            <CardDescription>Install and connect the browser extension</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                The Chrome extension is required to collect YouTube data and perform background playback.
                Download the extension files and load them in Chrome as an unpacked extension.
              </p>
              <div className="flex items-center gap-4">
                <Button variant="outline" className="gap-2" data-testid="button-download-extension">
                  <Download className="h-4 w-4" />
                  Download Extension
                </Button>
                <a 
                  href="https://developer.chrome.com/docs/extensions/mv3/getstarted/development-basics/#load-unpacked"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  How to install
                </a>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="h-5 w-5" />
                  AI Selector Discovery
                </CardTitle>
                <CardDescription>
                  Monitor AI-powered DOM selector detection (Gemini)
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => refetchSelectors()}
                disabled={selectorsLoading}
                data-testid="button-refresh-selectors"
              >
                <RefreshCw className={`h-4 w-4 ${selectorsLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Cached Selectors</Label>
                <Badge variant="secondary">
                  {cachedSelectors ? Object.keys(cachedSelectors).length : 0} cached
                </Badge>
              </div>
              
              {selectorsLoading ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
              ) : cachedSelectors && Object.keys(cachedSelectors).length > 0 ? (
                <ScrollArea className="h-[200px] rounded-md border p-3">
                  <div className="space-y-3">
                    {Object.entries(cachedSelectors).map(([key, selector]) => (
                      <div key={key} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs font-mono">
                            {key}
                          </Badge>
                        </div>
                        <code className="block text-xs bg-muted p-2 rounded font-mono break-all">
                          {selector}
                        </code>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-sm text-muted-foreground border rounded-md p-4 text-center">
                  No AI-generated selectors cached yet.
                  <br />
                  <span className="text-xs">
                    Selectors will appear here when YouTube DOM changes and AI discovers new ones.
                  </span>
                </div>
              )}

              <Separator />

              <div className="space-y-2">
                <Label>How it works</Label>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Extension tries cached selectors first</li>
                  <li>Falls back to default selectors if cache misses</li>
                  <li>After 2+ failures, AI (Gemini) analyzes the page</li>
                  <li>New selectors are cached for 24 hours</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
