# Função de Redefinição de Senha - Cash Control

## � IMPORTANTE: Email Não Está Chegando?

**Veja o arquivo: [`SETUP_EMAIL_GMAIL.md`](SETUP_EMAIL_GMAIL.md)** (Guia rápido de 5 minutos!)

Ou leia: [`EMAIL_SOLUTIONS.md`](EMAIL_SOLUTIONS.md) (Todas as opções disponíveis)

A função de redefinição de senha permite que usuários recuperem suas contas caso esqueçam a senha. O sistema utiliza Firebase Authentication para gerenciar este processo de forma segura.

## 🎯 Recursos

- ✅ Interface intuitiva com link "Esqueceu a Senha?"
- ✅ Envio de email de redefinição via Firebase
- ✅ Validação de email
- ✅ Mensagens de sucesso/erro claras
- ✅ Redirecionamento automático após sucesso
- ✅ Endpoint backend para gerenciamento adicional

## 📚 Como Funciona

### Frontend (index.html)

#### 1. **Interface de Redefinição**
A tela de redefinição está localizada em:
- ID: `reset-form`
- Classe: `hidden` (oculta por padrão)

#### 2. **Navegação entre Telas**
```javascript
showForgotPassword()   // Mostra a tela de reset
showLogin()            // Volta à tela de login
```

#### 3. **Função Principal: `handlePasswordReset()`**
```javascript
async function handlePasswordReset() {
  // 1. Valida o email
  // 2. Envia email de reset via Firebase
  // 3. Mostra mensagem de sucesso
  // 4. Redireciona para login em 5 segundos
}
```

### Backend (api/resetPassword.js)

#### Endpoint: `POST /resetPassword`

**Requisição:**
```json
{
  "email": "usuario@email.com"
}
```

**Respostas:**

✅ Sucesso (200):
```json
{
  "success": true,
  "message": "Email de redefinição de senha enviado com sucesso",
  "email": "usuario@email.com"
}
```

❌ Erro (400/404/500):
```json
{
  "success": false,
  "error": "Mensagem do erro"
}
```

## 🔐 Fluxo de Segurança

1. Usuário clica em "Esqueceu a Senha?"
2. Insere seu email registrado
3. **Firebase gera link seguro (1 hora válidade)**
4. **GMAIL/SENDGRID/Outro serviço envia o email** ⚠️ [VER SETUP_EMAIL_GMAIL.md](SETUP_EMAIL_GMAIL.md)
5. Usuário clica no link do email
6. Firebase abre página de reset de password
7. Usuário define nova senha
8. Senha é atualizada no Firebase

## 🛠️ Instalação

### 1. Firebase Configuration (já implementado)
O projeto já usa Firebase Authentication. Nenhuma configuração adicional necessária.

### 2. Configuração de Envio de Email (opcional)

Para emails customizados, configure um provedor:

**Opção A: Sendgrid**
```json
{
  "dependencies": {
    "@sendgrid/mail": "^7.7.0"
  }
}
```

**Opção B: Mailgun**
```json
{
  "dependencies": {
    "mailgun.js": "^9.0.0"
  }
}
```

## 📖 Uso no Frontend

### 1. Iniciar Processo de Reset
```javascript
// Automaticamente disparado pelo botão
onclick="showForgotPassword()"
```

### 2. Validar Email
```javascript
// A função valida:
- Email vazio
- Email no formato correto
- Usuário existe no Firebase
```

### 3. Receber Confirmação
```javascript
// Após envio bem-sucedido:
// ✅ Email de redefinição enviado para usuario@email.com
// Voltando para login em 5 segundos...
```

## 🔌 Uso do Backend

### Exemplo com fetch():
```javascript
const response = await fetch('/resetPassword', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'usuario@email.com'
  })
});

const data = await response.json();
console.log(data);
```

### Exemplo com curl:
```bash
curl -X POST http://localhost:3000/resetPassword \
  -H "Content-Type: application/json" \
  -d '{"email": "usuario@email.com"}'
```

## ⚠️ Mensagens de Erro

| Código | Mensagem |
|--------|----------|
| `auth/invalid-email` | Email inválido |
| `auth/user-not-found` | Usuário não encontrado. Crie uma conta primeiro |
| `auth/too-many-requests` | Muitas tentativas. Tente novamente mais tarde |
| `Erro ao processar` | Erro genérico |

## 🔒 Segurança

- ✅ Tokens Firebase temporários (válidos por 1 hora)
- ✅ Validação no backend
- ✅ Limite de rate limiting (Firebase)
- ✅ Sem armazenamento de senhas em texto plano
- ✅ HTTPS recomendado em produção

## 🐛 Troubleshooting

### "Email não encontrado"
- Verifique se o email é exatamente o registrado
- Crie uma conta se não tiver

### "Muitas tentativas"
- Aguarde alguns minutos
- Limite é 5 requisições por email em 5 minutos (Firebase)

### Email não recebido
- Verifique spam/lixo
- Verifique domínio do remetente no Firebase
- Teste com email da conta desenvolvedor

## 📞 Contato para Suporte

Para problemas com a função de redefinição de senha, contacte: saullinho2008@gmail.com

## 📝 Arquivos Modificados

- ✅ `index.html` - Interface e funções frontend
- ✅ `server.js` - Rota do endpoint
- ✅ `api/resetPassword.js` - Handler do backend

---

**Última atualização:** 12 de Março de 2026
