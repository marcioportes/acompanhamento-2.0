# Script para executar commits e navegação no repositório
# Salve isso como um arquivo .ps1, ex.: deploy-email-fix.ps1
# Execute com: .\deploy-email-fix.ps1 (após ajustar política de execução se necessário)

# 1. Commit nas functions (assume que você está no diretório 'functions')
git commit -m @"
feat(functions): v1.4.0 - envio de email via Trigger Email Extension

- createStudent escreve na coleção /mail para extension processar
- resendStudentInvite também escreve na coleção /mail
- Adicionado sendEmail() helper e getWelcomeEmailHtml() template HTML
- Feature 'email-trigger' no healthCheck
- Requer extension 'Trigger Email from Firestore' com SMTP configurado

Closes: email não enviado ao cadastrar aluno

feat(students): v2.1.0 - DebugBadge + anti-spam SMTP

- DebugBadge conforme governança do projeto
- Cooldown de 60s por email no reenvio de convite (anti-spam)
- Anti-double-click em cadastro e remoção (disabled states)
- Botão reenviar também visível para alunos com emailError
- Spinner no botão remover durante operação
"@