import { admin, db } from "./firebase.js";

const CATEGORY_LABELS = {
  alimentacao: "Alimentação",
  transporte: "Transporte",
  moradia: "Moradia",
  compras: "Compras",
  assinaturas: "Assinaturas",
  saude: "Saúde",
  educacao: "Educação",
  lazer: "Lazer",
  outros: "Outros",
  salario: "Salário",
  servicos: "Serviços",
};

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

function formatCategoryLabel(category) {
  return CATEGORY_LABELS[category] || category || "Outros";
}

function buildRiskAlerts(summary) {
  const alerts = [];
  if (summary.balance < 0) {
    alerts.push("Saldo negativo no período");
  }

  const topCategory = summary.topCategories[0];
  if (topCategory && topCategory.category === "outros" && topCategory.amount > summary.totalExpenses * 0.35) {
    alerts.push("Gastos excessivos concentrados em 'Outros'");
  }

  if (!summary.recurringSubscriptions.length) {
    alerts.push("Ausência de despesas recorrentes mapeadas pode indicar categorização incompleta");
  }

  if (summary.totalIncome > 0 && summary.totalExpenses > summary.totalIncome * 0.9) {
    alerts.push("Comprometimento elevado da renda no período");
  }

  if (alerts.length === 0) {
    alerts.push("Sem alertas críticos no período analisado");
  }

  return alerts;
}

function buildSavingTips(summary) {
  const tips = [];
  const topCategory = summary.topCategories[0];

  if (topCategory && topCategory.category === "outros") {
    tips.push("Detalhar melhor a categoria Outros");
  }

  if (summary.topCategories.some((item) => item.category === "lazer")) {
    tips.push("Reduzir gastos com lazer");
  }

  if (summary.totalExpenses > summary.totalIncome) {
    tips.push("Criar um orçamento por categoria");
  }

  if (summary.recurringSubscriptions.length > 2) {
    tips.push("Revisar assinaturas recorrentes e cancelar o que nao usa");
  }

  if (tips.length === 0) {
    tips.push("Manter acompanhamento semanal das categorias para preservar o equilibrio");
  }

  return tips;
}

function buildInvestmentTips(summary) {
  const tips = [];

  if (summary.balance <= 0) {
    tips.push("Montar reserva de emergência");
    tips.push("Equilibrar orçamento antes de assumir mais risco");
  } else {
    tips.push("Guardar parte da renda mensal");
    tips.push("Avaliar renda fixa após equilibrar o orçamento");
  }

  if (summary.recurringSubscriptions.length > 0) {
    tips.push("Automatizar aporte logo após o recebimento da renda");
  }

  return [...new Set(tips)].slice(0, 3);
}

function buildStructuredAnalysis(summary, narrative) {
  return {
    summary: {
      income: summary.totalIncome,
      expense: summary.totalExpenses,
      balance: summary.balance,
    },
    topCategories: summary.topCategories.map((item) => ({
      name: formatCategoryLabel(item.category),
      amount: item.amount,
    })),
    riskAlerts: buildRiskAlerts(summary),
    savingTips: buildSavingTips(summary),
    investmentTips: buildInvestmentTips(summary),
    narrative: narrative || "",
    analysis: narrative || "",
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

export {
  aggregateTransactions,
  buildStructuredAnalysis,
  fetchTransactionsForScope,
  formatCategoryLabel,
  saveAiReport,
};
