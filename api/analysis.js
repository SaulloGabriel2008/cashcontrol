import { aggregateTransactions, fetchTransactionsForScope, saveAiReport } from "./_lib/analytics.js";
import { getGeminiModel } from "./_lib/gemini.js";
import { resolveFamilyId, verifyRequest } from "./_lib/firebase.js";

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const context = await verifyRequest(req);
    const familyId = resolveFamilyId(req, context);
    const transactions = await fetchTransactionsForScope({
      uid: context.uid,
      familyId,
    });

    const summary = aggregateTransactions(transactions);
    const model = getGeminiModel();
    const prompt = `Voce e um analista financeiro de uma plataforma familiar.

Dados resumidos:
${JSON.stringify(summary, null, 2)}

Retorne:
1. resumo financeiro
2. principais padroes de gasto
3. alertas de risco
4. sugestoes praticas para economizar

Responda em portugues claro e objetivo.`;

    const result = await model.generateContent(prompt);
    const analysis = result.response.text();
    const reportId = await saveAiReport({
      familyId,
      uid: context.uid,
      summary,
      analysis,
    });

    return res.status(200).json({
      analysis,
      summary,
      reportId,
    });
  } catch (error) {
    const status =
      error && (error.message === "Unauthorized" || error.message === "Invalid token") ? 401 : 500;
    return res.status(status).json({
      error: error && error.message ? error.message : "Erro na analise",
    });
  }
}
