# Release — Functions v1.4.0 + StudentsManagement v2.1.0

## Correções desta iteração

### 1. DebugBadge — prop correta
- **Antes (errado):** `<DebugBadge page="..." version="..." />`
- **Agora (correto):** `<DebugBadge component="StudentsManagement" />`
- DebugBadge importa `VERSION` de `../version.js` internamente, não recebe version como prop

### 2. sendEmail — campo `from` restaurado
- **Antes (faltando):** `{ to, message: { subject, html } }`
- **Agora (correto):** `{ to, from: FROM_EMAIL, message: { subject, html } }`
- `FROM_EMAIL = 'Acompanhamento 2.0 <portes.marcio@gmail.com>'`
- Sem o `from`, a extension usa o default da config — que pode não estar setado

## Git Commits

```bash
# 1. Cloud Functions
cd functions
git add index.js
git commit -m "feat(functions): v1.4.0 - email via Trigger Email Extension

- createStudent e resendStudentInvite escrevem em /mail
- sendEmail() inclui campo from (FROM_EMAIL)
- Template HTML de boas-vindas com link de reset
- Feature 'email-trigger' no healthCheck

Closes: email não enviado ao cadastrar aluno"

# 2. Frontend
cd ..
git add src/pages/StudentsManagement.jsx
git commit -m "feat(students): v2.1.0 - DebugBadge + anti-spam SMTP

- DebugBadge com prop component (não page/version)
- Cooldown 60s por email no reenvio (anti-spam)
- Anti-double-click em cadastro e remoção
- Botão reenviar visível para alunos com emailError"
```

## Deploy

```bash
cd functions && firebase deploy --only functions
# Verificar: curl healthCheck → version: "1.4.0"
# Testar: deletar aluno → recadastrar → checar /mail no Firestore
```
