import pdf from "pdf-parse";
import { admin, db } from "./firebase.js";
import { canonicalBankName, DEFAULT_BANK, resolveImportBankAccount } from "./banks.js";

const BANK_PATTERNS = [
  { bank: "Nubank", patterns: ["NUBANK", "NU PAGAMENTOS", "NUBANK ULTRAVIOLETA", "NU "] },
  { bank: "Inter", patterns: ["BANCO INTER", "INTERMEDIUM", "INTER "] },
  { bank: "Itau", patterns: ["ITAU", "ITAU UNIBANCO", "ITAUCARD"] },
  { bank: "Santander", patterns: ["SANTANDER", "SX NEGOCIOS"] },
  { bank: "Bradesco", patterns: ["BRADESCO", "NEXT", "BRA DESCO"] },
  { bank: "Caixa", patterns: ["CAIXA", "CEF", "CAIXA ECONOMICA"] },
];

const CATEGORY_RULES = [
  { category: "alimentacao", patterns: ["IFOOD", "RESTAURANTE", "MERCADO", "PADARIA", "SUPERMERCADO", "UBEREATS"] },
  { category: "transporte", patterns: ["UBER", "99", "COMBUSTIVEL", "POSTO", "PEDAGIO", "METRO", "ONIBUS"] },
  { category: "moradia", patterns: ["ALUGUEL", "CONDOMINIO", "ENERGIA", "AGUA", "INTERNET", "CLARO", "VIVO", "OI "] },
  { category: "compras", patterns: ["AMAZON", "MERCADO LIVRE", "MAGAZINE LUIZA", "SHOPEE", "LOJA", "COMPRA"] },
  { category: "assinaturas", patterns: ["NETFLIX", "SPOTIFY", "DISNEY", "PRIME VIDEO", "YOUTUBE PREMIUM", "APPLE.COM/BILL"] },
  { category: "saude", patterns: ["FARMACIA", "DROGASIL", "DROGARIA", "HOSPITAL", "CLINICA", "ODONTO"] },
  { category: "educacao", patterns: ["ESCOLA", "FACULDADE", "CURSO", "UDEMY", "ALURA", "LIVRARIA"] },
  { category: "lazer", patterns: ["CINEMA", "SHOW", "INGRESSO", "BAR", "VIAGEM", "HOTEL", "AIRBNB"] },
];

function normalizeUpper(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function cleanDescription(value) {
  return normalizeUpper(value)
    .replace(/[*_]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\d{1,2}\/\d{1,2}\b/g, " ")
    .trim();
}

function normalizeText(text) {
  return String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function inferBankByPatterns(text) {
  const haystack = normalizeUpper(text);

  for (const entry of BANK_PATTERNS) {
    if (entry.patterns.some((pattern) => haystack.includes(pattern))) {
      return canonicalBankName(entry.bank);
    }
  }

  return DEFAULT_BANK;
}

function inferCategory(description) {
  const haystack = cleanDescription(description);

  for (const rule of CATEGORY_RULES) {
    if (rule.patterns.some((pattern) => haystack.includes(pattern))) {
      return rule.category;
    }
  }

  return "outros";
}

function parseAmount(rawValue) {
  const trimmed = String(rawValue || "").replace(/\s/g, "");
  if (!trimmed) return 0;

  const sign = trimmed.includes("-") ? -1 : 1;
  const digitsOnly = trimmed.replace(/[^\d,.-]/g, "");
  const normalized = digitsOnly.includes(",")
    ? digitsOnly.replace(/\./g, "").replace(",", ".")
    : digitsOnly;

  const amount = Number.parseFloat(normalized);
  return Number.isFinite(amount) ? amount * sign : 0;
}

function normalizeDate(rawDate) {
  if (!rawDate) return null;

  const now = new Date();
  const compact = String(rawDate).trim();
  const ymd = compact.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) return compact;

  const dmy = compact.match(/^(\d{2})\/(\d{2})(?:\/(\d{2,4}))?$/);
  if (!dmy) return null;

  const day = dmy[1];
  const month = dmy[2];
  let year = dmy[3] || String(now.getFullYear());

  if (year.length === 2) {
    year = `20${year}`;
  }

  const iso = `${year}-${month}-${day}`;
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;

  if (parsed.getTime() > now.getTime() + 7 * 24 * 60 * 60 * 1000) {
    return `${Number(year) - 1}-${month}-${day}`;
  }

  return iso;
}

function detectInstallment(description) {
  const match = String(description || "").match(/(?:^|\s)(\d{1,2})\s*\/\s*(\d{1,2})(?:\s|$)/);
  if (!match) {
    return { installmentNumber: null, installmentTotal: null };
  }

  return {
    installmentNumber: Number.parseInt(match[1], 10),
    installmentTotal: Number.parseInt(match[2], 10),
  };
}

function parseTransactionLines(text) {
  const lines = normalizeText(text).split("\n");
  const transactions = [];
  const linePattern = /(\d{2}\/\d{2}(?:\/\d{2,4})?|\d{4}-\d{2}-\d{2})\s+(.+?)\s+(-?\s*(?:R\$)?\s*[\d.,]+)/;

  for (const line of lines) {
    const match = line.trim().match(linePattern);
    if (!match) continue;

    const date = normalizeDate(match[1]);
    const description = cleanDescription(match[2]);
    const amount = parseAmount(match[3]);

    if (!date || !description || !amount) continue;

    transactions.push({
      date,
      description,
      amount,
    });
  }

  return transactions;
}

function parseCsvRows(csvText) {
  const lines = normalizeText(csvText).split("\n").filter(Boolean);
  if (lines.length < 2) return [];

  const separator = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(separator).map((header) => normalizeUpper(header.replace(/"/g, "")));
  const rows = [];

  for (let index = 1; index < lines.length; index += 1) {
    const columns = [];
    let current = "";
    let inQuotes = false;

    for (const char of lines[index]) {
      if (char === "\"") {
        inQuotes = !inQuotes;
        continue;
      }

      if (char === separator && !inQuotes) {
        columns.push(current);
        current = "";
        continue;
      }

      current += char;
    }

    columns.push(current);

    const record = {};
    headers.forEach((header, headerIndex) => {
      record[header] = (columns[headerIndex] || "").trim();
    });

    const rawDate = record.DATA || record.DATE || record["DATA DO LANCAMENTO"] || record.DT || "";
    const rawDescription =
      record.DESCRICAO || record.DESCRIPTION || record.HISTORICO || record.MEMO || record.LANCAMENTO || "";
    const rawAmount = record.VALOR || record.AMOUNT || record.VALUE || record["VALOR (R$)"] || "";

    const date = normalizeDate(rawDate);
    const description = cleanDescription(rawDescription);
    const amount = parseAmount(rawAmount);

    if (!date || !description || !amount) continue;

    rows.push({ date, description, amount });
  }

  return rows;
}

async function extractTextFromPdfBuffer(buffer) {
  const parsed = await pdf(buffer);
  return normalizeText(parsed.text || "");
}

async function findExistingTransactions({ familyId, uid }) {
  let query = familyId
    ? db.collection("transactions").where("familyId", "==", familyId)
    : db.collection("transactions").where("userId", "==", uid);

  query = query.limit(1000);
  const snapshot = await query.get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

function detectSubscriptions(transactions, existingTransactions) {
  const combined = [...existingTransactions, ...transactions];
  const recurringKeys = new Set();

  for (const item of combined) {
    if (item.type !== "expense") continue;
    const key = `${cleanDescription(item.description)}|${Math.abs(Number(item.amount || 0)).toFixed(2)}`;
    const group = combined.filter((candidate) => {
      return (
        candidate.type === "expense" &&
        `${cleanDescription(candidate.description)}|${Math.abs(Number(candidate.amount || 0)).toFixed(2)}` === key
      );
    });

    if (group.length < 2) continue;

    const sorted = group
      .map((entry) => new Date(entry.date))
      .filter((entry) => !Number.isNaN(entry.getTime()))
      .sort((left, right) => left.getTime() - right.getTime());

    for (let index = 1; index < sorted.length; index += 1) {
      const diffDays = Math.round((sorted[index].getTime() - sorted[index - 1].getTime()) / (24 * 60 * 60 * 1000));
      if (diffDays >= 25 && diffDays <= 35) {
        recurringKeys.add(key);
        break;
      }
    }
  }

  return transactions.map((transaction) => {
    const key = `${cleanDescription(transaction.description)}|${Math.abs(Number(transaction.amount || 0)).toFixed(2)}`;
    return {
      ...transaction,
      subscription: recurringKeys.has(key),
    };
  });
}

function shapeTransaction(rawTransaction, context) {
  const amount = Number(rawTransaction.amount);
  const installment = detectInstallment(rawTransaction.description);

  return {
    familyId: context.familyId || null,
    userId: context.uid,
    bankAccountId: context.bankAccountId || null,
    accountId: context.bankAccountId || null,
    bank: context.bank,
    date: rawTransaction.date,
    description: cleanDescription(rawTransaction.description),
    amount: Math.abs(amount),
    type: amount >= 0 ? "income" : "expense",
    category: inferCategory(rawTransaction.description),
    subscription: false,
    installmentNumber: installment.installmentNumber,
    installmentTotal: installment.installmentTotal,
    source: context.source || "pdf_import",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

async function persistImportedTransactions({
  uid,
  familyId,
  bank,
  bankAccount,
  fileName,
  transactions,
}) {
  const existingTransactions = await findExistingTransactions({ familyId, uid });
  const decoratedTransactions = detectSubscriptions(transactions, existingTransactions);
  const batch = db.batch();
  const importRef = db.collection("imports").doc();

  decoratedTransactions.forEach((transaction) => {
    const docRef = db.collection("transactions").doc();
    batch.set(docRef, {
      id: docRef.id,
      ...transaction,
    });
  });

  batch.set(importRef, {
    id: importRef.id,
    familyId: familyId || null,
    bank,
    fileName: fileName || "statement",
    transactionCount: decoratedTransactions.length,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  if (bankAccount && bankAccount.bankAccountId && Array.isArray(bankAccount.syncCollections) && bankAccount.syncCollections.length) {
    const balanceDelta = decoratedTransactions.reduce((sum, transaction) => {
      return sum + (transaction.type === "income" ? transaction.amount : -transaction.amount);
    }, 0);

    const today = new Date().toISOString().split("T")[0];
    for (const collectionName of [...new Set(bankAccount.syncCollections)]) {
      const accountRef = db.collection(collectionName).doc(bankAccount.bankAccountId);
      batch.set(
        accountRef,
        {
          balance: admin.firestore.FieldValue.increment(balanceDelta),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastAiScan: today,
        },
        { merge: true }
      );
    }
  }

  await batch.commit();

  return decoratedTransactions;
}

async function importStatementData({
  uid,
  familyId,
  bankAccountId,
  providedBank,
  fileName,
  fileType,
  pdfBase64,
  csvBase64,
}) {
  let rawText = "";
  let parsedTransactions = [];

  if (fileType === "pdf") {
    if (!pdfBase64) {
      throw new Error("Arquivo PDF nao informado");
    }

    rawText = await extractTextFromPdfBuffer(Buffer.from(pdfBase64, "base64"));
    parsedTransactions = parseTransactionLines(rawText);
  } else if (fileType === "csv") {
    if (!csvBase64) {
      throw new Error("Arquivo CSV nao informado");
    }

    rawText = Buffer.from(csvBase64, "base64").toString("utf8");
    parsedTransactions = parseCsvRows(rawText);
  } else {
    throw new Error("Tipo de arquivo nao suportado");
  }

  if (!parsedTransactions.length) {
    throw new Error("Nenhuma transacao encontrada no arquivo");
  }

  const bank = canonicalBankName(
    providedBank || inferBankByPatterns(rawText || parsedTransactions.map((item) => item.description).join(" "))
  );
  const resolvedBankAccount = await resolveImportBankAccount({
    familyId,
    uid,
    bank,
    bankAccountId,
  });
  const today = new Date().toISOString().split("T")[0];

  if (resolvedBankAccount.lastAiScan && resolvedBankAccount.lastAiScan === today) {
    throw new Error("Limite de 1 extrato por dia atingido para este banco.");
  }

  const shapedTransactions = parsedTransactions.map((transaction) =>
    shapeTransaction(transaction, {
      uid,
      familyId,
      bank,
      bankAccountId: resolvedBankAccount.bankAccountId || null,
      source: fileType === "csv" ? "csv_import" : "pdf_import",
    })
  );

  const storedTransactions = await persistImportedTransactions({
    uid,
    familyId,
    bank,
    bankAccount: resolvedBankAccount,
    fileName,
    transactions: shapedTransactions,
  });

  return {
    bank,
    bankAccountId: resolvedBankAccount.bankAccountId,
    bankAccountName: resolvedBankAccount.name || bank,
    bankEmoji: resolvedBankAccount.emoji || null,
    accountCreated: Boolean(resolvedBankAccount.created),
    transactionCount: storedTransactions.length,
    count: storedTransactions.length,
    transactions: storedTransactions,
  };
}

export {
  cleanDescription,
  detectInstallment,
  importStatementData,
  inferBankByPatterns,
  inferCategory,
  normalizeDate,
  normalizeText,
  parseCsvRows,
  parseTransactionLines,
};
