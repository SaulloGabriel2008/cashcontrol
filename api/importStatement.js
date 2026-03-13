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
      pdfBase64: body.pdfBase64 || body.fileBase64 || null,
      csvBase64: body.csvBase64 || null,
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    const status =
      error && (error.message === "Unauthorized" || error.message === "Invalid token") ? 401 : 500;
    return res.status(status).json({
      error: error && error.message ? error.message : "Erro ao importar extrato",
    });
  }
}
