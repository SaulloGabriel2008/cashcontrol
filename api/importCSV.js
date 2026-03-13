import importStatementHandler from "./importStatement.js";

export default async function handler(req, res) {
  if (req.method === "POST") {
    req.body = {
      ...(req.body || {}),
      fileType: "csv",
    };
  }

  return importStatementHandler(req, res);
}
