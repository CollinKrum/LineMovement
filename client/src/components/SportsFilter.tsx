import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Sport } from "@shared/schema";

export default function SportsFilter() {
  const [activeSport, setActiveSport] = useState("americanfootball_nfl");

  const { data: sports, isLoading } = useQuery<Sport[]>({
    queryKey: ["/api/sports"],
  });

  if (isLoading) {
    return (
      <div className="mb-6">
        <div className="border-b border-border">
          <div className="flex space-x-8 overflow-x-auto">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 w-16 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const defaultSports = [
    { id: 'americanfootball_nfl', title: 'NFL' },
    { id: 'basketball_nba', title: 'NBA' },
    { id: 'baseball_mlb', title: 'MLB' },
    { id: 'icehockey_nhl', title: 'NHL' },
    { id: 'americanfootball_ncaaf', title: 'NCAAF' },
  ];

  const sportsToShow = sports?.length ? sports : defaultSports;

  return (
    <div className="mb-6">
      <div className="border-b border-border">
        <nav className="flex space-x-8 overflow-x-auto mobile-scroll" aria-label="Sports">
          {sportsToShow.map((sport) => (
            <button
              key={sport.id}
              className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeSport === sport.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveSport(sport.id)}
              data-testid={`button-sport-${sport.id}`}
            >
              {sport.title}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
