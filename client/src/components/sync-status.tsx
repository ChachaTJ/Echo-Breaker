import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle, XCircle, Loader2 } from "lucide-react";

interface SyncStatusProps {
  status: 'idle' | 'syncing' | 'success' | 'error';
  lastSyncTime?: Date | null;
  onSync?: () => void;
  isSyncing?: boolean;
}

export function SyncStatus({ status, lastSyncTime, onSync, isSyncing }: SyncStatusProps) {
  const getStatusInfo = () => {
    switch (status) {
      case 'syncing':
        return {
          icon: <Loader2 className="h-3 w-3 animate-spin" />,
          text: 'Syncing...',
          variant: 'secondary' as const,
        };
      case 'success':
        return {
          icon: <CheckCircle className="h-3 w-3" />,
          text: 'Synced',
          variant: 'default' as const,
        };
      case 'error':
        return {
          icon: <XCircle className="h-3 w-3" />,
          text: 'Sync Failed',
          variant: 'destructive' as const,
        };
      default:
        return {
          icon: null,
          text: 'Not Synced',
          variant: 'outline' as const,
        };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div className="flex items-center gap-3">
      <Badge variant={statusInfo.variant} className="gap-1.5">
        {statusInfo.icon}
        {statusInfo.text}
      </Badge>
      {lastSyncTime && (
        <span className="text-xs text-muted-foreground">
          Last sync: {lastSyncTime.toLocaleTimeString()}
        </span>
      )}
      <Button
        variant="ghost"
        size="icon"
        onClick={onSync}
        disabled={isSyncing}
        data-testid="button-sync"
      >
        <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
      </Button>
    </div>
  );
}
