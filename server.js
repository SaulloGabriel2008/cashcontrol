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

// Servir arquivos estáticos (index.html, assets, etc.)
app.use(express.static(__dirname));

// Import handlers dinamicamente para que funcionem como nas funções serverless
import analysisHandler from './api/analysis.js';
import uploadPDFHandler from './api/uploadPDF.js';
import resetPasswordHandler from './api/resetPassword.js';

app.post('/analysis', async (req, res) => {
  try {
    await analysisHandler(req, res);
  } catch (err) {
    console.error('analysis route error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/uploadPDF', async (req, res) => {
  try {
    await uploadPDFHandler(req, res);
  } catch (err) {
    console.error('uploadPDF route error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// expõe a mesma rota de configuração usada em produção
app.get('/config', (req, res) => {
  const apiBase = process.env.API_BASE_URL || '/api';
  res.json({ apiBaseUrl: apiBase });
});

app.post('/uploadPDF', async (req, res) => {
  try {
    await uploadPDFHandler(req, res);
  } catch (err) {
    console.error('uploadPDF route error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/resetPassword', async (req, res) => {
  try {
    await resetPasswordHandler(req, res);
  } catch (err) {
    console.error('resetPassword route error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Rota de teste
app.get('/_health', (req, res) => res.json({ ok: true }));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Local server running at http://localhost:${port}`));
