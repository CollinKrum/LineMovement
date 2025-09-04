import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";

const app = express();

/** CORS (lock down later to your domain) */
const allowed = (process.env.CORS_ORIGIN || "*")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Allow server-to-server / curl (no origin) and any whitelisted origin
    if (!origin || allowed.includes("*") || allowed.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  }
}));

/** Body parsers */
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

/** Simple request logging for API routes */
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const path = req.path;
  let capturedJson: unknown;

  const originalJson = res.json.bind(res);
  (res as any).json = (body: any, ...args: any[]) => {
    capturedJson = body;
    return originalJson(body, ...args);
  };

  res.on("finish", () => {
    if (path.startsWith("/api")) {
      const ms = Date.now() - start;
      let line = `${req.method} ${path} ${res.statusCode} in ${ms}ms`;
      if (capturedJson) {
        const stub = JSON.stringify(capturedJson);
        line += ` :: ${stub.length > 120 ? stub.slice(0, 119) + "…" : stub}`;
      }
      console.log(line);
    }
  });

  next();
});

/** Health check */
app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true });
});

/** Register API routes */
const server = registerRoutes(app);

/** Error handler */
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err?.status || err?.statusCode || 500;
  const message = err?.message || "Internal Server Error";
  res.status(status).json({ message });
  // Log to stderr so Render surfaces it
  console.error(err);
});

/** Start server (Render sets PORT) */
const port = parseInt(process.env.PORT || "8080", 10);
server.listen(
  { port, host: "0.0.0.0", reusePort: true } as any,
  () => {
    console.log(`API listening on :${port}`);
  }
);

