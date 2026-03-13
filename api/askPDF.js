import admin from "firebase-admin";
import { GoogleGenerativeAI } from "@google/generative-ai";

if (!admin.apps.length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(serviceAccount)),
    });
  } else {
    admin.initializeApp();
  }
}
const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
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
    const { question } = req.body;
    const snap = await db.collection("transactions").where("userId", "==", uid).get();
    const transactions = [];
    snap.forEach((doc) => transactions.push(doc.data()));

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Baseado nas transações abaixo, responda à pergunta.

Transações:
${JSON.stringify(transactions, null, 2)}

Pergunta:
${question}
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    res.status(200).json({ answer: text });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro na IA" });
  }
}
