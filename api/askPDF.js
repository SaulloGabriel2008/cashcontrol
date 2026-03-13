import { aggregateTransactions, fetchTransactionsForScope, formatCategoryLabel } from "./_lib/analytics.js";
import { getGeminiModel } from "./_lib/gemini.js";
import { resolveFamilyId, verifyRequest } from "./_lib/firebase.js";

const BANKS = ["nubank", "inter", "itau", "santander", "bradesco", "caixa"];
const CATEGORY_ALIASES = {
  alimentacao: ["alimentacao", "alimentação", "mercado", "restaurante", "comida", "ifood"],
  transporte: ["transporte", "uber", "99", "combustivel", "combustível"],
  moradia: ["moradia", "aluguel", "condominio", "condomínio", "energia", "internet"],
  compras: ["compras", "amazon", "mercado livre", "magazine luiza", "shopee"],
  assinaturas: ["assinaturas", "assinatura", "netflix", "spotify", "disney", "prime"],
  saude: ["saude", "saúde", "farmacia", "farmácia", "hospital", "medico", "médico"],
  educacao: ["educacao", "educação", "curso", "faculdade", "escola"],
  lazer: ["lazer", "cinema", "show", "viagem", "bar"],
  outros: ["outros", "outras"],
};
const STOP_WORDS = new Set([
  "quanto", "teve", "transacao", "transacoes", "entre", "mim", "e", "de", "da", "do", "das", "dos",
  "com", "para", "por", "na", "no", "nas", "nos", "que", "qual", "quais", "foi", "foram", "meu",
  "minha", "meus", "minhas", "saldo", "gasto", "gastei", "recebi", "recebido", "recebida", "enviado",
  "enviei", "transferencia", "transferência", "pix", "periodo", "período", "categoria", "banco", "teve",
]);

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function formatCurrencyBRL(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

function formatDateBR(date) {
  if (!date) return "";
  const [year, month, day] = String(date).split("-");
  if (!year || !month || !day) return String(date);
  return `${day}/${month}/${year}`;
}

function extractDateRange(question) {
  const normalizedQuestion = normalize(question);
  const explicitDates = [...String(question || "").matchAll(/(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})/g)].map((match) =>
    normalizeDate(match[1])
  ).filter(Boolean);

  if (explicitDates.length >= 2) {
    return {
      start: explicitDates[0],
      end: explicitDates[1],
    };
  }

  const monthMatch = normalizedQuestion.match(/(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?:\s+de\s+(\d{4}))?/);
  if (monthMatch) {
    const monthMap = {
      janeiro: 1,
      fevereiro: 2,
      marco: 3,
      abril: 4,
      maio: 5,
      junho: 6,
      julho: 7,
      agosto: 8,
      setembro: 9,
      outubro: 10,
      novembro: 11,
      dezembro: 12,
    };
    const year = monthMatch[2] || String(new Date().getFullYear());
    const month = String(monthMap[monthMatch[1]]).padStart(2, "0");
    const lastDay = new Date(Number(year), Number(month), 0).getDate();
    return {
      start: `${year}-${month}-01`,
      end: `${year}-${month}-${String(lastDay).padStart(2, "0")}`,
    };
  }

  return null;
}

function normalizeDate(value) {
  const text = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function detectCategory(question) {
  const normalizedQuestion = normalize(question);
  for (const [category, aliases] of Object.entries(CATEGORY_ALIASES)) {
    if (aliases.some((alias) => normalizedQuestion.includes(alias))) {
      return category;
    }
  }
  return null;
}

function detectBank(question) {
  const normalizedQuestion = normalize(question);
  const bank = BANKS.find((item) => normalizedQuestion.includes(item));
  if (!bank) return null;
  if (bank === "itau") return "Itaú";
  return bank.charAt(0).toUpperCase() + bank.slice(1);
}

function extractEntityTerms(question) {
  return normalize(question)
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length >= 3 && !STOP_WORDS.has(term));
}

function filterByDateRange(transactions, dateRange) {
  if (!dateRange) return transactions;
  return transactions.filter((transaction) => {
    return transaction.date >= dateRange.start && transaction.date <= dateRange.end;
  });
}

function filterTransactions(transactions, question) {
  const normalizedQuestion = normalize(question);
  const dateRange = extractDateRange(question);
  let filtered = filterByDateRange(transactions, dateRange);

  const bank = detectBank(question);
  if (bank) {
    filtered = filtered.filter((transaction) => normalize(transaction.bank) === normalize(bank));
  }

  const category = detectCategory(question);
  if (category) {
    filtered = filtered.filter((transaction) => normalize(transaction.category) === category);
  }

  const entityTerms = extractEntityTerms(question);
  const mentionsTransfer =
    normalizedQuestion.includes("transfer") ||
    normalizedQuestion.includes("pix") ||
    normalizedQuestion.includes("recebi") ||
    normalizedQuestion.includes("enviei") ||
    normalizedQuestion.includes("entre mim e");

  if (mentionsTransfer && entityTerms.length) {
    const entityFiltered = filtered.filter((transaction) => {
      const haystack = normalize(transaction.description);
      return entityTerms.some((term) => haystack.includes(term));
    });
    return {
      filtered: entityFiltered,
      entityTerms,
      bank,
      category,
      dateRange,
      mentionsTransfer,
    };
  }

  return {
    filtered,
    entityTerms,
    bank,
    category,
    dateRange,
    mentionsTransfer,
  };
}

function sumTransactions(transactions) {
  return transactions.reduce(
    (accumulator, transaction) => {
      const amount = Number(transaction.amount || 0);
      if (transaction.type === "income") {
        accumulator.income += amount;
      } else {
        accumulator.expense += amount;
      }
      return accumulator;
    },
    { income: 0, expense: 0 }
  );
}

function buildEvidence(transactions) {
  return transactions.slice(0, 8).map((transaction) => ({
    date: transaction.date,
    description: transaction.description,
    amount: transaction.amount,
    type: transaction.type,
    bank: transaction.bank || "Outros",
    category: transaction.category || "outros",
  }));
}

function answerTransferQuestion(filteredTransactions, entityTerms, question) {
  const label = entityTerms.length ? entityTerms.join(" ") : "o termo consultado";
  if (!filteredTransactions.length) {
    return {
      deterministic: true,
      answer: `Não encontrei transações envolvendo ${label} no período consultado.`,
      evidence: [],
    };
  }

  const totals = sumTransactions(filteredTransactions);
  const net = totals.income - totals.expense;
  const lines = filteredTransactions.slice(0, 8).map((transaction) => {
    const direction = transaction.type === "income" ? "recebida de" : "enviada para";
    return `- ${formatDateBR(transaction.date)}: Transferência ${direction} ${transaction.description} — ${formatCurrencyBRL(transaction.amount)}`;
  });

  return {
    deterministic: true,
    answer:
      `Encontrei ${filteredTransactions.length} transação(ões) envolvendo ${label}:\n` +
      `${lines.join("\n")}\n\n` +
      `Total recebido: ${formatCurrencyBRL(totals.income)}\n` +
      `Total enviado: ${formatCurrencyBRL(totals.expense)}\n` +
      `Saldo líquido: ${formatCurrencyBRL(net)}`,
    evidence: buildEvidence(filteredTransactions),
    totals: {
      income: totals.income,
      expense: totals.expense,
      net,
    },
  };
}

function answerTopSpendingQuestion(filteredTransactions) {
  const expenses = filteredTransactions.filter((transaction) => transaction.type === "expense");
  if (!expenses.length) {
    return {
      deterministic: true,
      answer: "Não encontrei gastos no período consultado.",
      evidence: [],
    };
  }

  const summary = aggregateTransactions(expenses);
  const ranking = summary.topCategories
    .map((item) => `- ${formatCategoryLabel(item.category)}: ${formatCurrencyBRL(item.amount)}`)
    .join("\n");

  return {
    deterministic: true,
    answer: `Onde você mais gasta neste recorte:\n${ranking}`,
    evidence: buildEvidence(
      expenses
        .sort((left, right) => Number(right.amount || 0) - Number(left.amount || 0))
        .slice(0, 5)
    ),
  };
}

function answerTotalsQuestion(filteredTransactions, bank, category) {
  if (!filteredTransactions.length) {
    return {
      deterministic: true,
      answer: "Não encontrei transações para esse filtro.",
      evidence: [],
    };
  }

  const totals = sumTransactions(filteredTransactions);
  const scopeLabel = bank
    ? `no banco ${bank}`
    : category
      ? `na categoria ${formatCategoryLabel(category)}`
      : "no período consultado";

  return {
    deterministic: true,
    answer:
      `Resumo ${scopeLabel}:\n` +
      `Entradas: ${formatCurrencyBRL(totals.income)}\n` +
      `Saídas: ${formatCurrencyBRL(totals.expense)}\n` +
      `Saldo líquido: ${formatCurrencyBRL(totals.income - totals.expense)}`,
    evidence: buildEvidence(filteredTransactions),
    totals: {
      income: totals.income,
      expense: totals.expense,
      net: totals.income - totals.expense,
    },
  };
}

async function answerWithGemini(question, filteredTransactions) {
  if (!filteredTransactions.length) {
    return {
      deterministic: true,
      answer: "Não encontrei transações relacionadas à sua pergunta.",
      evidence: [],
    };
  }

  const summary = aggregateTransactions(filteredTransactions);
  const evidence = buildEvidence(filteredTransactions);
  const model = getGeminiModel();
  const prompt = `Você é o assistente financeiro do Cash Control.
Responda apenas com base no contexto abaixo.

Pergunta:
${question}

Resumo:
${JSON.stringify(summary, null, 2)}

Evidências:
${JSON.stringify(evidence, null, 2)}

Responda em português, de forma específica, sem inventar dados.`;

  const result = await model.generateContent(prompt);
  return {
    deterministic: false,
    answer: result.response.text(),
    evidence,
    summary,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const context = await verifyRequest(req);
    const familyId = resolveFamilyId(req, context);
    const body = req.body || {};
    const question = String(body.question || "").trim();

    if (!question) {
      return res.status(400).json({ error: "Pergunta obrigatória" });
    }

    const transactions = await fetchTransactionsForScope({
      uid: context.uid,
      familyId,
    });
    const retrieval = filterTransactions(transactions, question);
    const normalizedQuestion = normalize(question);

    let response;
    if (retrieval.mentionsTransfer && retrieval.entityTerms.length) {
      response = answerTransferQuestion(retrieval.filtered, retrieval.entityTerms, question);
    } else if (
      normalizedQuestion.includes("mais gasto") ||
      normalizedQuestion.includes("onde gasto mais") ||
      normalizedQuestion.includes("onde estou gastando mais")
    ) {
      response = answerTopSpendingQuestion(retrieval.filtered);
    } else if (
      normalizedQuestion.includes("quanto") ||
      normalizedQuestion.includes("total") ||
      normalizedQuestion.includes("saldo") ||
      normalizedQuestion.includes("entradas") ||
      normalizedQuestion.includes("saidas") ||
      normalizedQuestion.includes("saídas")
    ) {
      response = answerTotalsQuestion(retrieval.filtered, retrieval.bank, retrieval.category);
    } else {
      response = await answerWithGemini(question, retrieval.filtered);
    }

    return res.status(200).json({
      success: true,
      familyId,
      ...response,
    });
  } catch (error) {
    const status =
      error && (error.message === "Unauthorized" || error.message === "Invalid token") ? 401 : 500;
    return res.status(status).json({
      error: error && error.message ? error.message : "Erro ao consultar a IA",
    });
  }
}
