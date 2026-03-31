import cors from "cors";
import express from "express";
import { registerRoutes } from "./routes.js";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  registerRoutes(app);
  return app;
}

