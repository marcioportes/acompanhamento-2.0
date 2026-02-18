# Sprint v1.2.0 - Feedback Cards & Filtros

## 📋 Resumo

Esta versão adiciona:
- **Cards por aluno** na aba "Aguardando Feedback" do mentor
- **Filtros avançados** no FeedbackPage (aluno, período, busca)
- **Coluna de status** no TradesList
- **Script de migração** para status legados

---

## 🚀 Quick Start

### 1. Migrar dados
```bash
cd functions
node migrate-trade-status.js
```

### 2. Deploy backend
```bash
firebase deploy --only functions
```

### 3. Deploy frontend
```bash
cp -r src/* PROJECT/src/
npm run build && vercel --prod
```

---

## 📁 Arquivos

```
sprint-v1.2.0/
├── CHANGELOG.md
├── MIGRATION.md
├── README.md
├── functions/
│   ├── index.js                    # v1.2.0
│   ├── package.json
│   └── migrate-trade-status.js     # Script de migração
└── src/
    ├── version.js                  # 1.2.0
    ├── hooks/
    │   └── useTrades.js            # v1.2.0
    ├── pages/
    │   ├── FeedbackPage.jsx        # v1.2.0
    │   └── MentorDashboard.jsx     # v1.2.0
    └── components/
        ├── TradeDetailModal.jsx    # v1.2.0
        ├── TradesList.jsx          # v1.2.0
        └── StudentFeedbackCard.jsx # NOVO
```

---

## 🎨 Nova UI: Cards por Aluno

```
┌──────────────────────┐  ┌──────────────────────┐
│  João Silva          │  │  Maria Santos        │
│  joao@email.com      │  │  maria@email.com     │
│                      │  │                      │
│  🕐 3  Feedback      │  │  🕐 1  Feedback      │
│  ❓ 1  Dúvidas       │  │  ❓ 2  Dúvidas       │
│                      │  │                      │
│  ✓ 10 revisados      │  │  ✓ 5 revisados       │
│  🔒 8 encerrados     │  │  🔒 3 encerrados     │
└──────────────────────┘  └──────────────────────┘
```

**Comportamento:**
- Clique em **🕐 Feedback** → Lista trades OPEN do aluno
- Clique em **❓ Dúvidas** → Lista trades QUESTION do aluno
- Clique no **nome/avatar** → Abre dashboard completo do aluno

---

## 🔧 Correções

| Issue | Descrição | Status |
|-------|-----------|--------|
| getTradesAwaitingFeedback | Incluir OPEN + QUESTION | ✅ |
| serverTimestamp em array | Usar ISO string | ✅ |
| Status legados | Migrar PENDING_REVIEW/IN_REVISION | ✅ |
| Versões inconsistentes | Padronizar para 1.2.0 | ✅ |

---

## 📊 Novos Helpers em useTrades

```javascript
// Contagem por status de um aluno
const counts = getStudentFeedbackCounts('aluno@email.com');
// { open: 3, question: 1, reviewed: 10, closed: 8, total: 22 }

// Trades filtrados por aluno + status
const trades = getTradesByStudentAndStatus('aluno@email.com', 'OPEN');
```

---

## ⚠️ Importante

1. **Execute a migração ANTES do deploy** das functions
2. **Backup do Firestore** recomendado antes de migrar
3. **Teste em staging** se possível

Ver `MIGRATION.md` para instruções detalhadas.
