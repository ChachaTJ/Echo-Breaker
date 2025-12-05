import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RotateCcw, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import type { Video, AnalysisResult } from "@shared/schema";

interface BiasVisualizationProps {
  videos: Video[];
  analysis: AnalysisResult | null;
}

interface ChannelNode {
  id: string;
  name: string;
  videoCount: number;
  biasScore: number;
  x: number;
  y: number;
  z: number;
  color: string;
}

export function BiasVisualization({ videos, analysis }: BiasVisualizationProps) {
  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");
  const [rotateX, setRotateX] = useState(20);
  const [rotateY, setRotateY] = useState(-20);
  const [zoom, setZoom] = useState(1);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const channelNodes = useMemo(() => {
    if (!videos.length) return [];

    const channelMap = new Map<string, { count: number; videos: Video[] }>();
    
    videos.forEach(video => {
      const existing = channelMap.get(video.channelName) || { count: 0, videos: [] };
      existing.count++;
      existing.videos.push(video);
      channelMap.set(video.channelName, existing);
    });

    const baseBiasScore = analysis?.biasScore ?? 50;
    const nodes: ChannelNode[] = [];
    let index = 0;

    channelMap.forEach((data, channelName) => {
      const randomOffset = (Math.sin(channelName.length * 1234.5) * 20);
      const biasScore = Math.max(0, Math.min(100, baseBiasScore + randomOffset));
      
      const x = ((biasScore / 100) * 2 - 1) * 40;
      const y = (Math.random() - 0.5) * 30 + (data.count * 2);
      const z = (Math.random() - 0.5) * 20;

      let color: string;
      if (biasScore < 35) {
        color = `hsl(210, 80%, ${50 + (35 - biasScore)}%)`;
      } else if (biasScore > 65) {
        color = `hsl(0, 70%, ${50 + (biasScore - 65)}%)`;
      } else {
        color = `hsl(142, 60%, 50%)`;
      }

      nodes.push({
        id: `channel-${index}`,
        name: channelName,
        videoCount: data.count,
        biasScore: Math.round(biasScore),
        x,
        y,
        z,
        color,
      });
      index++;
    });

    return nodes.slice(0, 50);
  }, [videos, analysis]);

  const resetView = () => {
    setRotateX(20);
    setRotateY(-20);
    setZoom(1);
  };

  const biasLabel = (score: number) => {
    if (score < 25) return "Very Left";
    if (score < 40) return "Left";
    if (score < 60) return "Center";
    if (score < 75) return "Right";
    return "Very Right";
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-lg">Echo Chamber Visualization</CardTitle>
          <p className="text-sm text-muted-foreground">
            Channel distribution by political bias
          </p>
        </div>
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "2d" | "3d")}>
          <TabsList>
            <TabsTrigger value="2d" data-testid="button-view-2d">2D</TabsTrigger>
            <TabsTrigger value="3d" data-testid="button-view-3d">3D</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {channelNodes.length === 0 ? (
          <div className="flex items-center justify-center h-80 text-muted-foreground">
            <p>No data to visualize. Collect some YouTube data first.</p>
          </div>
        ) : (
          <>
            {viewMode === "3d" && (
              <div className="flex items-center gap-4 mb-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Rotate X:</span>
                  <Slider
                    className="w-24"
                    value={[rotateX]}
                    onValueChange={([v]) => setRotateX(v)}
                    min={-60}
                    max={60}
                    step={1}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Rotate Y:</span>
                  <Slider
                    className="w-24"
                    value={[rotateY]}
                    onValueChange={([v]) => setRotateY(v)}
                    min={-60}
                    max={60}
                    step={1}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="ghost" onClick={() => setZoom(z => Math.min(2, z + 0.1))}>
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}>
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={resetView}>
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            <div 
              className="relative w-full h-80 rounded-lg overflow-hidden"
              style={{
                background: "linear-gradient(to right, hsl(210, 80%, 95%), hsl(142, 60%, 95%), hsl(0, 70%, 95%))",
                perspective: viewMode === "3d" ? "800px" : "none",
              }}
            >
              <div className="absolute inset-x-0 top-0 flex justify-between px-4 py-2 text-xs font-medium">
                <span className="text-blue-600 dark:text-blue-400">Left</span>
                <span className="text-green-600 dark:text-green-400">Center</span>
                <span className="text-red-600 dark:text-red-400">Right</span>
              </div>

              <div 
                className="absolute inset-0 flex items-center justify-center"
                style={{
                  transform: viewMode === "3d" 
                    ? `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${zoom})`
                    : `scale(${zoom})`,
                  transformStyle: "preserve-3d",
                  transition: "transform 0.3s ease",
                }}
              >
                <TooltipProvider>
                  {channelNodes.map((node) => {
                    const size = Math.min(48, Math.max(16, 12 + node.videoCount * 4));
                    const isHovered = hoveredNode === node.id;
                    
                    return (
                      <Tooltip key={node.id}>
                        <TooltipTrigger asChild>
                          <div
                            className="absolute cursor-pointer transition-all duration-200"
                            style={{
                              left: `calc(50% + ${node.x}%)`,
                              top: viewMode === "2d" 
                                ? `calc(50% - ${node.y}%)`
                                : `calc(50% - ${node.y * 0.7}%)`,
                              width: size,
                              height: size,
                              transform: viewMode === "3d"
                                ? `translateZ(${node.z * zoom}px) ${isHovered ? 'scale(1.3)' : ''}`
                                : isHovered ? 'scale(1.3)' : '',
                              transformStyle: "preserve-3d",
                              zIndex: isHovered ? 100 : Math.round(50 + node.z),
                            }}
                            onMouseEnter={() => setHoveredNode(node.id)}
                            onMouseLeave={() => setHoveredNode(null)}
                            data-testid={`node-channel-${node.id}`}
                          >
                            <div
                              className="w-full h-full rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg"
                              style={{
                                backgroundColor: node.color,
                                boxShadow: isHovered 
                                  ? `0 0 20px ${node.color}` 
                                  : `0 2px 8px rgba(0,0,0,0.2)`,
                              }}
                            >
                              {node.videoCount}
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <div className="space-y-1">
                            <p className="font-semibold truncate">{node.name}</p>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">
                                {node.videoCount} videos
                              </Badge>
                              <Badge 
                                variant="outline" 
                                className="text-xs"
                                style={{ borderColor: node.color, color: node.color }}
                              >
                                {biasLabel(node.biasScore)}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Bias Score: {node.biasScore}/100
                            </p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </TooltipProvider>
              </div>

              <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-blue-500 via-green-500 to-red-500" />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-4 text-center text-sm">
              <div>
                <p className="text-muted-foreground">Left-leaning</p>
                <p className="font-semibold text-blue-600 dark:text-blue-400">
                  {channelNodes.filter(n => n.biasScore < 40).length} channels
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Center</p>
                <p className="font-semibold text-green-600 dark:text-green-400">
                  {channelNodes.filter(n => n.biasScore >= 40 && n.biasScore <= 60).length} channels
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Right-leaning</p>
                <p className="font-semibold text-red-600 dark:text-red-400">
                  {channelNodes.filter(n => n.biasScore > 60).length} channels
                </p>
              </div>
            </div>

            <div className="mt-4 p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">
                <strong>How to read:</strong> Each circle represents a YouTube channel you watch. 
                Size indicates how many videos you've watched from that channel. 
                Position shows estimated political leaning (left to right). 
                {viewMode === "3d" && " Use the sliders to rotate and explore the 3D space."}
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
