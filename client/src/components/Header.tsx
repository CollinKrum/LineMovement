import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user } = useAuth();

  return (
    <header className="bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 border-b border-blue-500/20 shadow-2xl backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Logo */}
          <div className="flex items-center">
            <div className="relative">
              <h1 className="text-3xl font-black bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                🏆 LineTracker Pro
              </h1>
              <div className="absolute -inset-2 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-lg blur-sm -z-10"></div>
            </div>
          </div>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-1">
            <a href="#" className="px-4 py-2 text-white bg-blue-600/20 hover:bg-blue-600/40 font-semibold transition-all duration-300 rounded-lg border border-blue-500/30 hover:border-blue-400/60 backdrop-blur-sm shadow-lg">
              📊 Dashboard
            </a>
            <a href="#" className="px-4 py-2 text-blue-200 hover:text-white hover:bg-white/10 font-semibold transition-all duration-300 rounded-lg">
              🔥 Big Movers
            </a>
            <a href="#" className="px-4 py-2 text-blue-200 hover:text-white hover:bg-white/10 font-semibold transition-all duration-300 rounded-lg">
              ❤️ Favorites
            </a>
            <a href="#" className="px-4 py-2 text-blue-200 hover:text-white hover:bg-white/10 font-semibold transition-all duration-300 rounded-lg">
              🔔 Alerts
            </a>
          </nav>
          
          {/* User Menu */}
          <div className="hidden md:flex items-center space-x-4">
            {user && (
              <div className="flex items-center space-x-3 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20">
                {user.profileImageUrl && (
                  <img 
                    src={user.profileImageUrl} 
                    alt="Profile" 
                    className="w-10 h-10 rounded-full object-cover border-2 border-blue-400/50 shadow-lg"
                    data-testid="img-user-avatar"
                  />
                )}
                <span className="text-white font-semibold text-lg" data-testid="text-user-name">
                  👋 {user.firstName || user.email}
                </span>
              </div>
            )}
            <Button 
              variant="ghost"
              className="text-white hover:bg-red-500/20 border border-red-400/30 hover:border-red-400/60 backdrop-blur-sm shadow-lg font-semibold px-6 py-2 transition-all duration-300"
              onClick={() => window.location.href = '/api/logout'}
              data-testid="button-logout"
            >
              🚪 Sign Out
            </Button>
          </div>
          
          {/* Mobile Menu Button */}
          <button 
            className="md:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            data-testid="button-mobile-menu"
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>
      
      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-card">
          <div className="px-4 py-4 space-y-4">
            <a href="#" className="block text-foreground font-medium">Dashboard</a>
            <a href="#" className="block text-muted-foreground">Big Movers</a>
            <a href="#" className="block text-muted-foreground">Favorites</a>
            <a href="#" className="block text-muted-foreground">Alerts</a>
            
            {user && (
              <div className="pt-4 border-t border-border">
                <div className="flex items-center space-x-3 mb-4">
                  {user.profileImageUrl && (
                    <img 
                      src={user.profileImageUrl} 
                      alt="Profile" 
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  )}
                  <span className="text-sm font-medium">
                    {user.firstName || user.email}
                  </span>
                </div>
              </div>
            )}
            
            <Button 
              variant="ghost" 
              className="w-full justify-start"
              onClick={() => window.location.href = '/api/logout'}
              data-testid="button-mobile-logout"
            >
              Sign Out
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
