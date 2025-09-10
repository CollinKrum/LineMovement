import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes.js";

const app = express();

/** CORS (keep * while testing; later set to your production domain) */
const allowed = (process.env.CORS_ORIGIN || "*")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowed.includes("*") || allowed.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    },
  })
);

/** Body parsers */
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

/** Simple API request logging */
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on("finish", () => {
    if (req.path.startsWith("/api")) {
      const ms = Date.now() - start;
      console.log(`${req.method} ${req.path} ${res.statusCode} in ${ms}ms`);
    }
  });
  next();
});

/** Health check */
app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, provider: "SportsDataIO" });
});

/** Register all API routes */
registerRoutes(app);

/** Centralized error handler */
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err?.status || err?.statusCode || 500;
  const message = err?.message || "Internal Server Error";
  res.status(status).json({ message });
  console.error(err);
});

/** Start server */
const port = parseInt(process.env.PORT || "8080", 10);
app.listen(port, "0.0.0.0", () => {
  console.log(`🚀 LineTracker API listening on :${port}`);
  console.log(`📊 Powered by SportsDataIO`);
  console.log(`🔑 API Key: ${process.env.SPORTSDATAIO_API_KEY ? 'Set' : 'Missing'}`);
});

// Simple browser UI at "/"
app.get("/", (_req, res) => {
  res.type("html").send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>LineTracker – Sports Data Platform</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 20px; background: #0b0f17; color: #e6e9ee; }
    h1 { margin: 0 0 12px; background: linear-gradient(45deg, #3b82f6, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .controls { margin: 8px 0 16px; display: flex; gap: 8px; align-items: center; }
    table { border-collapse: collapse; width: 100%; background: #1e293b; border-radius: 8px; overflow: hidden; }
    th, td { border-bottom: 1px solid #334155; padding: 12px; }
    th { background: #0f172a; text-align: left; font-weight: 600; }
    tbody tr:hover td { background: rgba(59, 130, 246, 0.1); }
    .badge { background: #22c55e; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; }
    .muted { color: #94a3b8; }
    select, button { background: #334155; color: #e2e8f0; border: 1px solid #475569; border-radius: 6px; padding: 8px 12px; }
    button { cursor: pointer; transition: all 0.2s; }
    button:hover { background: #475569; border-color: #64748b; }
  </style>
</head>
<body>
  <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
    <h1>🏆 LineTracker API</h1>
    <span class="badge">SportsDataIO</span>
  </div>
  
  <div class="controls">
    <label>Sport:
      <select id="sport">
        <option value="NFL" selected>NFL</option>
        <option value="NBA">NBA</option>
        <option value="MLB">MLB</option>
        <option value="NHL">NHL</option>
        <option value="NCAAF">NCAAF</option>
        <option value="NCAAB">NCAAB</option>
      </select>
    </label>
    <label>Limit:
      <input id="limit" type="number" min="1" max="50" value="10" />
    </label>
    <button id="sync">Sync Data</button>
    <button id="refresh">View Games</button>
    <span id="status" class="muted"></span>
  </div>
  
  <table id="tbl">
    <thead>
      <tr>
        <th>Game</th>
        <th>Start Time</th>
        <th>Status</th>
        <th>Score</th>
        <th>Bookmakers</th>
      </tr>
    </thead>
    <tbody></tbody>
  </table>

  <script>
    async function syncData() {
      const sport = document.getElementById('sport').value;
      const limit = document.getElementById('limit').value || 10;
      const status = document.getElementById('status');
      status.textContent = 'Syncing...';
      
      try {
        const res = await fetch('/api/odds/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sport })
        });
        const data = await res.json();
        status.textContent = \`Synced: \${data.gamesUpdated || 0} games, \${data.oddsUpdated || 0} odds\`;
        loadGames();
      } catch (e) {
        status.textContent = 'Sync error: ' + (e.message || e);
      }
    }
    
    async function loadGames() {
      const sport = document.getElementById('sport').value;
      const status = document.getElementById('status');
      status.textContent = 'Loading games...';
      
      try {
        const res = await fetch('/api/games?sport=' + encodeURIComponent(sport));
        const games = await res.json();
        const tbody = document.querySelector('#tbl tbody');
        tbody.innerHTML = '';
        
        games.forEach(g => {
          const tr = document.createElement('tr');
          const score = g.homeScore !== null && g.awayScore !== null 
            ? \`\${g.awayScore}-\${g.homeScore}\` 
            : '-';
          const startTime = new Date(g.commenceTime).toLocaleDateString();
          const status = g.completed ? 'Final' : 'Scheduled';
          
          tr.innerHTML = \`
            <td><strong>\${g.awayTeam}</strong> @ <strong>\${g.homeTeam}</strong></td>
            <td>\${startTime}</td>
            <td>\${status}</td>
            <td>\${score}</td>
            <td>0 books</td>
          \`;
          tbody.appendChild(tr);
        });
        
        status.textContent = \`Loaded \${games.length} games\`;
      } catch (e) {
        status.textContent = 'Load error: ' + (e.message || e);
      }
    }
    
    document.getElementById('sync').addEventListener('click', syncData);
    document.getElementById('refresh').addEventListener('click', loadGames);
    
    // Auto-load on page load
    loadGames();
  </script>
</body>
</html>`);
});
