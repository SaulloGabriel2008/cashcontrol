# Soluções para Envio de Email - Reset de Senha

## 🚨 Problema
Firebase não envia emails automaticamente em modo desenvolvimento. Você precisa usar um serviço de email externo.

---

## ✅ **SOLUÇÃO 1: SendGrid (Recomendado) - GRÁTIS até 100 emails/dia**

### 1️⃣ Cadastro
1. Acesse [sendgrid.com](https://sendgrid.com)
2. Crie conta gratuita
3. Copie a API Key

### 2️⃣ Instalação
```bash
npm install @sendgrid/mail
```

### 3️⃣ Configurar `.env`
```
SENDGRID_API_KEY=SG.xxxxxxxxxxxx
SENDGRID_FROM_EMAIL=noreply@cashcontrol.com
```

### 4️⃣ Usar no Backend
```javascript
// api/resetPassword.js
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const msg = {
  to: email,
  from: process.env.SENDGRID_FROM_EMAIL,
  subject: 'Redefinir senha - Cash Control',
  html: `
    <h2>Redefinir Senha</h2>
    <p>Clique no link abaixo para redefinir sua senha:</p>
    <a href="${resetLink}">Redefinir Senha</a>
    <p>Link válido por 1 hora</p>
  `
};

await sgMail.send(msg);
```

---

## ✅ **SOLUÇÃO 2: Firebase Email Link (Alternativa Nativa)**

Usar `sendSignInLinkToEmail()` do Firebase em vez de `sendPasswordResetEmail()`:

```javascript
// No frontend (index.html)
const actionCodeSettings = {
  url: 'https://seudominio.com/verificaciones-email?email=' + email,
  handleCodeInApp: true
};

await auth.sendSignInLinkToEmail(email, actionCodeSettings)
  .then(() => {
    window.localStorage.setItem('emailForSignIn', email);
    // Email enviado via Firebase
  });
```

### Vantagem: Usa infraestrutura Firebase
### Desvantagem: Requer configurar domínio customizado

---

## ✅ **SOLUÇÃO 3: Nodemailer com Gmail (Grátis)**

### 1️⃣ Ativar Gmail App Password
1. Acesse [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
2. Crie "App password" para Node.js
3. Copie a senha gerada

### 2️⃣ Instalação
```bash
npm install nodemailer
```

### 3️⃣ Usar no Backend
```javascript
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

const mailOptions = {
  from: process.env.GMAIL_USER,
  to: email,
  subject: 'Redefinir Senha - Cash Control',
  html: `<a href="${resetLink}">Clique aqui para redefinir</a>`
};

await transporter.sendMail(mailOptions);
```

### Desvantagem: Limite de 500 emails/dia

---

## ✅ **SOLUÇÃO 4: Mailgun (Grátis - 30 dias, depois pago)**

### 1️⃣ Cadastro
- Acesse [mailgun.com](https://mailgun.com)
- Crie conta
- Obtenha chave API

### 2️⃣ Instalação
```bash
npm install mailgun.js
```

### 3️⃣ Usar no Backend
```javascript
import FormData from 'form-data';
import Mailgun from 'mailgun.js';

const mailgun = new Mailgun(FormData);
const client = mailgun.client({ username: 'api', key: process.env.MAILGUN_KEY });

await client.messages.create(process.env.MAILGUN_DOMAIN, {
  from: 'noreply@cashcontrol.com',
  to: email,
  subject: 'Redefinir Senha',
  html: `<a href="${resetLink}">Redefinir Senha</a>`
});
```

---

## 📊 Comparação

| Solução | Custo | Limite | Configuração |
|---------|-------|--------|--------------|
| **SendGrid** | Grátis | 100/dia | ⭐⭐ Fácil |
| **Gmail** | Grátis | 500/dia | ⭐⭐⭐ Médio |
| **Mailgun** | Grátis 30d | Ilimitado | ⭐⭐⭐ Médio |
| **Firebase Nativo** | Grátis | Ilimitado | ⭐⭐⭐⭐ Difícil |

---

## 🚀 Recomendação

**Para começar AGORA: Use SendGrid**
- ✅ Mais fácil de configurar
- ✅ Grátis para sempre (100/dia)
- ✅ Documentação excelente
- ✅ Suporte confiável

## 📖 Próximos Passos

1. Escolha uma solução acima
2. Instale a dependência
3. Configure as variáveis de ambiente (.env)
4. Implemente no `api/resetPassword.js`
5. Teste enviando um email

---

## 🧪 Teste Rápido (Sem Dependências)

Enquanto isso, você pode fazer upload de arquivos com links no Firebase Storage e compartilhar:

```javascript
// Gerar link de reset manualmente
const resetLink = await admin.auth().generatePasswordResetLink(email);

// Copiar e enviar via WhatsApp, email pessoal, etc.
console.log('Link de reset:', resetLink);
```

---

**Dúvidas? Me avise qual solução você prefere que termino de implementar!** 🎯
