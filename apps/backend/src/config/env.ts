import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(12).optional(),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
});

const parsedEnv = EnvSchema.parse(process.env);
const isTest = parsedEnv.NODE_ENV === 'test';

export const env = {
  ...parsedEnv,
  DATABASE_URL: parsedEnv.DATABASE_URL ?? (isTest ? 'postgresql://test:test@localhost:5432/test' : ''),
  JWT_SECRET: parsedEnv.JWT_SECRET ?? (isTest ? 'test-secret-please-change' : ''),
};
