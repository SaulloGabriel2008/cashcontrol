import pdf from "pdf-parse";
import admin from "firebase-admin";
import { GoogleGenerativeAI } from "@google/generative-ai";

// initialize Firebase Admin once
if (!admin.apps.length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(serviceAccount)),
    });
  } else {
    admin.initializeApp(); // fallback to default credentials (environment)
  }
}
const db = admin.firestore();

// simple regex-based text parser (not perfect but works for basic statements)
function parseTransactionsFromText(text) {
  const lines = text.split(/\r?\n/);
  const txs = [];
  const regex = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+(.+?)\s+(-?\d+[\.,]?\d*)/;
  for (const line of lines) {
    const m = line.match(regex);
    if (m) {
      let [, date, desc, amt] = m;
      amt = parseFloat(amt.replace(".", "").replace(",", ".")) || 0;
      txs.push({ date, description: desc.trim(), amount: amt });
    }
  }
  return txs;
}

function parseCsv(csvString) {
  const lines = csvString.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const results = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",");
    if (parts.length < 2) continue;
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = parts[idx];
    });
    const date = obj.date || obj.data || "";
    const description = obj.description || obj.descricao || "";
    let amount = obj.amount || obj.valor || obj.value || "0";
    amount = parseFloat(amount.replace(/[^\d\.-]/g, "")) || 0;
    results.push({ date, description, amount });
  }
  return results;
}

async function categorizeTransactions(descriptions) {
  if (!descriptions || !descriptions.length) return [];
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const prompt = `Classifique as seguintes transações financeiras nas categorias:
Alimentação, Transporte, Moradia, Compras, Lazer, Assinaturas, Saúde, Educação, Investimentos ou Outros.

Retorne apenas um JSON array com objetos no formato { "category": "<categoria>" } na mesma ordem das transações.

Transações:
${JSON.stringify(descriptions.map(d => ({ description: d })), null, 2))}
`;
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  let arr = [];
  try {
    arr = JSON.parse(text);
  } catch (e) {
    const m = text.match(/\[.*\]/s);
    if (m) {
      try { arr = JSON.parse(m[0]); } catch {};
    }
  }
  return arr.map((o) => o.category || "Outros");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Authenticate the request via Firebase ID token
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.split("Bearer ")[1] : null;
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  let uid;
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    uid = decoded.uid;
  } catch (err) {
    console.error("Token verification failed", err);
    return res.status(401).json({ error: "Invalid token" });
  }

  try {
    const { pdfBase64, csvBase64, fileType, familyId, bank, gcsPath } = req.body;
    let transactions = [];
    let buffer;

    if (gcsPath) {
      // download from Firebase Storage using admin SDK
      const bucket = admin.storage().bucket();
      const file = bucket.file(gcsPath);
      try {
        const contents = await file.download();
        buffer = contents[0];
      } catch (e) {
        console.error('failed to download file from storage', e);
        return res.status(500).json({ error: 'Falha ao baixar arquivo do armazenamento' });
      } finally {
        // opcional: apaga o arquivo para não acumular
        file.delete().catch(() => {});
      }
    } else if (fileType === "pdf" && pdfBase64) {
      buffer = Buffer.from(pdfBase64, "base64");
    } else if (fileType === "csv" && csvBase64) {
      buffer = Buffer.from(csvBase64, "base64");
    }

    if (!buffer) {
      return res.status(400).json({ error: "No valid file data provided" });
    }

    if (fileType === "pdf") {
      const data = await pdf(buffer);
      transactions = parseTransactionsFromText(data.text);
    } else if (fileType === "csv") {
      const csv = buffer.toString("utf8");
      transactions = parseCsv(csv);
    }

    if (!transactions.length) {
      return res.status(400).json({ error: "Nenhuma transação encontrada" });
    }

    // categorize
    try {
      const cats = await categorizeTransactions(transactions.map((t) => t.description));
      transactions.forEach((t, idx) => {
        t.category = cats[idx] || "Outros";
      });
    } catch (err) {
      console.error("Categorization failed", err);
      transactions.forEach((t) => { t.category = "Outros"; });
    }

    // save to Firestore
    const batch = db.batch();
    const now = admin.firestore.Timestamp.now();
    transactions.forEach((t) => {
      const docRef = db.collection("transactions").doc();
      batch.set(docRef, {
        userId: uid,
        familyId: familyId || null,
        bank: bank || "",
        date: t.date,
        description: t.description,
        amount: t.amount,
        category: t.category,
        createdAt: now,
      });
    });
    await batch.commit();

    res.status(200).json({ success: true, count: transactions.length });
  } catch (error) {
    console.error("uploadPDF error", error);
    // retorne mensagem específica para o cliente, mas sem vazar stack
    const msg = (error && error.message) ? error.message : "Erro ao processar arquivo";
    res.status(500).json({ error: msg });
  }
}
