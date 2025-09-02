import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import SportsFilter from "@/components/SportsFilter";
import GamesList from "@/components/GamesList";
import SportsbookComparison from "@/components/SportsbookComparison";
import LineMovementChart from "@/components/LineMovementChart";
import BigMoversAlert from "@/components/BigMoversAlert";
import QuickAlerts from "@/components/QuickAlerts";
import TrendingStats from "@/components/TrendingStats";

export default function Dashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
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
  }, [isAuthenticated, isLoading, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <SportsFilter />
        
        <BigMoversAlert />
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <GamesList />
          </div>
          
          <div className="space-y-6">
            <SportsbookComparison />
            <LineMovementChart />
            <QuickAlerts />
          </div>
        </div>
        
        <TrendingStats />
      </main>
    </div>
  );
}
