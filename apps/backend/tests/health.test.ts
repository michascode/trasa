import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';

test('GET /api/health should return status ok', async () => {
  const app = createApp();
  const response = await request(app).get('/api/health');

  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'ok');
});

test('GET / should return backend ready message', async () => {
  const app = createApp();
  const response = await request(app).get('/');

  assert.equal(response.status, 200);
  assert.match(response.text, /Trasa backend ready/);
});
