import { admin, db, resolveFamilyId, verifyRequest } from "./_lib/firebase.js";
import { findBankAccountById } from "./_lib/banks.js";
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
    const bankAccountId = body.bankAccountId || body.accountId || null;

    if (!description || !date) {
      throw new Error("Descricao ou data invalida");
    }

    if (!familyId) {
      throw new Error("Familia nao informada");
    }

    if (!bankAccountId) {
      throw new Error("Conta bancaria obrigatoria");
    }

    const bankAccount = await findBankAccountById(bankAccountId);
    if (!bankAccount) {
      throw new Error("Conta bancaria nao encontrada");
    }

    if (bankAccount.familyId && bankAccount.familyId !== familyId) {
      throw new Error("Conta bancaria invalida para esta familia");
    }

    const installment = detectInstallment(description);
    const bank = bankAccount.bank || body.bank || inferBankByPatterns(description);
    const docRef = db.collection("transactions").doc();
    const category = body.category || inferCategory(description);

    await docRef.set({
      id: docRef.id,
      familyId,
      userId: context.uid,
      userName: body.userName || context.user?.name || context.decoded?.name || null,
      bankAccountId,
      accountId: bankAccountId,
      bank,
      date,
      description,
      amount,
      type,
      category,
      subscription: false,
      installmentNumber: installment.installmentNumber,
      installmentTotal: installment.installmentTotal,
      paymentMethod: body.paymentMethod || null,
      installments: body.installments ? Number(body.installments) : null,
      observations: body.observations || body.notes || "",
      photoBase64: body.photoBase64 || null,
      source: "manual",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(201).json({
      success: true,
      id: docRef.id,
      bankAccountId,
      bank,
      category,
    });
  } catch (error) {
    const status =
      error && (error.message === "Unauthorized" || error.message === "Invalid token") ? 401 : 400;
    return res.status(status).json({
      error: error && error.message ? error.message : "Erro ao criar transacao",
    });
  }
}
