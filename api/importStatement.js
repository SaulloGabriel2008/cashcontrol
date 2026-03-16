import { importStatementData } from "./_lib/importPipeline.js";
import { resolveFamilyId, verifyRequest } from "./_lib/firebase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const context = await verifyRequest(req);
    const body = req.body || {};
    const fileType = body.fileType || (body.csvBase64 ? "csv" : "pdf");
    const familyId = resolveFamilyId(req, context);
    const result = await importStatementData({
      uid: context.uid,
      familyId,
      bankAccountId: body.bankAccountId || null,
      providedBank: body.bank || null,
      fileName: body.fileName || "statement",
      fileType,
      pdfBase64: body.pdfBase64 || (fileType === "pdf" ? body.fileBase64 || null : null),
      csvBase64: body.csvBase64 || (fileType === "csv" ? body.fileBase64 || null : null),
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    const message = error && error.message ? error.message : "Erro ao importar extrato";
    const isAuthError = message === "Unauthorized" || message === "Invalid token";
    const isBusinessError =
      message.includes("Nenhuma transacao") ||
      message.includes("Nao foi possivel reconhecer") ||
      message.includes("Nao foi possivel ler a estrutura deste PDF") ||
      message.includes("Limite de 1 extrato por dia") ||
      message.includes("Arquivo PDF nao informado") ||
      message.includes("Arquivo CSV nao informado") ||
      message.includes("Tipo de arquivo nao suportado");
    const status = isAuthError ? 401 : isBusinessError ? 422 : 500;
    return res.status(status).json({
      error: message,
    });
  }
}
