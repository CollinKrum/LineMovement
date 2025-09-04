import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";

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

