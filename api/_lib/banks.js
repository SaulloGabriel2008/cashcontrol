import { admin, db } from "./firebase.js";

const PRIMARY_BANK_ACCOUNT_COLLECTION = "bankAccounts";
const BANK_ACCOUNT_COLLECTIONS = ["bankAccounts", "bank_accounts"];
const DEFAULT_BANK = "Banco nao definido";
const DEFAULT_ACCOUNT_NAME = "Sem conta";
const DEFAULT_EMOJI = "\u{1F3E6}";

const BANK_EMOJI_MAP = {
  Nubank: "\u{1F7E3}",
  Inter: "\u{1F7E0}",
  Itau: "\u{1F7E6}\u{1F7E8}",
  Santander: "\u{1F534}",
  Bradesco: "\u{1F53A}",
  Caixa: "\u{1F7E6}",
};

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeBankKey(value) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function canonicalBankName(value) {
  const key = normalizeBankKey(value);

  if (!key || key === "outro" || key === "outros" || key === "banco nao definido") {
    return DEFAULT_BANK;
  }

  if (key === "nubank") return "Nubank";
  if (key === "inter") return "Inter";
  if (key === "itau") return "Itau";
  if (key === "santander") return "Santander";
  if (key === "bradesco") return "Bradesco";
  if (key === "caixa") return "Caixa";

  return normalizeText(value);
}

function getDefaultBankEmoji(bank) {
  return BANK_EMOJI_MAP[canonicalBankName(bank)] || DEFAULT_EMOJI;
}

function toNumber(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function toTimestampMs(value) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") {
    return value.seconds * 1000 + Math.round((value.nanoseconds || 0) / 1_000_000);
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function getTransactionBankAccountId(transaction) {
  return transaction.bankAccountId || transaction.accountId || null;
}

function getTransactionBank(transaction) {
  return canonicalBankName(transaction.bank) || DEFAULT_BANK;
}

function normalizeBankAccount(id, data, collectionName) {
  const bank = canonicalBankName(data.bank) || DEFAULT_BANK;
  return {
    id,
    familyId: data.familyId || null,
    userId: data.userId || null,
    name: normalizeText(data.name) || bank || DEFAULT_ACCOUNT_NAME,
    bank,
    emoji: normalizeText(data.emoji) || getDefaultBankEmoji(bank),
    initialBalance: toNumber(data.initialBalance ?? data.balance),
    active: data.active !== false,
    createdAt: data.createdAt || null,
    lastAiScan: data.lastAiScan || null,
    collectionName,
  };
}

async function listFamilyBankAccounts(familyId, options = {}) {
  if (!familyId) return [];

  const uid = options.uid || null;
  const results = [];
  const seen = new Set();

  for (const collectionName of BANK_ACCOUNT_COLLECTIONS) {
    const snapshot = await db.collection(collectionName).where("familyId", "==", familyId).get();
    snapshot.forEach((doc) => {
      const account = normalizeBankAccount(doc.id, doc.data(), collectionName);
      if (!account.active) return;
      if (uid && account.userId && account.userId !== uid) return;
      if (seen.has(account.id)) return;
      seen.add(account.id);
      results.push(account);
    });
  }

  return results.sort((left, right) => {
    const createdDiff = toTimestampMs(left.createdAt) - toTimestampMs(right.createdAt);
    if (createdDiff !== 0) return createdDiff;

    const leftLabel = `${left.bank} ${left.name}`.toLowerCase();
    const rightLabel = `${right.bank} ${right.name}`.toLowerCase();
    return leftLabel.localeCompare(rightLabel, "pt-BR");
  });
}

async function findBankAccountById(bankAccountId) {
  if (!bankAccountId) return null;

  for (const collectionName of BANK_ACCOUNT_COLLECTIONS) {
    const snapshot = await db.collection(collectionName).doc(bankAccountId).get();
    if (snapshot.exists) {
      return normalizeBankAccount(snapshot.id, snapshot.data(), collectionName);
    }
  }

  return null;
}

async function findBankAccountCollections(bankAccountId) {
  if (!bankAccountId) return [];

  const collections = [];
  for (const collectionName of BANK_ACCOUNT_COLLECTIONS) {
    const snapshot = await db.collection(collectionName).doc(bankAccountId).get();
    if (snapshot.exists) {
      collections.push(collectionName);
    }
  }

  return collections;
}

async function findFamilyBankAccountByBank(familyId, bank) {
  const targetKey = normalizeBankKey(bank);
  const accounts = await listFamilyBankAccounts(familyId);
  const matches = accounts.filter((account) => normalizeBankKey(account.bank) === targetKey);
  return matches[0] || null;
}

async function findUndefinedBankAccount(familyId) {
  const undefinedKeys = new Set(["", "outro", "outros", "banco nao definido"]);
  const accounts = await listFamilyBankAccounts(familyId);
  return accounts.find((account) => undefinedKeys.has(normalizeBankKey(account.bank))) || null;
}

async function mirrorBankAccountRecord(id, payload, collectionNames = BANK_ACCOUNT_COLLECTIONS) {
  await Promise.all(
    [...new Set(collectionNames)].map((collectionName) =>
      db.collection(collectionName).doc(id).set(payload, { merge: true })
    )
  );
}

async function createBankAccountForImport({ familyId, uid, bank }) {
  const canonicalBank = canonicalBankName(bank);
  const docRef = db.collection(PRIMARY_BANK_ACCOUNT_COLLECTION).doc();
  const payload = {
    id: docRef.id,
    familyId: familyId || null,
    userId: uid || null,
    name: canonicalBank,
    bank: canonicalBank,
    emoji: getDefaultBankEmoji(canonicalBank),
    initialBalance: 0,
    balance: 0,
    active: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await mirrorBankAccountRecord(docRef.id, payload, BANK_ACCOUNT_COLLECTIONS);

  return {
    ...normalizeBankAccount(docRef.id, payload, PRIMARY_BANK_ACCOUNT_COLLECTION),
    bankAccountId: docRef.id,
    created: true,
    syncCollections: [...BANK_ACCOUNT_COLLECTIONS],
  };
}

async function resolveImportBankAccount({ familyId, uid, bank, bankAccountId, allowCreate = true }) {
  if (bankAccountId) {
    const existingAccount = await findBankAccountById(bankAccountId);
    if (existingAccount) {
      return {
        ...existingAccount,
        bankAccountId: existingAccount.id,
        created: false,
        syncCollections: await findBankAccountCollections(existingAccount.id),
      };
    }

    return {
      bankAccountId,
      familyId: familyId || null,
      userId: uid || null,
      bank: canonicalBankName(bank),
      name: canonicalBankName(bank) || DEFAULT_ACCOUNT_NAME,
      emoji: getDefaultBankEmoji(bank),
      created: false,
      syncCollections: [PRIMARY_BANK_ACCOUNT_COLLECTION],
    };
  }

  const canonicalBank = canonicalBankName(bank);
  if (!familyId) {
    throw new Error("Familia nao informada");
  }

  if (canonicalBank === DEFAULT_BANK) {
    const undefinedAccount = await findUndefinedBankAccount(familyId);
    if (!undefinedAccount) {
      throw new Error("Nao foi possivel detectar o banco do extrato. Envie o CSV oficial ou um arquivo mais claro.");
    }

    return {
      ...undefinedAccount,
      bankAccountId: undefinedAccount.id,
      created: false,
      syncCollections: await findBankAccountCollections(undefinedAccount.id),
    };
  }

  const existingByBank = await findFamilyBankAccountByBank(familyId, canonicalBank);
  if (existingByBank) {
    return {
      ...existingByBank,
      bankAccountId: existingByBank.id,
      created: false,
      syncCollections: await findBankAccountCollections(existingByBank.id),
    };
  }

  if (!allowCreate) {
    return {
      bankAccountId: null,
      familyId: familyId || null,
      userId: uid || null,
      bank: canonicalBank,
      name: canonicalBank || DEFAULT_ACCOUNT_NAME,
      emoji: getDefaultBankEmoji(canonicalBank),
      created: true,
      syncCollections: [PRIMARY_BANK_ACCOUNT_COLLECTION],
    };
  }

  return createBankAccountForImport({
    familyId,
    uid,
    bank: canonicalBank,
  });
}

function sortTransactionsByDateDesc(transactions) {
  return [...transactions].sort((left, right) => {
    const leftDate = new Date(left.date || 0).getTime();
    const rightDate = new Date(right.date || 0).getTime();
    return rightDate - leftDate;
  });
}

function groupTransactionsByBank(transactions, bankAccounts = []) {
  const accountsById = new Map(bankAccounts.map((account) => [account.id, account]));
  const groups = new Map();

  for (const transaction of transactions) {
    const bankAccountId = getTransactionBankAccountId(transaction);
    const account = bankAccountId ? accountsById.get(bankAccountId) : null;
    const bank = account?.bank || getTransactionBank(transaction);
    const name = account?.name || (bankAccountId ? bank : DEFAULT_ACCOUNT_NAME);
    const emoji = account?.emoji || getDefaultBankEmoji(bank);
    const key = bankAccountId ? `account:${bankAccountId}` : `bank:${normalizeBankKey(bank)}`;

    if (!groups.has(key)) {
      groups.set(key, {
        bankAccountId: bankAccountId || null,
        bank,
        name,
        emoji,
        initialBalance: account?.initialBalance || 0,
        income: 0,
        expense: 0,
        balance: 0,
        transactions: [],
      });
    }

    const entry = groups.get(key);
    const amount = toNumber(transaction.amount);
    if (transaction.type === "income") {
      entry.income += amount;
      entry.balance += amount;
    } else {
      entry.expense += amount;
      entry.balance -= amount;
    }

    entry.transactions.push({
      id: transaction.id || null,
      date: transaction.date || "",
      description: transaction.description || "Sem descricao",
      category: transaction.category || "Outros",
      type: transaction.type || "expense",
      amount,
      bank: entry.bank,
      bankAccountId: entry.bankAccountId,
    });
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      income: Number(group.income.toFixed(2)),
      expense: Number(group.expense.toFixed(2)),
      balance: Number(group.balance.toFixed(2)),
      transactions: sortTransactionsByDateDesc(group.transactions),
    }))
    .sort((left, right) => {
      const leftLabel = `${left.bank} ${left.name}`.toLowerCase();
      const rightLabel = `${right.bank} ${right.name}`.toLowerCase();
      return leftLabel.localeCompare(rightLabel, "pt-BR");
    });
}

function filterTransactionsByQuery(transactions, query = {}) {
  const startDate = normalizeText(query.startDate);
  const endDate = normalizeText(query.endDate);
  const paymentFilter = normalizeText(query.paymentFilter || query.paymentMethod).toLowerCase();

  return transactions.filter((transaction) => {
    if (startDate && transaction.date && transaction.date < startDate) return false;
    if (endDate && transaction.date && transaction.date > endDate) return false;

    if (paymentFilter && paymentFilter !== "todas" && transaction.type === "expense") {
      const currentPayment = normalizeText(transaction.paymentMethod || "dinheiro").toLowerCase();
      if (currentPayment !== paymentFilter) return false;
    }

    return true;
  });
}

export {
  BANK_ACCOUNT_COLLECTIONS,
  DEFAULT_ACCOUNT_NAME,
  DEFAULT_BANK,
  DEFAULT_EMOJI,
  PRIMARY_BANK_ACCOUNT_COLLECTION,
  canonicalBankName,
  createBankAccountForImport,
  filterTransactionsByQuery,
  findBankAccountById,
  findBankAccountCollections,
  findFamilyBankAccountByBank,
  findUndefinedBankAccount,
  getDefaultBankEmoji,
  getTransactionBank,
  getTransactionBankAccountId,
  groupTransactionsByBank,
  listFamilyBankAccounts,
  mirrorBankAccountRecord,
  resolveImportBankAccount,
  sortTransactionsByDateDesc,
};
