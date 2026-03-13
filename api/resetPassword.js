import admin from 'firebase-admin';

// Inicializar Firebase Admin (certifique-se de ter a chave JSON)
// Pode ser inicializado via variável de ambiente ou arquivo

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email é obrigatório' });
  }

  try {
    // Verificar se o usuário existe
    const user = await admin.auth().getUserByEmail(email);

    if (!user) {
      return res.status(404).json({ 
        error: 'Usuário não encontrado',
        success: false
      });
    }

    // Gerar link de reset de senha
    const resetLink = await admin.auth().generatePasswordResetLink(email);

    // ⚠️ IMPORTANTE: Você precisa enviar este email manualmente por enquanto
    // Veja as soluções abaixo para automatizar

    return res.status(200).json({
      success: true,
      message: 'Email de redefinição de senha pronto para envio',
      email: email,
      // Para desenvolvimento/teste (REMOVER EM PRODUÇÃO):
      resetLink: process.env.NODE_ENV === 'development' ? resetLink : undefined
    });

  } catch (error) {
    console.error('Erro ao redefinir senha:', error);

    if (error.code === 'auth/user-not-found') {
      return res.status(404).json({
        error: 'Usuário não encontrado',
        success: false
      });
    }

    if (error.code === 'auth/invalid-email') {
      return res.status(400).json({
        error: 'Email inválido',
        success: false
      });
    }

    return res.status(500).json({
      error: 'Erro ao processar redefinição de senha',
      success: false,
      details: error.message
    });
  }
}

