import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface LineMovement {
  id: string;
  gameId: string;
  market: string;
  oldValue: string;
  newValue: string;
  movement: string;
  timestamp: string;
  game: {
    id: string;
    sportId: string;
    homeTeam: string;
    awayTeam: string;
    commenceTime: string;
    completed: boolean;
    homeScore: number | null;
    awayScore: number | null;
    lastUpdated: string;
  };
}

export default function BigMovers() {
  const { data: bigMovers = [], isLoading } = useQuery<LineMovement[]>({
    queryKey: ["/api/line-movements/big-movers"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Biggest Line Movements
          </CardTitle>
          <CardDescription>Loading significant line movements...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded-lg"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (bigMovers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Biggest Line Movements
          </CardTitle>
          <CardDescription>No significant line movements detected recently</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Line movements will appear here when significant changes occur</p>
            <p className="text-sm mt-1">Looking for movements of 1+ points</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatMarket = (market: string) => {
    switch (market) {
      case 'spreads': return 'Spread';
      case 'totals': return 'Total';
      case 'h2h': return 'Moneyline';
      default: return market;
    }
  };

  const getMovementColor = (movement: number) => {
    if (Math.abs(movement) >= 3) return 'bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100';
    if (Math.abs(movement) >= 2) return 'bg-orange-100 text-orange-900 dark:bg-orange-900 dark:text-orange-100';
    return 'bg-yellow-100 text-yellow-900 dark:bg-yellow-900 dark:text-yellow-100';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Biggest Line Movements
        </CardTitle>
        <CardDescription>
          Significant line changes in the last 24 hours
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {bigMovers.map((mover) => {
            const movement = parseFloat(mover.movement);
            const isPositive = movement > 0;
            
            return (
              <div
                key={mover.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                data-testid={`big-mover-${mover.id}`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-sm" data-testid={`matchup-${mover.gameId}`}>
                      {mover.game.awayTeam} @ {mover.game.homeTeam}
                    </h4>
                    <Badge variant="outline" className="text-xs">
                      {mover.game.sportId}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span data-testid={`market-${mover.id}`}>
                      {formatMarket(mover.market)}
                    </span>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span data-testid={`time-${mover.id}`}>
                        {formatDistanceToNow(new Date(mover.timestamp), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-sm font-mono">
                      <span className="text-muted-foreground" data-testid={`old-value-${mover.id}`}>
                        {mover.oldValue}
                      </span>
                      <span className="mx-2">→</span>
                      <span className="font-bold" data-testid={`new-value-${mover.id}`}>
                        {mover.newValue}
                      </span>
                    </div>
                  </div>
                  
                  <Badge 
                    className={`${getMovementColor(Math.abs(movement))} flex items-center gap-1 font-mono`}
                    data-testid={`movement-badge-${mover.id}`}
                  >
                    {isPositive ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {isPositive ? '+' : ''}{movement.toFixed(1)}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}