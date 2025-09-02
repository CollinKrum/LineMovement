import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, TrendingUp, Bell, Zap } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-primary">LineTracker Pro</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost"
                onClick={() => window.location.href = '/api/login'}
                data-testid="button-signin"
              >
                Sign In
              </Button>
              <Button 
                onClick={() => window.location.href = '/api/login'}
                data-testid="button-signup"
              >
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary/5 via-background to-accent/5 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6">
              Track Sports Betting
              <span className="text-primary block">Line Movements</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
              Real-time odds tracking, line movement alerts, and the best odds comparison 
              across all major sportsbooks. Never miss a profitable betting opportunity again.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="text-lg px-8 py-3"
                onClick={() => window.location.href = '/api/login'}
                data-testid="button-start-tracking"
              >
                Start Tracking Lines
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                className="text-lg px-8 py-3"
                data-testid="button-view-demo"
              >
                View Demo
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Everything You Need to Track Lines
            </h2>
            <p className="text-xl text-muted-foreground">
              Professional-grade tools for serious sports bettors
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="text-center p-6">
              <CardContent className="pt-6">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Real-Time Odds</h3>
                <p className="text-muted-foreground text-sm">
                  Live odds from 8+ major sportsbooks updated every 30 seconds
                </p>
              </CardContent>
            </Card>

            <Card className="text-center p-6">
              <CardContent className="pt-6">
                <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="w-6 h-6 text-accent" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Line Movement</h3>
                <p className="text-muted-foreground text-sm">
                  Track and visualize how betting lines move throughout the day
                </p>
              </CardContent>
            </Card>

            <Card className="text-center p-6">
              <CardContent className="pt-6">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Bell className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Smart Alerts</h3>
                <p className="text-muted-foreground text-sm">
                  Get notified instantly when lines move beyond your thresholds
                </p>
              </CardContent>
            </Card>

            <Card className="text-center p-6">
              <CardContent className="pt-6">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Best Odds</h3>
                <p className="text-muted-foreground text-sm">
                  Automatically find the best odds across all sportsbooks
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-primary mb-2">8+</div>
              <div className="text-lg text-muted-foreground">Sportsbooks Tracked</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">24/7</div>
              <div className="text-lg text-muted-foreground">Live Monitoring</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">5</div>
              <div className="text-lg text-muted-foreground">Major Sports</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Ready to Start Tracking Lines?
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join thousands of bettors who use LineTracker Pro to find the best odds and track line movements.
          </p>
          <Button 
            size="lg" 
            className="text-lg px-8 py-3"
            onClick={() => window.location.href = '/api/login'}
            data-testid="button-get-started-cta"
          >
            Get Started - It's Free
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-4">LineTracker Pro</h3>
              <p className="text-sm text-muted-foreground">
                Real-time sports betting odds and line movement tracking across all major sportsbooks.
              </p>
            </div>
            
            <div>
              <h4 className="text-sm font-semibold mb-3">Features</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Live Odds</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Line Movement</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Alerts</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Best Odds</a></li>
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
              <span className="text-xs text-muted-foreground">Powered by The Odds API</span>
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
