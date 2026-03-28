import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import { apiRouter } from './routes/index.js';

export function createApp() {
  const app = express();
  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json());

  app.get('/', (_, res) => {
    res.send('Trasa backend ready');
  });

  app.use('/api', apiRouter);

  return app;
}
