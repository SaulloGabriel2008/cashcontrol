import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files (index.html, assets, etc.)
app.use(express.static(__dirname));

import analysisHandler from './api/analysis.js';
import uploadPDFHandler from './api/uploadPDF.js';
import resetPasswordHandler from './api/resetPassword.js';

async function runHandler(handler, req, res, label) {
  try {
    await handler(req, res);
  } catch (err) {
    console.error(`${label} route error`, err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Primary API routes (same shape used in production on Vercel)
app.post('/api/analysis', async (req, res) => runHandler(analysisHandler, req, res, 'analysis'));
app.post('/api/uploadPDF', async (req, res) => runHandler(uploadPDFHandler, req, res, 'uploadPDF'));
app.post('/api/resetPassword', async (req, res) => runHandler(resetPasswordHandler, req, res, 'resetPassword'));
app.get('/api/config', (req, res) => {
  const apiBase = process.env.API_BASE_URL || '/api';
  res.json({ apiBaseUrl: apiBase });
});

// Backward-compatible aliases
app.post('/analysis', async (req, res) => runHandler(analysisHandler, req, res, 'analysis'));
app.post('/uploadPDF', async (req, res) => runHandler(uploadPDFHandler, req, res, 'uploadPDF'));
app.post('/resetPassword', async (req, res) => runHandler(resetPasswordHandler, req, res, 'resetPassword'));
app.get('/config', (req, res) => {
  const apiBase = process.env.API_BASE_URL || '/api';
  res.json({ apiBaseUrl: apiBase });
});

app.get('/_health', (req, res) => res.json({ ok: true }));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Local server running at http://localhost:${port}`));
