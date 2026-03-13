import nodemailer from 'nodemailer';
import admin from 'firebase-admin';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email é obrigatório' });
  }

  try {
    // 1. Verificar se o usuário existe no Firebase
    const user = await admin.auth().getUserByEmail(email);

    if (!user) {
      return res.status(404).json({ 
        error: 'Usuário não encontrado',
        success: false
      });
    }

    // 2. Gerar link de reset seguro
    const resetLink = await admin.auth().generatePasswordResetLink(email);

    // 3. Configurar transportador de email (Gmail)
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER || 'seuEmail@gmail.com',
        pass: process.env.GMAIL_APP_PASSWORD || 'sua-senha-de-app'
      }
    });

    // 4. Preparar email
    const mailOptions = {
      from: process.env.GMAIL_USER || 'Cash Control <seuEmail@gmail.com>',
      to: email,
      subject: '🔐 Redefinir Senha - Cash Control',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: 'Plus Jakarta Sans', sans-serif; background: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .header { text-align: center; margin-bottom: 30px; }
            .logo { font-size: 48px; margin-bottom: 10px; }
            h1 { color: #10b981; margin: 0; }
            .content { color: #333; line-height: 1.6; margin-bottom: 30px; }
            .button { display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #10b981, #059669); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
            .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px; }
            .warning { background: #f3f4f6; padding: 15px; border-left: 4px solid #f59e0b; border-radius: 4px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">💰</div>
              <h1>Cash Control</h1>
              <p style="color: #666; margin: 5px 0;">Redefinir Senha</p>
            </div>

            <div class="content">
              <p>Olá,</p>
              <p>Você solicitou a redefinição de senha no Cash Control. Clique no botão abaixo para continuar:</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetLink}" class="button">🔑 Redefinir Minha Senha</a>
              </div>

              <p style="color: #666; font-size: 14px;">
                Ou copie e cole este link no seu navegador:
                <br>
                <code style="background: #f3f4f6; padding: 10px; display: block; word-break: break-all; margin-top: 10px;">
                  ${resetLink}
                </code>
              </p>

              <div class="warning">
                <strong>⚠️ Segurança:</strong> Este link é válido por 1 hora. Se você não solicitou esta redefinição, ignore este email.
              </div>

              <p style="color: #666; font-size: 14px;">
                <strong>Dúvidas?</strong> Responda este email ou contacte nosso suporte.
              </p>
            </div>

            <div class="footer">
              <p>© 2026 Cash Control. Todos os direitos reservados.</p>
              <p>Este é um email automático, não responda diretamente.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    // 5. Enviar email
    await transporter.sendMail(mailOptions);

    return res.status(200).json({
      success: true,
      message: 'Email de redefinição enviado com sucesso',
      email: email
    });

  } catch (error) {
    console.error('Erro ao redefinir senha:', error);

    // Tratamento de erros
    if (error.code === 'auth/user-not-found') {
      return res.status(404).json({
        error: 'Usuário não encontrado com este email',
        success: false
      });
    }

    if (error.code === 'auth/invalid-email') {
      return res.status(400).json({
        error: 'Email inválido',
        success: false
      });
    }

    // Erros de email
    if (error.message.includes('Invalid login') || error.message.includes('authentication')) {
      return res.status(500).json({
        error: 'Erro ao enviar email. Verifique as credenciais de email no servidor.',
        success: false,
        hint: 'Use Gmail App Password, não sua senha normal'
      });
    }

    return res.status(500).json({
      error: 'Erro ao processar redefinição de senha',
      success: false,
      details: error.message
    });
  }
}
