import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface BiasMeterProps {
  score: number; // 0-100, 50 is balanced
  politicalLeaning?: string;
  summary?: string;
}

function getScoreLabel(score: number): { label: string; color: string } {
  if (score <= 20) return { label: "Heavily Left", color: "text-blue-600 dark:text-blue-400" };
  if (score <= 35) return { label: "Left-Leaning", color: "text-blue-500 dark:text-blue-300" };
  if (score <= 45) return { label: "Slightly Left", color: "text-cyan-600 dark:text-cyan-400" };
  if (score <= 55) return { label: "Balanced", color: "text-green-600 dark:text-green-400" };
  if (score <= 65) return { label: "Slightly Right", color: "text-orange-500 dark:text-orange-400" };
  if (score <= 80) return { label: "Right-Leaning", color: "text-red-500 dark:text-red-400" };
  return { label: "Heavily Right", color: "text-red-600 dark:text-red-400" };
}

export function BiasMeter({ score, politicalLeaning, summary }: BiasMeterProps) {
  const { label, color } = getScoreLabel(score);
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-4">
          <span>Content Bias Score</span>
          <span className={`text-2xl font-bold ${color}`} data-testid="text-bias-score">{score}</span>
        </CardTitle>
        <CardDescription>
          Analysis of your content consumption patterns
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-blue-600 dark:text-blue-400">Left</span>
            <span className={`font-medium ${color}`}>{label}</span>
            <span className="text-red-600 dark:text-red-400">Right</span>
          </div>
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-gradient-to-r from-blue-500 via-green-500 to-red-500">
            <div 
              className="absolute top-0 h-full w-1 bg-white shadow-lg transition-all duration-500"
              style={{ left: `calc(${score}% - 2px)` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0</span>
            <span>50</span>
            <span>100</span>
          </div>
        </div>

        {politicalLeaning && (
          <div className="rounded-lg bg-muted p-4">
            <span className="text-sm font-medium">Political Leaning: </span>
            <span className="text-sm text-muted-foreground capitalize">{politicalLeaning}</span>
          </div>
        )}

        {summary && (
          <div className="space-y-2">
            <span className="text-sm font-medium">Analysis Summary</span>
            <p className="text-sm text-muted-foreground leading-relaxed">{summary}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
