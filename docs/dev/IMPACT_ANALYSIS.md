# ANÁLISE DE IMPACTO - Sprint v3 (v6.1.0)

## 📋 Escopo Reduzido

**Removido desta versão:**
- ❌ Monitoramento de erro de email
- ❌ Extension "Trigger Email from Firestore"
- ❌ Collection `/mail`
- ❌ Triggers `onMailStatusChange` e `onMailCreated`
- ❌ Badge "Erro Email" na interface

**Mantido/Adicionado:**
- ✅ Máquina de estados de feedback (OPEN → REVIEWED → QUESTION → CLOSED)
- ✅ Análise emocional avançada
- ✅ Red Flags preservadas da v5.2.0
- ✅ Validação de mentor em Cloud Functions
- ✅ Cleanup de notificações antigas

---

## 📊 Matriz de Impacto Simplificada

| # | Risco | Prob. | Sev. | Mitigação |
|---|-------|-------|------|-----------|
| 1 | TRADE_STATUS renomeado | 100% | 🟠 | `normalizeStatus()` no código |
| 2 | Campo `feedbackHistory[]` não existe em trades antigos | 100% | 🟢 | Acesso seguro `|| []` |
| 3 | FeedbackPage inacessível sem atualizar App/Sidebar | 100% | 🟠 | Integração manual (documentada) |
| 4 | Componentes emocionais não integrados | 100% | 🟢 | Integração opcional |

**Nenhum impacto crítico** nesta versão.

---

## 📁 Arquivos do Sprint

```
sprint-v3/
├── README.md                      # Instruções de deploy
├── IMPACT_ANALYSIS.md             # Este arquivo
├── functions/
│   ├── index.js                   # v6.1.0 (usar este)
│   └── package.json
└── src/
    ├── components/
    │   ├── EmotionalAnalysisDashboard.jsx
    │   ├── FeedbackThread.jsx
    │   ├── PlanEmotionalMetrics.jsx
    │   └── TradeStatusBadge.jsx
    ├── hooks/
    │   └── useFeedback.js
    ├── pages/
    │   └── FeedbackPage.jsx
    └── utils/
        └── emotionalAnalysis.js
```

---

## ✅ Checklist de Deploy

### Pré-Deploy
- [ ] Backup do Firestore (recomendado)
  ```bash
  firebase firestore:export gs://BUCKET/backup-$(date +%Y%m%d)
  ```

### Deploy Backend
- [ ] Copiar `functions/index.js`
- [ ] Deploy
  ```bash
  cd functions && npm install
  firebase deploy --only functions
  ```
- [ ] Verificar
  ```bash
  curl https://REGION-PROJECT.cloudfunctions.net/healthCheck
  # Deve retornar version: "6.1.0"
  ```

### Deploy Frontend
- [ ] Copiar arquivos de `src/`
- [ ] Atualizar `App.jsx`:
  ```jsx
  import FeedbackPage from './pages/FeedbackPage';
  // Em renderContent():
  if (currentView === 'feedback' && !isMentor()) return <FeedbackPage />;
  ```
- [ ] Atualizar `Sidebar.jsx`:
  ```jsx
  const studentMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'feedback', label: 'Feedback', icon: MessageSquare }, // NOVO
    { id: 'journal', label: 'Diário', icon: BookOpen },
    { id: 'accounts', label: 'Contas', icon: Wallet },
  ];
  ```
- [ ] Build e deploy
  ```bash
  npm run build && vercel --prod
  ```

### Pós-Deploy
- [ ] Testar criação de trade (status OPEN)
- [ ] Testar feedback do mentor (status REVIEWED)
- [ ] Testar dúvida do aluno (status QUESTION)
- [ ] Testar encerramento (status CLOSED)
- [ ] Verificar Red Flags funcionando

---

## 🔄 Comparação v5.2.0 → v6.1.0

| Aspecto | v5.2.0 | v6.1.0 |
|---------|--------|--------|
| **TRADE_STATUS** | PENDING_REVIEW, REVIEWED, IN_REVISION | OPEN, REVIEWED, QUESTION, CLOSED + mapeamento legacy |
| **Red Flags** | ✅ | ✅ (preservado) |
| **Validação Mentor** | ❌ | ✅ (adicionado) |
| **Feedback** | Campo único `mentorFeedback` | Array `feedbackHistory[]` + compatibilidade |
| **Cleanup Notificações** | ❌ | ✅ (scheduled) |
| **Email Monitoring** | ❌ | ❌ (removido do escopo) |

---

## ⏱️ Tempo Estimado

| Etapa | Tempo |
|-------|-------|
| Backup | 2 min |
| Deploy Functions | 3 min |
| Copiar arquivos frontend | 2 min |
| Atualizar App/Sidebar | 5 min |
| Build e deploy | 5 min |
| Testes | 10 min |
| **TOTAL** | **~30 min** |

---

## 🟢 Risco Geral: BAIXO

Esta versão é **conservadora**:
- Mantém toda funcionalidade existente
- Adiciona features novas de forma aditiva
- Mapeamento legacy garante compatibilidade
- Sem dependências externas (Extension)
