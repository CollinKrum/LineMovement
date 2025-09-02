import { useQuery } from "@tanstack/react-query";
import type { Odds } from "@shared/schema";

interface BestOddsResponse extends Odds {
  bookmakerTitle: string;
}

export default function SportsbookComparison() {
  // For demo purposes, using mock data. In real implementation, this would use a selected game
  const mockGameId = "demo-game-1";

  const { data: spreadOdds, isLoading: spreadLoading } = useQuery<BestOddsResponse[]>({
    queryKey: ["/api/games", mockGameId, "best-odds", "spreads"],
    enabled: false, // Disabled for demo since we don't have real data yet
  });

  const { data: totalOdds, isLoading: totalLoading } = useQuery<BestOddsResponse[]>({
    queryKey: ["/api/games", mockGameId, "best-odds", "totals"],
    enabled: false, // Disabled for demo since we don't have real data yet
  });

  // Mock data for demonstration
  const mockSpreadOdds = [
    { bookmaker: "DraftKings", odds: "-108", isBest: true },
    { bookmaker: "FanDuel", odds: "-110", isBest: false },
    { bookmaker: "BetMGM", odds: "-112", isBest: false },
  ];

  const mockTotalOdds = [
    { bookmaker: "DraftKings", odds: "-105", isBest: false },
    { bookmaker: "Caesars", odds: "-102", isBest: true },
    { bookmaker: "BetMGM", odds: "-108", isBest: false },
  ];

  return (
    <div className="bg-card rounded-lg border border-border shadow-sm">
      <div className="px-6 py-4 border-b border-border">
        <h3 className="text-lg font-semibold">Best Odds</h3>
        <p className="text-sm text-muted-foreground">Sample Game Comparison</p>
      </div>
      
      <div className="p-6 space-y-4">
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Spread (Sample -3.5)</span>
          </div>
          {spreadLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {mockSpreadOdds.map((odds, index) => (
                <div
                  key={index}
                  className={`flex justify-between items-center p-2 rounded ${
                    odds.isBest
                      ? "bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800"
                      : "bg-muted/50"
                  }`}
                  data-testid={`odds-spread-${odds.bookmaker.toLowerCase()}`}
                >
                  <span className="text-sm">{odds.bookmaker}</span>
                  <span className={`text-sm ${odds.isBest ? "font-semibold text-green-700 dark:text-green-400" : ""}`}>
                    {odds.odds}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Total (Sample O 49.5)</span>
          </div>
          {totalLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {mockTotalOdds.map((odds, index) => (
                <div
                  key={index}
                  className={`flex justify-between items-center p-2 rounded ${
                    odds.isBest
                      ? "bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800"
                      : "bg-muted/50"
                  }`}
                  data-testid={`odds-total-${odds.bookmaker.toLowerCase()}`}
                >
                  <span className="text-sm">{odds.bookmaker}</span>
                  <span className={`text-sm ${odds.isBest ? "font-semibold text-green-700 dark:text-green-400" : ""}`}>
                    {odds.odds}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
