# 🚀 Como Ativar Envio de Email (Gmail) - Guia Rápido

## ✅ Passo 1: Preparar Pasta .env

Na raiz do seu projeto, crie um arquivo `.env`:

```env
GMAIL_USER=seuEmail@gmail.com
GMAIL_APP_PASSWORD=sua-senha-de-app-gerada
NODE_ENV=production
```

## ✅ Passo 2: Gerar "App Password" no Gmail

### Para contas normais:

1. Acesse: https://myaccount.google.com/apppasswords
2. Se pedir, faça login
3. Selecione:
   - App: **Mail**
   - Device: **Windows Computer** (ou seu dispositivo)
4. Clique em **Gerar**
5. **Copie a senha de 16 caracteres** que aparecerá
6. Cole em `.env` na variável `GMAIL_APP_PASSWORD`

### Se não encontrar "App passwords":

1. Ative **2FA**: https://myaccount.google.com/security
2. Role para "App passwords"
3. Siga os passos acima

## ✅ Passo 3: Atualizar Dependências

Adicione ao `package.json`:

```json
{
  "dependencies": {
    "nodemailer": "^6.9.0",
    "dotenv": "^16.0.3"
  }
}
```

Ou instale via terminal:
```bash
npm install nodemailer
```

## ✅ Passo 4: Ativar nova API no server.js

Substitua a importação de `resetPassword.js` pela versão com Gmail:

```javascript
// Em server.js, mude de:
import resetPasswordHandler from './api/resetPassword.js';

// Para:
import resetPasswordHandler from './api/resetPassword_Gmail.js';

// O resto fica igual!
```

## ✅ Passo 5: Testar

1. Inicie o servidor: `npm start`
2. Acesse o site
3. Clique em "Esqueceu a Senha?"
4. Digite seu email
5. **Verifique sua caixa de entrada** (pode demorar alguns segundos)

---

## 🔍 Troubleshooting

### ❌ "Invalid login" ou "Authentication failed"

**Solução:**
1. Verifique se usou **App Password** (não senha normal)
2. Verifique se o email em `.env` está correto
3. Teste a senha: tente logar em Gmail em outro lugar

### ❌ Email não chega

**Verificar:**
- 📧 Pasta de Spam/Lixo
- 🔒 Verifique se seu Gmail bloqueou
- ⏳ Aguarde 1-2 minutos (às vezes demora)

### ❌ GMAIL_USER: Variável não definida

**Solução:**
1. Certifique-se que `.env` está na **raiz do projeto**
2. Reinicie o servidor após criar `.env`
3. Use `process.env.GMAIL_USER` no código

### ❌ "Cannot find module 'nodemailer'"

**Solução:**
```bash
npm install nodemailer --save
```

---

## 📧 Email Customizado

O email viará com:
- ✨ Design bonito e profissional
- 🔐 Link de reset seguro
- ⏱️ Aviso de 1 hora de validade
- 📱 Responsivo para celular

---

## 🔒 Segurança

- ✅ Senhas não são armazenadas em .env em produção
- ✅ Use variáveis de ambiente no servidor
- ✅ Nunca commit `.env` no git (adicione ao `.gitignore`)

### Adicone ao `.gitignore`:
```
.env
.env.local
node_modules/
```

---

## 💡 Próximos Passos Avançados

Uma vez que esteja funcionando, você pode:

1. **Migrar para SendGrid** (mais robusto)
2. **Usar email corporativo** (Ex: no-reply@seudominio.com)
3. **Customizar template** de email
4. **Rastrear entregas** (via SendGrid/Mailgun)

---

## ❓ Dúvidas Frequentes

**P: Preciso gerar uma senha por conta?**
R: Não! Gmail gera automaticamente via App Passwords.

**P: Quanto custa?**
R: Grátis! Gmail permite até 500 emails/dia.

**P: Posso usar meu próprio domínio?**
R: Sim! Com SendGrid ou Mailgun (veja EMAIL_SOLUTIONS.md)

**P: Qual é o limite de emails?**
R: 500 emails/dia no Gmail, ilimitado em SendGrid (pagando).

---

## 🎯 Resumo Rápido

1. Gerar App Password no Gmail ✅
2. Criar arquivo `.env` ✅  
3. Instalar `nodemailer` ✅
4. Atualizar `server.js` ✅
5. Reiniciar servidor ✅
6. Testar! ✅

---

**Quando terminar, avise que funcionou!** 🎉
