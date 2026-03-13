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
    const { familyId } = req.body;
    // query either by familyId or userId
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

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
Analise as seguintes transações financeiras e forneça:

1. resumo financeiro
2. categorias com maiores gastos
3. possíveis excessos
4. recomendações para economizar
5. sugestões para melhorar a saúde financeira

Transações:
${JSON.stringify(transactions, null, 2)}

Retorne o resultado em texto claro para o usuário.
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    res.status(200).json({ analysis: text });
  } catch (error) {
    console.error("analysis error", error);
    res.status(500).json({ error: "Erro na análise" });
  }
}
