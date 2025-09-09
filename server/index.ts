import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes.js";

const app = express();

/** CORS (keep * while testing; later set to https://app.LINETRACKER.NET) */
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

/** Simple API request logging (no res.json override) */
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
  res.json({ ok: true });
});

/** Register all API routes (mutates the app, returns the same app) */
registerRoutes(app);

/** Centralized error handler */
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err?.status || err?.statusCode || 500;
  const message = err?.message || "Internal Server Error";
  res.status(status).json({ message });
  console.error(err);
});

/** Start server (Render provides PORT) */
const port = parseInt(process.env.PORT || "8080", 10);
app.listen(port, "0.0.0.0", () => {
  console.log(`API listening on :${port}`);
});

// Simple browser UI at "/"
app.get("/", (_req, res) => {
  res.type("html").send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>LineMovement – Best Odds</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 20px; }
    h1 { margin: 0 0 12px; }
    .controls { margin: 8px 0 16px; display: flex; gap: 8px; align-items: center; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; }
    th { background: #f7f7f7; text-align: left; }
    code { background:#f4f4f4; padding:2px 4px; border-radius:4px; }
    .muted { color: #777; }
  </style>
</head>
<body>
  <h1>Best Odds (server feed)</h1>
  <div class="controls">
    <label>Market:
      <select id="market">
        <option value="point_spread" selected>point_spread</option>
        <option value="h2h">h2h</option>
        <option value="totals">totals</option>
      </select>
    </label>
    <label>Limit:
      <input id="limit" type="number" min="1" max="100" value="10" />
    </label>
    <button id="refresh">Refresh</button>
    <span id="status" class="muted"></span>
  </div>
  <table id="tbl">
    <thead>
      <tr>
        <th>Start (UTC)</th>
        <th>Sport</th>
        <th>Away</th>
        <th>Home</th>
        <th>Best Home</th>
        <th>Best Away</th>
      </tr>
    </thead>
    <tbody></tbody>
  </table>

  <script>
    async function load() {
      const market = document.getElementById('market').value;
      const limit = document.getElementById('limit').value || 10;
      const status = document.getElementById('status');
      status.textContent = 'Loading...';
      try {
        const res = await fetch('/api/games/with-best?market=' + encodeURIComponent(market) + '&limit=' + encodeURIComponent(limit));
        const data = await res.json();
        const tbody = document.querySelector('#tbl tbody');
        tbody.innerHTML = '';
        (data.games || []).forEach(g => {
          const tr = document.createElement('tr');
          const bestHome = g.bestHome ? \`\${g.bestHome.price} @ \${g.bestHome.bookmakerTitle}\` : '-';
          const bestAway = g.bestAway ? \`\${g.bestAway.price} @ \${g.bestAway.bookmakerTitle}\` : '-';
          tr.innerHTML = \`
            <td>\${g.commenceTime}</td>
            <td>\${g.sportId}</td>
            <td>\${g.awayTeam}</td>
            <td>\${g.homeTeam}</td>
            <td>\${bestHome}</td>
            <td>\${bestAway}</td>
          \`;
          tbody.appendChild(tr);
        });
        status.textContent = \`Loaded \${data.count || 0} games\`;
      } catch (e) {
        status.textContent = 'Error: ' + (e && e.message ? e.message : e);
      }
    }
    document.getElementById('refresh').addEventListener('click', load);
    load();
  </script>
</body>
</html>`);
});
