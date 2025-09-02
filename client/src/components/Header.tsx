import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user } = useAuth();

  return (
    <header className="bg-card border-b border-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-primary">LineTracker Pro</h1>
          </div>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-8">
            <a href="#" className="text-foreground hover:text-primary font-medium transition-colors">Dashboard</a>
            <a href="#" className="text-muted-foreground hover:text-primary font-medium transition-colors">Big Movers</a>
            <a href="#" className="text-muted-foreground hover:text-primary font-medium transition-colors">Favorites</a>
            <a href="#" className="text-muted-foreground hover:text-primary font-medium transition-colors">Alerts</a>
          </nav>
          
          {/* User Menu */}
          <div className="hidden md:flex items-center space-x-4">
            {user && (
              <div className="flex items-center space-x-3">
                {user.profileImageUrl && (
                  <img 
                    src={user.profileImageUrl} 
                    alt="Profile" 
                    className="w-8 h-8 rounded-full object-cover"
                    data-testid="img-user-avatar"
                  />
                )}
                <span className="text-sm font-medium" data-testid="text-user-name">
                  {user.firstName || user.email}
                </span>
              </div>
            )}
            <Button 
              variant="ghost"
              onClick={() => window.location.href = '/api/logout'}
              data-testid="button-logout"
            >
              Sign Out
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
