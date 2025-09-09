import { useEffect, useMemo, useState } from "react";

type Game = {
  id: string;
  sportId: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string; // ISO
};

type Best = {
  gameId: string;
  market: string;
  bestHome: OddsSide | null;
  bestAway: OddsSide | null;
  bestOver: OddsSide | null;
  bestUnder: OddsSide | null;
};

type OddsSide = {
  price: string;
  point: string | null;
  bookmakerId: string;
  bookmakerTitle: string | null;
  lastUpdate: string | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

export default function Home() {
  const [sport, setSport] = useState("MLB"); // default
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // cache of best-odds per gameId
  const [bestMap, setBestMap] = useState<Record<string, Best | "loading" | "error">>({});

  const canCallApi = useMemo(() => {
    return API_BASE.startsWith("http");
  }, []);

  useEffect(() => {
    if (!canCallApi) return;
    setLoading(true);
    setError(null);

    const url =
      sport ? `${API_BASE}/api/games?sport=${encodeURIComponent(sport)}` : `${API_BASE}/api/games`;

    fetch(url, { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r.json();
      })
      .then((data: Game[] | { id: string }[]) => {
        // Some backends might return objects with extra props; coerce minimally
        const normalized = (data as any[]).map((g) => ({
          id: String(g.id),
          sportId: String(g.sportId ?? ""),
          homeTeam: String(g.homeTeam ?? ""),
          awayTeam: String(g.awayTeam ?? ""),
          commenceTime: String(g.commenceTime ?? ""),
        }));
        setGames(normalized);
      })
      .catch((e: any) => {
        setError(`Failed to load games: ${String(e?.message || e)}`);
      })
      .finally(() => setLoading(false));
  }, [sport, canCallApi]);

  const fetchBestFor = async (gameId: string, market = "point_spread") => {
    if (!canCallApi) return;
    setBestMap((m) => ({ ...m, [gameId]: "loading" }));
    try {
      const res = await fetch(
        `${API_BASE}/api/games/${encodeURIComponent(gameId)}/best-odds?market=${encodeURIComponent(
          market
        )}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const best = (await res.json()) as Best;
      setBestMap((m) => ({ ...m, [gameId]: best }));
    } catch (e: any) {
      setBestMap((m) => ({ ...m, [gameId]: "error" }));
    }
  };

  if (!canCallApi) {
    return (
      <Wrap>
        <Card>
          <h1>LineTracker</h1>
          <p style={{ color: "crimson" }}>
            NEXT_PUBLIC_API_BASE is not set to a valid URL. Set it in Vercel env vars and redeploy.
          </p>
        </Card>
      </Wrap>
    );
  }

  return (
    <Wrap>
      <Card>
        <Header>
          <h1>LineTracker — Best Odds</h1>
          <HealthBadge />
        </Header>

        <Controls>
          <label>
            Sport:&nbsp;
            <select value={sport} onChange={(e) => setSport(e.target.value)}>
              <option>MLB</option>
              <option>NFL</option>
              <option>NBA</option>
              <option>NHL</option>
              <option>NCAAF</option>
              <option>NCAAB</option>
              <option>MLS</option>
              <option>UEFA_CHAMPIONS_LEAGUE</option>
            </select>
          </label>
        </Controls>

        {loading && <p>Loading games…</p>}
        {error && <p style={{ color: "crimson" }}>{error}</p>}

        {!loading && !error && games.length === 0 && <p>No games found.</p>}

        {games.length > 0 && (
          <Table>
            <thead>
              <tr>
                <th>Match</th>
                <th>Start</th>
                <th>Market</th>
                <th style={{ minWidth: 120 }}>Best Home</th>
                <th style={{ minWidth: 120 }}>Best Away</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {games.map((g) => {
                const best = bestMap[g.id];
                const market = "point_spread";

                return (
                  <tr key={g.id}>
                    <td>
                      <strong>{g.awayTeam}</strong> @ <strong>{g.homeTeam}</strong>
                    </td>
                    <td>{new Date(g.commenceTime).toLocaleString()}</td>
                    <td>{market}</td>
                    <td>
                      {best === "loading"
                        ? "Loading…"
                        : best === "error"
                        ? "Error"
                        : best && (best as Best).bestHome
                        ? renderSide((best as Best).bestHome!)
                        : "—"}
                    </td>
                    <td>
                      {best === "loading"
                        ? "Loading…"
                        : best === "error"
                        ? "Error"
                        : best && (best as Best).bestAway
                        ? renderSide((best as Best).bestAway!)
                        : "—"}
                    </td>
                    <td>
                      <button onClick={() => fetchBestFor(g.id, market)}>Load Best</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
      <style jsx global>{`
        :root {
          color-scheme: dark;
        }
        body {
          margin: 0;
          font-family: -apple-system, system-ui, Segoe UI, Roboto, Inter, Helvetica, Arial, sans-serif;
          background: #0b0f17;
          color: #e6e9ee;
        }
        select,
        button {
          background: #141b26;
          color: #e6e9ee;
          border: 1px solid #223047;
          border-radius: 8px;
          padding: 8px 10px;
        }
        button {
          cursor: pointer;
        }
        button:hover {
          border-color: #2f4466;
        }
      `}</style>
    </Wrap>
  );
}

function renderSide(side: OddsSide) {
  return (
    <div>
      <div><strong>{side.price}</strong>{side.point ? ` @ ${side.point}` : ""}</div>
      <small>{side.bookmakerTitle || side.bookmakerId}</small>
      {side.lastUpdate ? <div><small>{new Date(side.lastUpdate).toLocaleString()}</small></div> : null}
    </div>
  );
}

function HealthBadge() {
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    const url = `${API_BASE}/api/health`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => setOk(!!(j?.ok && j?.db?.ok)))
      .catch(() => setOk(false));
  }, []);

  const bg = ok == null ? "#444" : ok ? "#124c2c" : "#5d1f1f";
  const label = ok == null ? "checking…" : ok ? "healthy" : "degraded";

  return (
    <span style={{ background: bg, padding: "6px 10px", borderRadius: 999, fontSize: 12 }}>
      API: {label}
    </span>
  );
}

/* ——— tiny styled helpers ——— */

function Wrap({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>{children}</div>;
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "linear-gradient(180deg, #0f1522 0%, #0c121d 100%)",
        border: "1px solid #1e2a3f",
        borderRadius: 16,
        padding: 20,
        boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
      }}
    >
      {children}
    </div>
  );
}

function Header({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "space-between" }}>
      {children}
    </div>
  );
}

function Controls({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", gap: 16, alignItems: "center", margin: "16px 0" }}>{children}</div>;
}

function Table({ children }: { children: React.ReactNode }) {
  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        background: "#0e141f",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      {children}
      <style jsx>{`
        th,
        td {
          border-bottom: 1px solid #1e2a3f;
          padding: 12px;
          text-align: left;
          vertical-align: top;
        }
        thead th {
          background: #0f1725;
          font-weight: 600;
          font-size: 14px;
        }
        tbody tr:hover td {
          background: rgba(255, 255, 255, 0.02);
        }
      `}</style>
    </table>
  );
}
