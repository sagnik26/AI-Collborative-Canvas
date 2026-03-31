import type { Request, Response } from 'express';

export function helloController(_req: Request, res: Response) {
  res.json({ message: 'Hello from backend!' });
}
