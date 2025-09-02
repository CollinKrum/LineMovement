import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Heart, BarChart3, RefreshCw } from "lucide-react";
import type { Game, UserFavorite } from "@shared/schema";

export default function GamesList() {
  const [selectedSport, setSelectedSport] = useState("americanfootball_nfl");
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: games, isLoading: gamesLoading } = useQuery<Game[]>({
    queryKey: ["/api/games", selectedSport],
    enabled: !!selectedSport,
  });

  const { data: favorites } = useQuery<(UserFavorite & { game: Game })[]>({
    queryKey: ["/api/favorites"],
    enabled: isAuthenticated,
  });

  const syncOddsMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/odds/sync", { sport: selectedSport });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      toast({
        title: "Success",
        description: "Odds updated successfully",
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
        description: "Failed to sync odds",
        variant: "destructive",
      });
    },
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: async (gameId: string) => {
      await apiRequest("POST", "/api/favorites/toggle", { gameId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
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
        description: "Failed to update favorite",
        variant: "destructive",
      });
    },
  });

  const isFavorited = (gameId: string) => {
    return favorites?.some(fav => fav.gameId === gameId) || false;
  };

  const formatDateTime = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  };

  if (gamesLoading) {
    return (
      <div className="bg-card rounded-lg border border-border shadow-sm">
        <div className="px-6 py-4 border-b border-border">
          <div className="h-6 bg-muted animate-pulse rounded w-1/3 mb-2" />
          <div className="h-4 bg-muted animate-pulse rounded w-1/2" />
        </div>
        <div className="p-6 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border border-border shadow-sm">
      <div className="px-6 py-4 border-b border-border">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold">Upcoming Games</h2>
            <p className="text-sm text-muted-foreground">Pregame odds from multiple sportsbooks</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncOddsMutation.mutate()}
            disabled={syncOddsMutation.isPending}
            data-testid="button-refresh-odds"
          >
            {syncOddsMutation.isPending ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Refresh
          </Button>
        </div>
      </div>
      
      {!games?.length ? (
        <div className="p-12 text-center">
          <div className="text-muted-foreground mb-4">No games available for this sport</div>
          <Button 
            onClick={() => syncOddsMutation.mutate()}
            disabled={syncOddsMutation.isPending}
            data-testid="button-sync-odds"
          >
            Sync Odds from API
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto mobile-scroll">
          <table className="w-full odds-table">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Game</th>
                <th className="text-center px-3 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Spread</th>
                <th className="text-center px-3 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Total</th>
                <th className="text-center px-3 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Moneyline</th>
                <th className="text-center px-3 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {games.map((game) => (
                <tr key={game.id} className="hover:bg-muted/25 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div>
                        <div className="text-sm font-medium" data-testid={`text-game-${game.id}`}>
                          {game.awayTeam} @ {game.homeTeam}
                        </div>
                        <div className="text-xs text-muted-foreground" data-testid={`text-time-${game.id}`}>
                          {formatDateTime(game.commenceTime)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-4 text-center">
                    <div className="space-y-1">
                      <div className="text-sm">-</div>
                      <div className="text-xs text-muted-foreground">-</div>
                    </div>
                  </td>
                  <td className="px-3 py-4 text-center">
                    <div className="space-y-1">
                      <div className="text-sm">-</div>
                      <div className="text-xs text-muted-foreground">-</div>
                    </div>
                  </td>
                  <td className="px-3 py-4 text-center">
                    <div className="space-y-1">
                      <div className="text-sm">-</div>
                      <div className="text-xs text-muted-foreground">-</div>
                    </div>
                  </td>
                  <td className="px-3 py-4 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      {isAuthenticated && (
                        <button
                          className="p-1 hover:bg-muted rounded transition-colors"
                          onClick={() => toggleFavoriteMutation.mutate(game.id)}
                          disabled={toggleFavoriteMutation.isPending}
                          title="Toggle favorite"
                          data-testid={`button-favorite-${game.id}`}
                        >
                          <Heart 
                            className={`w-4 h-4 ${
                              isFavorited(game.id) 
                                ? "text-accent fill-current" 
                                : "text-muted-foreground hover:text-accent"
                            }`}
                          />
                        </button>
                      )}
                      <button
                        className="p-1 hover:bg-muted rounded transition-colors"
                        title="View line history"
                        data-testid={`button-history-${game.id}`}
                      >
                        <BarChart3 className="w-4 h-4 text-muted-foreground hover:text-primary" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {games?.length > 0 && (
        <div className="px-6 py-4 border-t border-border">
          <button className="text-sm text-primary hover:text-primary/80 font-medium">
            View all games →
          </button>
        </div>
      )}
    </div>
  );
}
