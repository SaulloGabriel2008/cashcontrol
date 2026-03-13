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
import askPDFHandler from './api/askPDF.js';
import importCSVHandler from './api/importCSV.js';
import importStatementHandler from './api/importStatement.js';
import bankReportHandler from './api/report/banks.js';
import bankTransactionsReportHandler from './api/report/bank-transactions.js';
import transactionsHandler from './api/transactions.js';
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
app.get('/api/analysis', async (req, res) => runHandler(analysisHandler, req, res, 'analysis'));
app.post('/api/analysis', async (req, res) => runHandler(analysisHandler, req, res, 'analysis'));
app.post('/api/askPDF', async (req, res) => runHandler(askPDFHandler, req, res, 'askPDF'));
app.post('/api/importCSV', async (req, res) => runHandler(importCSVHandler, req, res, 'importCSV'));
app.post('/api/importStatement', async (req, res) => runHandler(importStatementHandler, req, res, 'importStatement'));
app.get('/api/report/banks', async (req, res) => runHandler(bankReportHandler, req, res, 'reportBanks'));
app.get('/api/report/bank-transactions', async (req, res) => runHandler(bankTransactionsReportHandler, req, res, 'reportBankTransactions'));
app.post('/api/transactions/create', async (req, res) => runHandler(transactionsHandler, req, res, 'transactionsCreate'));
app.post('/api/transactions', async (req, res) => runHandler(transactionsHandler, req, res, 'transactions'));
app.post('/api/uploadPDF', async (req, res) => runHandler(uploadPDFHandler, req, res, 'uploadPDF'));
app.post('/api/resetPassword', async (req, res) => runHandler(resetPasswordHandler, req, res, 'resetPassword'));
app.get('/api/config', (req, res) => {
  const apiBase = process.env.API_BASE_URL || '/api';
  res.json({ apiBaseUrl: apiBase });
});

// Backward-compatible aliases
app.get('/analysis', async (req, res) => runHandler(analysisHandler, req, res, 'analysis'));
app.post('/analysis', async (req, res) => runHandler(analysisHandler, req, res, 'analysis'));
app.post('/askPDF', async (req, res) => runHandler(askPDFHandler, req, res, 'askPDF'));
app.post('/importCSV', async (req, res) => runHandler(importCSVHandler, req, res, 'importCSV'));
app.post('/importStatement', async (req, res) => runHandler(importStatementHandler, req, res, 'importStatement'));
app.get('/report/banks', async (req, res) => runHandler(bankReportHandler, req, res, 'reportBanks'));
app.get('/report/bank-transactions', async (req, res) => runHandler(bankTransactionsReportHandler, req, res, 'reportBankTransactions'));
app.post('/transactions/create', async (req, res) => runHandler(transactionsHandler, req, res, 'transactionsCreate'));
app.post('/transactions', async (req, res) => runHandler(transactionsHandler, req, res, 'transactions'));
app.post('/uploadPDF', async (req, res) => runHandler(uploadPDFHandler, req, res, 'uploadPDF'));
app.post('/resetPassword', async (req, res) => runHandler(resetPasswordHandler, req, res, 'resetPassword'));
app.get('/config', (req, res) => {
  const apiBase = process.env.API_BASE_URL || '/api';
  res.json({ apiBaseUrl: apiBase });
});

app.get('/_health', (req, res) => res.json({ ok: true }));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Local server running at http://localhost:${port}`));
