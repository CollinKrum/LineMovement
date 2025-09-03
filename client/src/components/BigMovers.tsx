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
      <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-2 border-primary/20 shadow-xl">
        <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 border-b border-primary/20">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="p-2 bg-gradient-to-br from-primary to-primary/80 rounded-lg shadow-lg">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <span className="bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent font-bold">
              🔥 Biggest Line Movements
            </span>
          </CardTitle>
          <CardDescription className="text-muted-foreground font-medium">No significant movements detected recently</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <div className="relative mb-6">
              <TrendingUp className="h-16 w-16 mx-auto text-primary/30 animate-pulse" />
              <div className="absolute inset-0 h-16 w-16 mx-auto bg-primary/10 rounded-full animate-ping"></div>
            </div>
            <p className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">
              Watching for big movements...
            </p>
            <p className="text-sm text-muted-foreground">
              🎯 Tracking line changes of 1+ points across all sports
            </p>
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
    if (Math.abs(movement) >= 3) return 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg';
    if (Math.abs(movement) >= 2) return 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md';
    return 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white shadow-md';
  };

  const getMovementGlow = (movement: number) => {
    if (Math.abs(movement) >= 3) return 'shadow-red-500/50';
    if (Math.abs(movement) >= 2) return 'shadow-orange-500/50';
    return 'shadow-yellow-500/50';
  };

  return (
    <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-2 border-primary/20 shadow-xl">
      <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 border-b border-primary/20">
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className="p-2 bg-gradient-to-br from-primary to-primary/80 rounded-lg shadow-lg">
            <TrendingUp className="h-5 w-5 text-white" />
          </div>
          <span className="bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent font-bold">
            🔥 Biggest Line Movements
          </span>
        </CardTitle>
        <CardDescription className="text-muted-foreground font-medium">
          Hot line movements detected in the last 24 hours
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
                className={`relative flex items-center justify-between p-5 border rounded-xl hover:scale-[1.02] transition-all duration-300 bg-gradient-to-r from-white via-slate-50 to-white dark:from-slate-800 dark:via-slate-750 dark:to-slate-800 shadow-lg hover:shadow-xl ${getMovementGlow(Math.abs(movement))} animate-in slide-in-from-left duration-500`}
                data-testid={`big-mover-${mover.id}`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-bold text-base text-slate-900 dark:text-slate-100" data-testid={`matchup-${mover.gameId}`}>
                      {mover.game.awayTeam} @ {mover.game.homeTeam}
                    </h4>
                    <Badge className="bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs font-semibold px-2 py-1 shadow-sm">
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
                    <div className="text-lg font-mono bg-slate-100 dark:bg-slate-700 px-3 py-2 rounded-lg">
                      <span className="text-slate-500 dark:text-slate-400 line-through" data-testid={`old-value-${mover.id}`}>
                        {mover.oldValue}
                      </span>
                      <span className="mx-3 text-slate-400">→</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100 text-xl" data-testid={`new-value-${mover.id}`}>
                        {mover.newValue}
                      </span>
                    </div>
                  </div>
                  
                  <Badge 
                    className={`${getMovementColor(Math.abs(movement))} flex items-center gap-2 font-mono text-base px-4 py-2 animate-pulse hover:animate-none transition-all`}
                    data-testid={`movement-badge-${mover.id}`}
                  >
                    {isPositive ? (
                      <TrendingUp className="h-4 w-4 animate-bounce" />
                    ) : (
                      <TrendingDown className="h-4 w-4 animate-bounce" />
                    )}
                    <span className="font-bold text-lg">
                      {isPositive ? '+' : ''}{movement.toFixed(1)}
                    </span>
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