import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Game, UserAlert } from "@shared/schema";

export default function QuickAlerts() {
  const [selectedGame, setSelectedGame] = useState("");
  const [alertType, setAlertType] = useState("");
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: games } = useQuery<Game[]>({
    queryKey: ["/api/games"],
    enabled: isAuthenticated,
  });

  const { data: alerts } = useQuery<(UserAlert & { game: Game })[]>({
    queryKey: ["/api/alerts"],
    enabled: isAuthenticated,
  });

  const createAlertMutation = useMutation({
    mutationFn: async () => {
      if (!selectedGame || !alertType) {
        throw new Error("Please select a game and alert type");
      }

      await apiRequest("POST", "/api/alerts", {
        gameId: selectedGame,
        market: alertType,
        threshold: 1.0, // Default threshold
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      setSelectedGame("");
      setAlertType("");
      toast({
        title: "Alert Created",
        description: "You will be notified of significant line movements.",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to create alert",
        variant: "destructive",
      });
    },
  });

  if (!isAuthenticated) {
    return (
      <div className="bg-card rounded-lg border border-border shadow-sm">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-lg font-semibold">Quick Alerts</h3>
          <p className="text-sm text-muted-foreground">Get notified of line movements</p>
        </div>
        
        <div className="p-6 text-center">
          <p className="text-muted-foreground mb-4">Sign in to set up alerts</p>
          <Button onClick={() => window.location.href = '/api/login'} data-testid="button-signin-alerts">
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border border-border shadow-sm">
      <div className="px-6 py-4 border-b border-border">
        <h3 className="text-lg font-semibold">Quick Alerts</h3>
        <p className="text-sm text-muted-foreground">Get notified of line movements</p>
      </div>
      
      <div className="p-6 space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Team/Game</label>
          <Select value={selectedGame} onValueChange={setSelectedGame}>
            <SelectTrigger data-testid="select-game">
              <SelectValue placeholder="Select a game" />
            </SelectTrigger>
            <SelectContent>
              {games?.slice(0, 5).map((game) => (
                <SelectItem key={game.id} value={game.id}>
                  {game.awayTeam} @ {game.homeTeam}
                </SelectItem>
              ))}
              {!games?.length && (
                <SelectItem value="demo">Sample Game</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium">Alert Type</label>
          <Select value={alertType} onValueChange={setAlertType}>
            <SelectTrigger data-testid="select-alert-type">
              <SelectValue placeholder="Select alert type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="spreads">Spread movement ±1 point</SelectItem>
              <SelectItem value="totals">Total movement ±1.5 points</SelectItem>
              <SelectItem value="h2h">Moneyline movement ±15</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <Button
          className="w-full"
          onClick={() => createAlertMutation.mutate()}
          disabled={createAlertMutation.isPending || !selectedGame || !alertType}
          data-testid="button-create-alert"
        >
          {createAlertMutation.isPending ? "Creating..." : "Create Alert"}
        </Button>
        
        <div className="pt-2 border-t border-border">
          <div className="text-xs text-muted-foreground">
            Active alerts: <span className="font-medium" data-testid="text-alert-count">
              {alerts?.length || 0}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
