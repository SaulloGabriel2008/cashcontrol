import { db } from "./firebase.js";

const BANK_ACCOUNT_COLLECTIONS = ["bank_accounts", "bankAccounts"];
const DEFAULT_BANK = "Banco não definido";
const DEFAULT_ACCOUNT_NAME = "Sem conta";
const DEFAULT_EMOJI = "🏦";

function normalizeText(value) {
  return String(value || "").trim();
}

function toNumber(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function getTransactionBankAccountId(transaction) {
  return transaction.bankAccountId || transaction.accountId || null;
}

function getTransactionBank(transaction) {
  return normalizeText(transaction.bank) || DEFAULT_BANK;
}

function normalizeBankAccount(id, data, collectionName) {
  const bank = normalizeText(data.bank) || DEFAULT_BANK;
  return {
    id,
    familyId: data.familyId || null,
    userId: data.userId || null,
    name: normalizeText(data.name) || bank || DEFAULT_ACCOUNT_NAME,
    bank,
    emoji: normalizeText(data.emoji) || DEFAULT_EMOJI,
    initialBalance: toNumber(data.initialBalance ?? data.balance),
    active: data.active !== false,
    createdAt: data.createdAt || null,
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
    const emoji = account?.emoji || DEFAULT_EMOJI;
    const key = bankAccountId ? `account:${bankAccountId}` : `bank:${bank.toLowerCase()}`;

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
      description: transaction.description || "Sem descrição",
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
  DEFAULT_ACCOUNT_NAME,
  DEFAULT_BANK,
  DEFAULT_EMOJI,
  filterTransactionsByQuery,
  findBankAccountById,
  getTransactionBank,
  getTransactionBankAccountId,
  groupTransactionsByBank,
  listFamilyBankAccounts,
  sortTransactionsByDateDesc,
};
