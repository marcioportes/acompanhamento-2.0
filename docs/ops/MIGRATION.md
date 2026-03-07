# Guia de Migração - v1.2.0

## Pré-requisitos

1. **Backup do Firestore** (recomendado)
   ```bash
   # Via Firebase Console ou gcloud
   gcloud firestore export gs://SEU_BUCKET/backup-pre-1.2.0
   ```

2. **Node.js 20+** instalado

---

## Passo 1: Migrar Status dos Trades

O script migra os status legados para o novo padrão:

| Status Antigo | Status Novo |
|---------------|-------------|
| `PENDING_REVIEW` | `OPEN` |
| `IN_REVISION` | `QUESTION` |

### Executar migração:

```bash
cd functions
npm install
node migrate-trade-status.js
```

### Saída esperada:

```
═══════════════════════════════════════════
  MIGRAÇÃO DE STATUS DOS TRADES v1.2.0
═══════════════════════════════════════════

[1/2] Migrando PENDING_REVIEW → OPEN...
  Migrados 42/42...
  
[2/2] Migrando IN_REVISION → QUESTION...
  Nenhum trade com status 'IN_REVISION'

═══════════════════════════════════════════
  ✅ MIGRAÇÃO CONCLUÍDA
  Total migrados: 42 trades
═══════════════════════════════════════════

Verificando status atuais...
Distribuição de status: { OPEN: 42, REVIEWED: 156, CLOSED: 89 }
```

---

## Passo 2: Deploy das Cloud Functions

```bash
cd functions
firebase deploy --only functions
```

### Verificar deploy:

```bash
curl https://REGION-PROJECT.cloudfunctions.net/healthCheck
```

Resposta esperada:
```json
{
  "status": "ok",
  "version": "1.2.0",
  "display": "v1.2.0",
  "features": ["feedback-flow", "red-flags", "student-cards"]
}
```

---

## Passo 3: Deploy do Frontend

### Copiar arquivos:

```bash
# Versão
cp src/version.js PROJECT/src/

# Hooks
cp src/hooks/useTrades.js PROJECT/src/hooks/

# Pages
cp src/pages/MentorDashboard.jsx PROJECT/src/pages/
cp src/pages/FeedbackPage.jsx PROJECT/src/pages/

# Components
cp src/components/TradeDetailModal.jsx PROJECT/src/components/
cp src/components/TradesList.jsx PROJECT/src/components/
cp src/components/StudentFeedbackCard.jsx PROJECT/src/components/
```

### Build e deploy:

```bash
cd PROJECT
npm run build
vercel --prod
```

---

## Passo 4: Verificação

### Checklist de testes:

- [ ] healthCheck retorna versão 1.2.0
- [ ] Mentor: aba "Aguardando Feedback" mostra cards por aluno
- [ ] Mentor: clicar no ícone 🕐 filtra trades OPEN do aluno
- [ ] Mentor: clicar no ícone ❓ filtra trades QUESTION do aluno
- [ ] FeedbackPage: filtros por aluno/período funcionando
- [ ] TradeDetailModal: botão "Ver histórico" aparece quando há mensagens
- [ ] Novos trades criados com status `OPEN`

---

## Rollback (se necessário)

### Restaurar backup do Firestore:
```bash
gcloud firestore import gs://SEU_BUCKET/backup-pre-1.2.0
```

### Reverter Cloud Functions:
```bash
# Se tiver a versão anterior salva
cd functions-backup
firebase deploy --only functions
```

### Reverter Frontend:
```bash
# Via Vercel dashboard - selecionar deployment anterior
# Ou git revert + redeploy
```

---

## Notas Importantes

1. **Migração é idempotente**: Pode rodar múltiplas vezes sem problema
2. **Campos de auditoria**: `_migratedAt` e `_migratedFrom` são adicionados para rastreabilidade
3. **Compatibilidade**: O sistema funciona mesmo com trades não migrados (mapeamento legado no TradeStatusBadge)
