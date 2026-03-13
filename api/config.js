// Rota simples para o cliente descobrir o valor da variável de ambiente
// necessária para chamar a API. Fazendo uma requisição a /api/config, o
// frontend não precisa embutir o URL no bundle e o valor pode ser mantido
// secreto no dashboard do Vercel.

export default function handler(req, res) {
  // normalmente isso vai ser algo como '' (vazio) ou uma URL externa.
  let apiBase = process.env.API_BASE_URL;
  if (!apiBase) {
    // se não estiver definida, assumimos o padrão de funções em /api
    apiBase = '/api';
  }
  res.status(200).json({ apiBaseUrl: apiBase });
}
