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
    <div className="bg-gradient-to-br from-white via-slate-50 to-blue-50 dark:from-slate-800 dark:via-slate-750 dark:to-slate-800 rounded-2xl border-2 border-blue-200/50 dark:border-blue-500/20 shadow-2xl backdrop-blur-sm">
      <div className="px-8 py-6 border-b border-blue-200/50 dark:border-blue-500/20 bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-900/20 dark:to-purple-900/20">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              🎯 Upcoming Games
            </h2>
            <p className="text-slate-600 dark:text-slate-300 font-medium">⚡ Pregame odds from multiple sportsbooks</p>
          </div>
          <Button
            variant="outline"
            size="lg"
            className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white border-0 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 font-semibold px-6 py-3"
            onClick={() => syncOddsMutation.mutate()}
            disabled={syncOddsMutation.isPending}
            data-testid="button-refresh-odds"
          >
            {syncOddsMutation.isPending ? (
              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            ) : (
              <RefreshCw className="w-5 h-5 mr-2" />
            )}
            🔄 Refresh
          </Button>
        </div>
      </div>
      
      {!games?.length ? (
        <div className="p-16 text-center">
          <div className="mb-8">
            <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center animate-pulse">
              <span className="text-4xl">🎮</span>
            </div>
            <div className="text-xl font-semibold text-slate-600 dark:text-slate-300 mb-4">No games available for this sport</div>
            <div className="text-slate-500 dark:text-slate-400">🔍 Try syncing odds to load fresh data</div>
          </div>
          <Button 
            className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 font-semibold px-8 py-4 text-lg"
            onClick={() => syncOddsMutation.mutate()}
            disabled={syncOddsMutation.isPending}
            data-testid="button-sync-odds"
          >
            📡 Sync Odds from API
          </Button>
        </div>
      ) : (
        <div className="p-6">
          <div className="grid gap-6">
            {games.map((game) => (
              <div key={game.id} className="group relative bg-gradient-to-r from-white via-slate-50 to-white dark:from-slate-800 dark:via-slate-750 dark:to-slate-800 rounded-2xl border-2 border-slate-200/50 dark:border-slate-600/30 hover:border-blue-400/50 dark:hover:border-blue-500/50 shadow-lg hover:shadow-2xl hover:shadow-blue-500/25 transition-all duration-500 transform hover:scale-[1.02] p-6">
                {/* Game Header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="text-2xl font-black text-slate-900 dark:text-white" data-testid={`text-game-${game.id}`}>
                        🏆 {game.awayTeam} @ {game.homeTeam}
                      </div>
                      <div className="px-3 py-1 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-sm font-bold rounded-full shadow-md">
                        {game.sportId}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300" data-testid={`text-time-${game.id}`}>
                      <span className="text-lg">📅</span>
                      <span className="font-semibold">{formatDateTime(game.commenceTime)}</span>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex items-center space-x-3">
                    {isAuthenticated && (
                      <button
                        className={`p-3 rounded-xl transition-all duration-300 transform hover:scale-110 shadow-lg ${
                          isFavorited(game.id) 
                            ? "bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-red-500/50" 
                            : "bg-white/80 dark:bg-slate-700/80 hover:bg-red-50 dark:hover:bg-red-900/20 border-2 border-red-200 dark:border-red-500/30"
                        }`}
                        onClick={() => toggleFavoriteMutation.mutate(game.id)}
                        disabled={toggleFavoriteMutation.isPending}
                        title="Toggle favorite"
                        data-testid={`button-favorite-${game.id}`}
                      >
                        <Heart className="w-5 h-5" />
                      </button>
                    )}
                    <button
                      className="p-3 rounded-xl bg-white/80 dark:bg-slate-700/80 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-500/30 transition-all duration-300 transform hover:scale-110 shadow-lg hover:shadow-blue-500/50"
                      title="View line history"
                      data-testid={`button-history-${game.id}`}
                    >
                      <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </button>
                  </div>
                </div>
                
                {/* Odds Section */}
                <div className="grid grid-cols-3 gap-6 mt-6">
                  <div className="text-center bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-4 border-2 border-green-200/50 dark:border-green-500/30">
                    <div className="text-green-700 dark:text-green-400 font-bold text-sm mb-2">📊 SPREAD</div>
                    <div className="text-2xl font-black text-green-800 dark:text-green-300 mb-1">-</div>
                    <div className="text-sm text-green-600 dark:text-green-400">Coming Soon</div>
                  </div>
                  
                  <div className="text-center bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl p-4 border-2 border-blue-200/50 dark:border-blue-500/30">
                    <div className="text-blue-700 dark:text-blue-400 font-bold text-sm mb-2">🎯 TOTAL</div>
                    <div className="text-2xl font-black text-blue-800 dark:text-blue-300 mb-1">-</div>
                    <div className="text-sm text-blue-600 dark:text-blue-400">Coming Soon</div>
                  </div>
                  
                  <div className="text-center bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-4 border-2 border-purple-200/50 dark:border-purple-500/30">
                    <div className="text-purple-700 dark:text-purple-400 font-bold text-sm mb-2">💰 MONEYLINE</div>
                    <div className="text-2xl font-black text-purple-800 dark:text-purple-300 mb-1">-</div>
                    <div className="text-sm text-purple-600 dark:text-purple-400">Coming Soon</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
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
