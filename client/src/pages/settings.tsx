import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Settings as SettingsIcon, Download, Trash2, Moon, Sun, Monitor, Cpu, RefreshCw } from "lucide-react";
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

  // AI Selector Discovery - fetch cached selectors
  const { data: cachedSelectors, isLoading: selectorsLoading, refetch: refetchSelectors } = useQuery<Record<string, string>>({
    queryKey: ['/api/selectors'],
  });

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
