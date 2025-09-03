import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import SportsFilter from "@/components/SportsFilter";
import GamesList from "@/components/GamesList";
import SportsbookComparison from "@/components/SportsbookComparison";
import LineMovementChart from "@/components/LineMovementChart";
import BigMovers from "@/components/BigMovers";
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-slate-900 dark:via-blue-950 dark:to-purple-950">
      <Header />
      
      {/* Dashboard Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/6 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-1/3 right-1/6 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute bottom-1/4 left-1/3 w-72 h-72 bg-cyan-500/5 rounded-full blur-3xl animate-pulse delay-2000"></div>
      </div>
      
      <main className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Welcome Section */}
        <div className="text-center py-8">
          <h1 className="text-4xl md:text-5xl font-black mb-4">
            <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-cyan-600 bg-clip-text text-transparent">
              🎯 Sports Betting Dashboard
            </span>
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-300 font-medium">
            Real-time line tracking and betting intelligence at your fingertips
          </p>
        </div>
        
        <SportsFilter />
        
        <BigMovers />
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <GamesList />
          </div>
          
          <div className="space-y-8">
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
