import { fetchTransactionsForScope } from "../_lib/analytics.js";
import { filterTransactionsByQuery, groupTransactionsByBank, listFamilyBankAccounts } from "../_lib/banks.js";
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
      includeUserFilter: true,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      orderByDate: true,
    });
    const filteredTransactions = filterTransactionsByQuery(transactions, req.query || {});
    const bankAccounts = await listFamilyBankAccounts(familyId, { uid: context.uid });
    const groupedBanks = groupTransactionsByBank(filteredTransactions, bankAccounts);

    return res.status(200).json({
      banks: groupedBanks.map((entry) => ({
        bankAccountId: entry.bankAccountId,
        bank: entry.bank,
        name: entry.name,
        emoji: entry.emoji,
        transactions: entry.transactions,
      })),
    });
  } catch (error) {
    const status =
      error && (error.message === "Unauthorized" || error.message === "Invalid token") ? 401 : 500;
    return res.status(status).json({
      error: error && error.message ? error.message : "Erro ao listar transacoes por banco",
    });
  }
}
