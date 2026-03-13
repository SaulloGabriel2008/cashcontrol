import { admin, db, resolveFamilyId, verifyRequest } from "./_lib/firebase.js";
import { cleanDescription, detectInstallment, inferCategory, inferBankByPatterns, normalizeDate } from "./_lib/importPipeline.js";

function normalizeManualAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Valor invalido");
  }
  return amount;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const context = await verifyRequest(req);
    const body = req.body || {};
    const familyId = resolveFamilyId(req, context);
    const type = body.type === "income" ? "income" : "expense";
    const amount = normalizeManualAmount(body.amount);
    const description = cleanDescription(body.description);
    const date = normalizeDate(body.date);

    if (!description || !date) {
      throw new Error("Descricao ou data invalida");
    }

    const installment = detectInstallment(description);
    const bank = body.bank || inferBankByPatterns(description);
    const docRef = db.collection("transactions").doc();

    await docRef.set({
      id: docRef.id,
      familyId: familyId || null,
      userId: context.uid,
      bankAccountId: body.bankAccountId || null,
      bank,
      date,
      description,
      amount,
      type,
      category: body.category || inferCategory(description),
      subscription: false,
      installmentNumber: installment.installmentNumber,
      installmentTotal: installment.installmentTotal,
      source: "manual",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(201).json({
      success: true,
      id: docRef.id,
    });
  } catch (error) {
    const status =
      error && (error.message === "Unauthorized" || error.message === "Invalid token") ? 401 : 400;
    return res.status(status).json({
      error: error && error.message ? error.message : "Erro ao criar transacao",
    });
  }
}
