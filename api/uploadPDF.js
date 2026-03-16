import importStatementHandler from "./importStatement.js";

export default async function handler(req, res) {
  if (req.method === "POST") {
    const body = req.body || {};
    const requestedType = body.fileType === "csv" || body.fileType === "pdf" ? body.fileType : null;
    const normalizedType = requestedType || (body.csvBase64 ? "csv" : "pdf");

    req.body = {
      ...body,
      mode: body.mode === "preview" ? "preview" : body.mode === "apply" ? "apply" : undefined,
      fileType: normalizedType,
      csvBase64: body.csvBase64 || (normalizedType === "csv" ? body.fileBase64 || null : null),
      pdfBase64: body.pdfBase64 || (normalizedType === "pdf" ? body.fileBase64 || null : null),
    };
  }

  return importStatementHandler(req, res);
}
