import admin from "firebase-admin";
import { GoogleGenerativeAI } from "@google/generative-ai";

function getFirebaseCredential() {
  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!rawServiceAccount) return null;

  try {
    return admin.credential.cert(JSON.parse(rawServiceAccount));
  } catch (error) {
    throw new Error("Variavel de ambiente FIREBASE_SERVICE_ACCOUNT invalida");
  }
}

const firebaseCredential = getFirebaseCredential();

if (!admin.apps.length) {
  if (firebaseCredential) {
    admin.initializeApp({
      credential: firebaseCredential,
    });
  } else {
    admin.initializeApp();
  }
}
const db = admin.firestore();

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Variavel de ambiente GEMINI_API_KEY nao configurada");
  }
  return new GoogleGenerativeAI(apiKey);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!firebaseCredential && process.env.VERCEL) {
    return res.status(500).json({ error: "Variavel de ambiente FIREBASE_SERVICE_ACCOUNT nao configurada" });
  }

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
    console.error("Invalid token", err);
    return res.status(401).json({ error: "Invalid token" });
  }

  try {
    const body = req.body || {};
    const { familyId } = body;

    let query;
    if (familyId) {
      query = db.collection("transactions").where("familyId", "==", familyId);
    } else {
      query = db.collection("transactions").where("userId", "==", uid);
    }

    const snap = await query.get();
    const transactions = [];
    snap.forEach((doc) => {
      transactions.push(doc.data());
    });

    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
Analise as seguintes transacoes financeiras e forneca:

1. resumo financeiro
2. categorias com maiores gastos
3. possiveis excessos
4. recomendacoes para economizar
5. sugestoes para melhorar a saude financeira

Transacoes:
${JSON.stringify(transactions, null, 2)}

Retorne o resultado em texto claro para o usuario.
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    res.status(200).json({ analysis: text });
  } catch (error) {
    console.error("analysis error", error);
    const message = error && error.message ? error.message : "Erro na analise";
    res.status(500).json({ error: message });
  }
}
