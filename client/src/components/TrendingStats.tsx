import { useQuery } from "@tanstack/react-query";
import { TrendingUp, BarChart3, Zap } from "lucide-react";

interface ApiUsageResponse {
  requests_used: number;
  requests_remaining: number;
}

export default function TrendingStats() {
  const { data: usage } = useQuery<ApiUsageResponse>({
    queryKey: ["/api/usage"],
  });

  // Mock data for demonstration
  const stats = {
    biggestMover: "Sample -3.5",
    biggestMovement: "+1.5 points in 2h",
    activeGames: 24,
    apiCallsUsed: usage?.requests_used || 347,
    apiCallsRemaining: usage?.requests_remaining || 153,
  };

  return (
    <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-card rounded-lg border border-border shadow-sm p-6">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <div className="ml-4">
            <h3 className="text-sm font-medium text-muted-foreground">Biggest Mover</h3>
            <div className="text-2xl font-bold" data-testid="text-biggest-mover">
              {stats.biggestMover}
            </div>
            <p className="text-sm text-green-600" data-testid="text-biggest-movement">
              {stats.biggestMovement}
            </p>
          </div>
        </div>
      </div>
      
      <div className="bg-card rounded-lg border border-border shadow-sm p-6">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <div className="ml-4">
            <h3 className="text-sm font-medium text-muted-foreground">Active Games</h3>
            <div className="text-2xl font-bold" data-testid="text-active-games">
              {stats.activeGames}
            </div>
            <p className="text-sm text-muted-foreground">Across all sports</p>
          </div>
        </div>
      </div>
      
      <div className="bg-card rounded-lg border border-border shadow-sm p-6">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-accent/20 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-accent" />
            </div>
          </div>
          <div className="ml-4">
            <h3 className="text-sm font-medium text-muted-foreground">API Calls Today</h3>
            <div className="text-2xl font-bold" data-testid="text-api-calls">
              {stats.apiCallsUsed}
            </div>
            <p className="text-sm text-muted-foreground" data-testid="text-api-remaining">
              {stats.apiCallsRemaining} remaining
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
