## 🚀 CHECKLIST: Ativar Redefinição de Senha com Email

### ⚡ Opção Mais Rápida: Gmail (5 minutos)

- [ ] **Passo 1:** Abra https://myaccount.google.com/apppasswords
- [ ] **Passo 2:** Selecione Mail + Seu dispositivo → Gerar
- [ ] **Passo 3:** Copie a senha de 16 caracteres
- [ ] **Passo 4:** Crie arquivo `.env` na raiz do projeto:
  ```
  GMAIL_USER=seu-email@gmail.com
  GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
  ```
- [ ] **Passo 5:** Instale nodemailer:
  ```bash
  npm install nodemailer
  ```
- [ ] **Passo 6:** Em `server.js`, mude:
  ```javascript
  // Mude isto:
  import resetPasswordHandler from './api/resetPassword.js';
  // Para isto:
  import resetPasswordHandler from './api/resetPassword_Gmail.js';
  ```
- [ ] **Passo 7:** Reinicie servidor: `npm start`
- [ ] **Passo 8:** Teste: Clique "Esqueceu a Senha?" → Verifique email

---

### 📋 Alternativas (Se Gmail não funcionar)

#### SendGrid (Recomendado para Produção)
- [ ] https://sendgrid.com → Criar conta gratuita
- [ ] Copiar API Key
- [ ] `npm install @sendgrid/mail`
- [ ] Ver: `EMAIL_SOLUTIONS.md` → Solução 1

#### Mailgun
- [ ] https://mailgun.com → Criar conta
- [ ] `npm install mailgun.js`
- [ ] Ver: `EMAIL_SOLUTIONS.md` → Solução 4

#### Gmail App (Alternativa)
- [ ] `npm install nodemailer`
- [ ] Ver: `SETUP_EMAIL_GMAIL.md` (este arquivo)

---

### ✅ Verificação

Após configurar:

- [ ] Arquivo `.env` criado na raiz
- [ ] `nodemailer` instalado (check `package.json`)
- [ ] `server.js` atualizado para usar `resetPassword_Gmail.js`
- [ ] Servidor reiniciado
- [ ] Tente "Esqueceu a Senha?" e verifique se email chega

---

### 🆘 Problemas?

| Problema | Solução |
|----------|---------|
| "Invalid login" | Use App Password (não senha normal) |
| Email não chega | Verifique spam + aguarde 2 min |
| ".env not found" | Crie arquivo `.env` na raiz, depois restart |
| "Cannot find 'nodemailer'" | `npm install nodemailer --save` |
| Email chega mas sem conteúdo | Verifique HTML em `resetPassword_Gmail.js` |

---

### 📞 Suporte

Problemas? Envie para: **saullinho2008@gmail.com**

Mencione:
- Qual solução está usando (Gmail/SendGrid/Outro)
- Mensagem de erro exata
- Prints se possível

---

**Status:** ⏳ _Aguardando sua confirmação de que funcionou!_

Assim que funcionar, vou ajudá-lo com próximas melhorias! 🎉
