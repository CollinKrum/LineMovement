import { useState } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, TrendingUp, Bell, Zap } from "lucide-react";

export default function Landing() {
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();

  async function handleStart() {
    setLoading(true);
    try {
      // Seed with SportsDataIO data instead of arbitrage
      await apiRequest("POST", "/seed/sportsdata?limit=10&sport=NFL");
    } catch (err) {
      // non-blocking: still take the user to dashboard even if seed fails
      console.error("Seeding failed:", err);
    } finally {
      setLoading(false);
      setLocation("/dashboard");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 border-b border-blue-500/20 shadow-2xl backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center">
              <div className="relative">
                <h1 className="text-3xl font-black bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent animate-pulse">
                  🏆 LineTracker Pro
                </h1>
                <div className="absolute -inset-2 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-lg blur-sm -z-10"></div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                className="text-white hover:bg-white/10 border border-white/20 hover:border-white/40 transition-all duration-300"
                onClick={() => (window.location.href = "/api/login")}
                data-testid="button-signin"
              >
                Sign In
              </Button>
              <Button
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
                onClick={() => (window.location.href = "/api/login")}
                data-testid="button-signup"
              >
                🚀 Get Started
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-slate-900 via-blue-900 to-purple-900 py-32 overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute bottom-1/4 left-1/3 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl animate-pulse delay-2000"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="mb-8">
              <span className="inline-block bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-2 rounded-full text-sm font-semibold shadow-lg animate-bounce">
                🔥 Powered by SportsDataIO API
              </span>
            </div>
            <h1 className="text-5xl md:text-7xl font-black mb-8">
              <span className="bg-gradient-to-r from-white via-blue-200 to-purple-200 bg-clip-text text-transparent">
                Track Sports Betting
              </span>
              <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent block animate-pulse">
                Line Movements ⚡
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-blue-100/90 mb-12 max-w-4xl mx-auto leading-relaxed">
              🎯 Real-time odds tracking, line movement alerts, and comprehensive sports data
              across NFL, NBA, MLB, NHL and more. Professional-grade sports analytics platform.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <Button
                size="lg"
                className="text-xl px-12 py-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-2xl hover:shadow-blue-500/25 transform hover:scale-110 transition-all duration-300 border-2 border-blue-400/50 inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={handleStart}
                disabled={loading}
                data-testid="button-start-tracking"
              >
                {loading && (
                  <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                )}
                {loading ? "Loading NFL Data..." : "🚀 Start Tracking Lines"}
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="text-xl px-12 py-6 bg-white/10 hover:bg-white/20 text-white border-2 border-white/30 hover:border-white/50 backdrop-blur-sm shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300"
                data-testid="button-view-demo"
              >
                📊 View Demo
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-32 bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-slate-900 dark:via-blue-900 dark:to-purple-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-slate-200/50 dark:bg-grid-slate-700/25 -z-10"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center mb-20">
            <div className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-full text-sm font-semibold shadow-lg mb-6">
              ✨ SportsDataIO Powered Features
            </div>
            <h2 className="text-4xl md:text-6xl font-black mb-6">
              <span className="bg-gradient-to-r from-slate-900 to-blue-600 dark:from-white dark:to-blue-400 bg-clip-text text-transparent">
                Professional Sports Data
              </span>
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent block">
                At Your Fingertips 🎯
              </span>
            </h2>
            <p className="text-xl md:text-2xl text-slate-600 dark:text-slate-300">
              Comprehensive sports analytics for serious professionals
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="group relative overflow-hidden bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-2 border-transparent hover:border-blue-500/50 transition-all duration-500 transform hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/25">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <CardContent className="relative p-8 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:shadow-blue-500/50 transition-all duration-300 group-hover:animate-bounce">
                  <BarChart3 className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-3 bg-gradient-to-r from-slate-900 to-blue-600 dark:from-white dark:to-blue-400 bg-clip-text text-transparent">
                  📊 Live Game Data
                </h3>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  Real-time scores, odds, and game information across all major sports leagues
                </p>
              </CardContent>
            </Card>

            <Card className="group relative overflow-hidden bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-2 border-transparent hover:border-orange-500/50 transition-all duration-500 transform hover:scale-105 hover:shadow-2xl hover:shadow-orange-500/25">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <CardContent className="relative p-8 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:shadow-orange-500/50 transition-all duration-300 group-hover:animate-bounce">
                  <TrendingUp className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-3 bg-gradient-to-r from-slate-900 to-orange-600 dark:from-white dark:to-orange-400 bg-clip-text text-transparent">
                  📈 Player Statistics
                </h3>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  Comprehensive player stats, performance metrics, and historical data
                </p>
              </CardContent>
            </Card>

            <Card className="group relative overflow-hidden bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-2 border-transparent hover:border-green-500/50 transition-all duration-500 transform hover:scale-105 hover:shadow-2xl hover:shadow-green-500/25">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <CardContent className="relative p-8 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:shadow-green-500/50 transition-all duration-300 group-hover:animate-bounce">
                  <Bell className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-3 bg-gradient-to-r from-slate-900 to-green-600 dark:from-white dark:to-green-400 bg-clip-text text-transparent">
                  🏆 Team Standings
                </h3>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  Up-to-date team rankings, standings, and league position tracking
                </p>
              </CardContent>
            </Card>

            <Card className="group relative overflow-hidden bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-2 border-transparent hover:border-purple-500/50 transition-all duration-500 transform hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/25">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <CardContent className="relative p-8 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:shadow-purple-500/50 transition-all duration-300 group-hover:animate-bounce">
                  <Zap className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-3 bg-gradient-to-r from-slate-900 to-purple-600 dark:from-white dark:to-purple-400 bg-clip-text text-transparent">
                  ⚡ Betting Odds
                </h3>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  Professional-grade betting odds and line movement tracking
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-32 bg-gradient-to-r from-slate-900 via-blue-900 to-purple-900 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/6 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/6 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
            <div className="group">
              <div className="relative inline-block mb-4">
                <div className="text-6xl md:text-7xl font-black bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent animate-pulse group-hover:scale-110 transition-transform duration-300">
                  8+
                </div>
                <div className="absolute -inset-4 bg-blue-500/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
              <div className="text-xl md:text-2xl text-blue-100 font-semibold">
                📊 Major Sports Leagues
              </div>
            </div>
            <div className="group">
              <div className="relative inline-block mb-4">
                <div className="text-6xl md:text-7xl font-black bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent animate-pulse group-hover:scale-110 transition-transform duration-300">
                  24/7
                </div>
                <div className="absolute -inset-4 bg-purple-500/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
              <div className="text-xl md:text-2xl text-purple-100 font-semibold">
                🔴 Real-Time Updates
              </div>
            </div>
            <div className="group">
              <div className="relative inline-block mb-4">
                <div className="text-6xl md:text-7xl font-black bg-gradient-to-r from-cyan-400 to-green-400 bg-clip-text text-transparent animate-pulse group-hover:scale-110 transition-transform duration-300">
                  Pro
                </div>
                <div className="absolute -inset-4 bg-cyan-500/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
              <div className="text-xl md:text-2xl text-cyan-100 font-semibold">
                🏆 Grade Data Quality
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 bg-gradient-to-br from-blue-600 via-purple-600 to-cyan-600 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-white/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-white/10 backdrop-blur-sm rounded-3xl border border-white/20 p-12 shadow-2xl">
            <div className="mb-8">
              <span className="inline-block bg-white/20 text-white px-6 py-2 rounded-full text-sm font-semibold shadow-lg animate-bounce">
                🚀 Powered by SportsDataIO
              </span>
            </div>
            <h2 className="text-4xl md:text-6xl font-black text-white mb-6">
              Ready to Access
              <span className="block bg-gradient-to-r from-yellow-300 to-orange-300 bg-clip-text text-transparent">
                Professional Sports Data? 🎯
              </span>
            </h2>
            <p className="text-xl md:text-2xl text-white/90 mb-12 max-w-4xl mx-auto leading-relaxed">
              Join professionals who rely on accurate, real-time sports data. Get access to comprehensive stats, odds, and analytics across all major leagues!
            </p>
            <Button
              size="lg"
              className="text-2xl px-16 py-8 bg-white hover:bg-gray-100 text-blue-600 shadow-2xl hover:shadow-white/25 transform hover:scale-110 transition-all duration-300 border-4 border-white/50 hover:border-white font-black"
              onClick={() => (window.location.href = "/api/login")}
              data-testid="button-get-started-cta"
            >
              🎉 Get Started - It's Free!
            </Button>
            <p className="text-white/70 text-sm mt-6">✨ No credit card required • 🔒 Secure signup</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-4">LineTracker Pro</h3>
              <p className="text-sm text-muted-foreground">
                Professional sports data platform powered by SportsDataIO API for accurate, real-time information.
              </p>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-3">Features</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Live Game Data</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Player Statistics</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Team Standings</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Betting Odds</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-3">Sports</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">NFL</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">NBA</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">MLB</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">NHL</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-3">Support</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">API Docs</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Contact Us</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Terms</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border mt-8 pt-8 flex flex-col sm:flex-row justify-between items-center">
            <p className="text-sm text-muted-foreground">© 2025 LineTracker Pro. All rights reserved.</p>
            <div className="flex items-center space-x-4 mt-4 sm:mt-0">
              <span className="text-xs text-muted-foreground">Powered by SportsDataIO</span>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-xs text-green-600">Live Data</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
