import { fetchTransactionsForScope } from "../_lib/analytics.js";
import { resolveFamilyId, verifyRequest } from "../_lib/firebase.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const context = await verifyRequest(req);
    const familyId = resolveFamilyId(req, context);
    const transactions = await fetchTransactionsForScope({
      uid: context.uid,
      familyId,
    });

    const bankMap = new Map();
    for (const transaction of transactions) {
      const bank = transaction.bank || "Outros";
      const amount = Number(transaction.amount || 0);
      if (!bankMap.has(bank)) {
        bankMap.set(bank, {
          bank,
          income: 0,
          expense: 0,
          balance: 0,
        });
      }

      const entry = bankMap.get(bank);
      if (transaction.type === "income") {
        entry.income += amount;
        entry.balance += amount;
      } else {
        entry.expense += amount;
        entry.balance -= amount;
      }
    }

    return res.status(200).json({
      banks: [...bankMap.values()].map((entry) => ({
        bank: entry.bank,
        income: Number(entry.income.toFixed(2)),
        expense: Number(entry.expense.toFixed(2)),
        balance: Number(entry.balance.toFixed(2)),
      })),
    });
  } catch (error) {
    const status =
      error && (error.message === "Unauthorized" || error.message === "Invalid token") ? 401 : 500;
    return res.status(status).json({
      error: error && error.message ? error.message : "Erro ao gerar relatorio por banco",
    });
  }
}
