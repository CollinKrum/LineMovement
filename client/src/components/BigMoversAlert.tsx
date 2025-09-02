import { useQuery } from "@tanstack/react-query";
import { TrendingUp } from "lucide-react";
import type { LineMovement, Game } from "@shared/schema";

export default function BigMoversAlert() {
  const { data: bigMovers, isLoading } = useQuery<(LineMovement & { game: Game })[]>({
    queryKey: ["/api/big-movers"],
  });

  if (isLoading) {
    return (
      <div className="mb-6 bg-accent/10 border border-accent/20 rounded-lg p-4 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-5 h-5 bg-accent/30 rounded" />
            <div>
              <div className="h-4 w-32 bg-accent/30 rounded mb-1" />
              <div className="h-3 w-48 bg-accent/20 rounded" />
            </div>
          </div>
          <div className="h-4 w-16 bg-accent/30 rounded" />
        </div>
      </div>
    );
  }

  // Use mock data if no real big movers
  const mockBigMover = {
    game: { awayTeam: "Chiefs", homeTeam: "Bills" },
    market: "spreads",
    oldValue: "2.5",
    newValue: "3.5",
    movement: "1.0",
  };

  const displayMover = bigMovers?.[0] || mockBigMover;

  return (
    <div className="mb-6 bg-accent/10 border border-accent/20 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <TrendingUp className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-accent" data-testid="text-alert-title">
              Big Movers Alert
            </h3>
            <p className="text-sm text-accent/80" data-testid="text-alert-description">
              {bigMovers?.length ? (
                `${displayMover.game.awayTeam} @ ${displayMover.game.homeTeam} ${displayMover.market} moved ${displayMover.movement} points`
              ) : (
                "Sample: Chiefs spread moved from -2.5 to -3.5 in the last hour"
              )}
            </p>
          </div>
        </div>
        <button 
          className="text-accent hover:text-accent/80 text-sm font-medium transition-colors"
          data-testid="button-view-all-movers"
        >
          View All
        </button>
      </div>
    </div>
  );
}
