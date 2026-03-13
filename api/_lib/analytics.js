import { admin, db } from "./firebase.js";

function toNumber(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function aggregateTransactions(transactions) {
  const totals = {
    totalIncome: 0,
    totalExpenses: 0,
    bankBalances: new Map(),
    categoryExpenses: new Map(),
    subscriptions: [],
  };

  for (const transaction of transactions) {
    const amount = toNumber(transaction.amount);
    const bank = transaction.bank || "Outros";
    const category = transaction.category || "Outros";
    const signedAmount = transaction.type === "income" ? amount : -amount;

    if (transaction.type === "income") {
      totals.totalIncome += amount;
    } else {
      totals.totalExpenses += amount;
      totals.categoryExpenses.set(category, (totals.categoryExpenses.get(category) || 0) + amount);
    }

    totals.bankBalances.set(bank, (totals.bankBalances.get(bank) || 0) + signedAmount);

    if (transaction.subscription) {
      totals.subscriptions.push({
        description: transaction.description,
        amount,
        bank,
        date: transaction.date,
      });
    }
  }

  return {
    totalIncome: Number(totals.totalIncome.toFixed(2)),
    totalExpenses: Number(totals.totalExpenses.toFixed(2)),
    balance: Number((totals.totalIncome - totals.totalExpenses).toFixed(2)),
    topCategories: [...totals.categoryExpenses.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([category, amount]) => ({
        category,
        amount: Number(amount.toFixed(2)),
      })),
    recurringSubscriptions: totals.subscriptions.slice(0, 10),
    bankBalances: [...totals.bankBalances.entries()].map(([bank, balance]) => ({
      bank,
      balance: Number(balance.toFixed(2)),
    })),
  };
}

async function fetchTransactionsForScope({ uid, familyId }) {
  const query = familyId
    ? db.collection("transactions").where("familyId", "==", familyId)
    : db.collection("transactions").where("userId", "==", uid);

  const snapshot = await query.get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function saveAiReport({ familyId, uid, summary, analysis }) {
  const reportRef = db.collection("ai_reports").doc();
  await reportRef.set({
    id: reportRef.id,
    familyId: familyId || null,
    userId: uid,
    summary,
    analysis,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return reportRef.id;
}

export { aggregateTransactions, fetchTransactionsForScope, saveAiReport };
