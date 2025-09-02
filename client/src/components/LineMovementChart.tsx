import { useQuery } from "@tanstack/react-query";
import type { LineMovement } from "@shared/schema";

export default function LineMovementChart() {
  // For demo purposes, using mock data. In real implementation, this would use a selected game
  const mockGameId = "demo-game-1";

  const { data: movements, isLoading } = useQuery<LineMovement[]>({
    queryKey: ["/api/games", mockGameId, "movements"],
    enabled: false, // Disabled for demo since we don't have real data yet
  });

  // Mock data for demonstration
  const mockMovements = [
    { time: "6h ago", value: 40 },
    { time: "4h ago", value: 55 },
    { time: "2h ago", value: 48 },
    { time: "1h ago", value: 62 },
    { time: "30m ago", value: 70 },
    { time: "Now", value: 85 },
  ];

  return (
    <div className="bg-card rounded-lg border border-border shadow-sm">
      <div className="px-6 py-4 border-b border-border">
        <h3 className="text-lg font-semibold">Line Movement</h3>
        <p className="text-sm text-muted-foreground">Sample Game - Spread</p>
      </div>
      
      <div className="p-6">
        {isLoading ? (
          <div className="h-32 bg-muted animate-pulse rounded-lg mb-4" />
        ) : (
          <div className="relative h-32 bg-muted/20 rounded-lg mb-4 overflow-hidden">
            <div className="absolute inset-0 flex items-end justify-between px-2 pb-2">
              {mockMovements.map((point, index) => (
                <div
                  key={index}
                  className={`w-2 rounded-t transition-all duration-300 ${
                    index === mockMovements.length - 1 ? "bg-primary" : "bg-primary/60"
                  }`}
                  style={{ height: `${point.value}%` }}
                  data-testid={`chart-bar-${index}`}
                />
              ))}
            </div>
          </div>
        )}
        
        <div className="flex justify-between text-xs text-muted-foreground mb-4">
          {mockMovements.map((point, index) => (
            <span key={index} data-testid={`chart-label-${index}`}>
              {point.time}
            </span>
          ))}
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Opening Line:</span>
            <span className="font-medium" data-testid="text-opening-line">Sample -2.5</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Current Line:</span>
            <span className="font-medium" data-testid="text-current-line">Sample -3.5</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Movement:</span>
            <span className="font-medium text-green-600" data-testid="text-movement">+1.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}
