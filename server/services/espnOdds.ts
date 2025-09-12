export type OddsQuote = {
  book: string;
  market: "moneyline" | "spreads" | "totals";
  team?: "home" | "away";
  price?: number | null;
  point?: number | null;
  updated: string;
};

export type GameOdds = {
  eventId: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  quotes: OddsQuote[];
  best: {
    moneylineHome?: OddsQuote | null;
    moneylineAway?: OddsQuote | null;
    spreadHome?: OddsQuote | null;
    spreadAway?: OddsQuote | null;
    overTotal?: OddsQuote | null;
    underTotal?: OddsQuote | null;
  };
};

type OddsResult = Record<string, GameOdds>;

// ===== Fetch helpers =====
async function getJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      }
    });
    if (!res.ok) {
      console.warn(`Failed to fetch ${url}: ${res.status}`);
      return null;
    }
    const text = await res.text();
    try { 
      return JSON.parse(text); 
    } catch (e) {
      console.warn(`Failed to parse JSON from ${url}`);
      return null;
    }
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    return null;
  }
}

async function expandOne(obj: any): Promise<any> {
  if (!obj) return obj;
  
  const ref = obj?.$ref || obj?.href;
  if (typeof ref === 'string' && ref.startsWith('http')) {
    const expanded = await getJson(ref);
    return expanded ?? obj;
  }
  return obj;
}

function toNum(v: any): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'string' ? Number(v) : (typeof v === 'number' ? v : NaN);
  return Number.isFinite(n) ? n : null;
}

// Resolve competition ID from event
async function resolveCompetitionId(eventId: string): Promise<string> {
  const base = "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl";
  const ev = await getJson(`${base}/events/${eventId}`);
  
  if (ev?.competitions?.[0]) {
    const comp = ev.competitions[0];
    if (comp.id) return String(comp.id);
    
    const compRef = comp.$ref;
    if (typeof compRef === 'string') {
      const expanded = await getJson(compRef);
      if (expanded?.id) return String(expanded.id);
      
      // Extract from URL as last resort
      const parts = compRef.split('/');
      const cid = parts[parts.length - 1];
      if (cid && cid !== 'competitions') return cid;
    }
  }
  
  // Fallback: often compId === eventId
  return eventId;
}

// ===== Main function: Get NFL odds with all markets =====
export async function getNflOddsToday(): Promise<OddsResult> {
  console.log('🏈 Fetching NFL odds from ESPN...');
  
  const sb = await getJson("https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard");
  const out: OddsResult = {};
  
  if (!sb?.events?.length) {
    console.log('No events found in scoreboard');
    return out;
  }

  console.log(`Found ${sb.events.length} NFL events`);

  for (const ev of sb.events) {
    const eventId: string | undefined = ev?.id;
    if (!eventId) continue;

    // Get team names from the event
    const homeTeam = ev?.competitions?.[0]?.competitors?.find((c: any) => c.homeAway === 'home')?.team?.displayName || 'Home';
    const awayTeam = ev?.competitions?.[0]?.competitors?.find((c: any) => c.homeAway === 'away')?.team?.displayName || 'Away';
    const commenceTime = ev?.date || new Date().toISOString();

    let compId: string | undefined = ev?.competitions?.[0]?.id;
    
    // Resolve compId if missing
    if (!compId) {
      compId = await resolveCompetitionId(eventId);
    }

    const oddsUrl = `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/events/${eventId}/competitions/${compId}/odds`;
    console.log(`Fetching odds for ${awayTeam} @ ${homeTeam} (${eventId})`);
    
    const oddsRoot = await getJson(oddsUrl);

    const items: any[] =
      Array.isArray(oddsRoot) ? oddsRoot :
      Array.isArray(oddsRoot?.items) ? oddsRoot.items :
      [];

    const quotes: OddsQuote[] = [];

    for (const item of items) {
      // Expand provider references
      const prov = await expandOne(item);
      if (!prov) continue;

      const providerName =
        prov?.provider?.name ||
        prov?.provider?.displayName ||
        prov?.name ||
        prov?.displayName ||
        'Unknown';

      const updated = prov?.lastModified || prov?.updated || new Date().toISOString();

      // --- Case A: Direct fields (moneyline, spread, total) ---
      
      // Moneyline
      const ml = prov?.moneyline;
      if (ml && (ml.home != null || ml.away != null)) {
        if (ml.home != null) {
          quotes.push({ 
            book: providerName, 
            market: "moneyline", 
            team: "home", 
            price: toNum(ml.home), 
            updated 
          });
        }
        if (ml.away != null) {
          quotes.push({ 
            book: providerName, 
            market: "moneyline", 
            team: "away", 
            price: toNum(ml.away), 
            updated 
          });
        }
      }

      // Spread
      const spread = prov?.spread;
      if (spread) {
        if (spread.home != null) {
          quotes.push({ 
            book: providerName, 
            market: "spreads", 
            team: "home", 
            price: toNum(spread.homeOdds || -110),
            point: toNum(spread.home),
            updated 
          });
        }
        if (spread.away != null) {
          quotes.push({ 
            book: providerName, 
            market: "spreads", 
            team: "away", 
            price: toNum(spread.awayOdds || -110),
            point: toNum(spread.away),
            updated 
          });
        }
      }

      // Total (Over/Under)
      const total = prov?.total || prov?.overUnder;
      if (total) {
        const totalValue = toNum(total.total || total.value || total);
        if (totalValue != null) {
          quotes.push({ 
            book: providerName, 
            market: "totals", 
            team: "home", // "over" pseudo-team
            price: toNum(total.overOdds || -110),
            point: totalValue,
            updated 
          });
          quotes.push({ 
            book: providerName, 
            market: "totals", 
            team: "away", // "under" pseudo-team
            price: toNum(total.underOdds || -110),
            point: totalValue,
            updated 
          });
        }
      }

      // --- Case B: Markets array ---
      const markets: any[] = Array.isArray(prov?.markets) ? prov.markets :
                             Array.isArray(prov?.odds) ? prov.odds : [];

      for (const m0 of markets) {
        const m = await expandOne(m0);
        if (!m) continue;

        const marketType = String(m?.type || m?.key || m?.name || '').toLowerCase();
        
        let market: "moneyline" | "spreads" | "totals" | null = null;
        if (marketType.includes('moneyline') || marketType === 'ml') {
          market = "moneyline";
        } else if (marketType.includes('spread') || marketType.includes('point')) {
          market = "spreads";
        } else if (marketType.includes('total') || marketType.includes('over')) {
          market = "totals";
        }

        if (!market) continue;

        const outcomes: any[] = Array.isArray(m?.outcomes) ? m.outcomes : [];
        
        for (const o0 of outcomes) {
          const o = await expandOne(o0);
          if (!o) continue;

          let team: "home" | "away" | undefined;
          
          if (market === "totals") {
            // For totals, map over/under to home/away for consistency
            const outcomeName = String(o?.name || o?.type || '').toLowerCase();
            team = outcomeName.includes('over') ? "home" : 
                   outcomeName.includes('under') ? "away" : undefined;
          } else {
            // For moneyline and spreads
            team = o?.homeAway === 'home' ? "home" :
                   o?.homeAway === 'away' ? "away" :
                   String(o?.name || '').toLowerCase().includes('home') ? "home" :
                   String(o?.name || '').toLowerCase().includes('away') ? "away" :
                   String(o?.name || '').toLowerCase() === homeTeam.toLowerCase() ? "home" :
                   String(o?.name || '').toLowerCase() === awayTeam.toLowerCase() ? "away" :
                   undefined;
          }

          const price = toNum(o?.price || o?.odds || o?.americanOdds || o?.moneyline);
          const point = market === "spreads" ? toNum(o?.spread || o?.pointSpread || o?.line) :
                       market === "totals" ? toNum(o?.total || o?.overUnder || m?.total) :
                       null;

          if (team && price !== null) {
            quotes.push({ 
              book: providerName, 
              market, 
              team, 
              price, 
              point,
              updated 
            });
          }
        }
      }
    }

    // Calculate best odds
    const best: GameOdds['best'] = {};
    
    // Best moneyline
    const mlHome = quotes.filter(q => q.market === "moneyline" && q.team === "home");
    const mlAway = quotes.filter(q => q.market === "moneyline" && q.team === "away");
    best.moneylineHome = mlHome.reduce((best, q) => 
      !best || (q.price && q.price > (best.price || -Infinity)) ? q : best, null as OddsQuote | null);
    best.moneylineAway = mlAway.reduce((best, q) => 
      !best || (q.price && q.price > (best.price || -Infinity)) ? q : best, null as OddsQuote | null);
    
    // Best spreads (most favorable)
    const spreadHome = quotes.filter(q => q.market === "spreads" && q.team === "home");
    const spreadAway = quotes.filter(q => q.market === "spreads" && q.team === "away");
    best.spreadHome = spreadHome.reduce((best, q) => 
      !best || (q.point && best.point && q.point > best.point) ? q : best, null as OddsQuote | null);
    best.spreadAway = spreadAway.reduce((best, q) => 
      !best || (q.point && best.point && q.point > best.point) ? q : best, null as OddsQuote | null);
    
    // Best totals
    const overTotal = quotes.filter(q => q.market === "totals" && q.team === "home");
    const underTotal = quotes.filter(q => q.market === "totals" && q.team === "away");
    best.overTotal = overTotal[0] || null;
    best.underTotal = underTotal[0] || null;

    out[eventId] = { 
      eventId,
      homeTeam,
      awayTeam,
      commenceTime,
      quotes, 
      best 
    };
  }

  console.log(`✅ Processed ${Object.keys(out).length} events with odds`);
  return out;
}

// ===== Transform ESPN odds to your DB format =====
export function transformEspnToDbFormat(espnOdds: OddsResult, sport: string = "NFL"): any[] {
  const events: any[] = [];
  
  for (const [eventId, data] of Object.entries(espnOdds)) {
    // Group quotes by bookmaker
    const bookmakerMap = new Map<string, OddsQuote[]>();
    
    for (const quote of data.quotes) {
      if (!bookmakerMap.has(quote.book)) {
        bookmakerMap.set(quote.book, []);
      }
      bookmakerMap.get(quote.book)!.push(quote);
    }
    
    // Transform to your expected format
    const bookmakers: any[] = [];
    
    for (const [bookName, bookQuotes] of bookmakerMap) {
      const markets: any[] = [];
      
      // Group by market type
      const marketGroups = {
        moneyline: bookQuotes.filter(q => q.market === "moneyline"),
        spreads: bookQuotes.filter(q => q.market === "spreads"),
        totals: bookQuotes.filter(q => q.market === "totals"),
      };
      
      // Transform each market
      for (const [marketKey, marketQuotes] of Object.entries(marketGroups)) {
        if (marketQuotes.length === 0) continue;
        
        const outcomes = marketQuotes.map(q => {
          let name = q.team;
          if (marketKey === "totals") {
            name = q.team === "home" ? "Over" : "Under";
          } else if (marketKey === "moneyline" || marketKey === "spreads") {
            name = q.team === "home" ? data.homeTeam : data.awayTeam;
          }
          
          return {
            name,
            price: q.price || 0,
            point: q.point || null,
          };
        });
        
        markets.push({
          key: marketKey === "moneyline" ? "h2h" : marketKey,
          last_update: marketQuotes[0].updated,
          outcomes,
        });
      }
      
      if (markets.length > 0) {
        bookmakers.push({
          key: bookName.toLowerCase().replace(/\s+/g, '_'),
          title: bookName,
          last_update: bookQuotes[0].updated,
          markets,
        });
      }
    }
    
    events.push({
      id: `espn_${eventId}`,
      sport_key: sport,
      sport_title: sport,
      commence_time: data.commenceTime,
      home_team: data.homeTeam,
      away_team: data.awayTeam,
      completed: false,
      bookmakers,
    });
  }
  
  return events;
}

// ===== Debug helper =====
export async function debugEspnOdds() {
  console.log('\n🔍 ESPN Odds Debug Report\n' + '='.repeat(50));
  
  const odds = await getNflOddsToday();
  const eventCount = Object.keys(odds).length;
  
  console.log(`\n📊 Summary:`);
  console.log(`  • Total events: ${eventCount}`);
  
  if (eventCount > 0) {
    let totalQuotes = 0;
    let eventsWithOdds = 0;
    const bookmakers = new Set<string>();
    const markets = new Set<string>();
    
    for (const data of Object.values(odds)) {
      if (data.quotes.length > 0) eventsWithOdds++;
      totalQuotes += data.quotes.length;
      data.quotes.forEach(q => {
        bookmakers.add(q.book);
        markets.add(q.market);
      });
    }
    
    console.log(`  • Events with odds: ${eventsWithOdds}`);
    console.log(`  • Total quotes: ${totalQuotes}`);
    console.log(`  • Unique bookmakers: ${bookmakers.size}`);
    console.log(`  • Markets found: ${Array.from(markets).join(', ')}`);
    
    // Sample event details
    const [firstId, firstData] = Object.entries(odds)[0];
    console.log(`\n📌 Sample Event:`);
    console.log(`  • ID: ${firstId}`);
    console.log(`  • ${firstData.awayTeam} @ ${firstData.homeTeam}`);
    console.log(`  • Time: ${new Date(firstData.commenceTime).toLocaleString()}`);
    console.log(`  • Quotes: ${firstData.quotes.length}`);
    
    if (firstData.best.moneylineHome) {
      console.log(`  • Best ML Home: ${firstData.best.moneylineHome.price} (${firstData.best.moneylineHome.book})`);
    }
    if (firstData.best.moneylineAway) {
      console.log(`  • Best ML Away: ${firstData.best.moneylineAway.price} (${firstData.best.moneylineAway.book})`);
    }
  }
  
  console.log('\n' + '='.repeat(50));
  return odds;
}
