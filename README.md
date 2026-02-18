# Sprint: Feedback & Emotions v3 (v6.1.0)

## 📋 Features

### 1. Máquina de Estados de Feedback

```
OPEN ──────→ REVIEWED ←──→ QUESTION
                │
                └──→ CLOSED (final)
```

| Estado | Descrição | Quem Transiciona |
|--------|-----------|------------------|
| `OPEN` | Trade criado, aguardando | Automático |
| `REVIEWED` | Mentor comentou | Mentor |
| `QUESTION` | Aluno tem dúvida | Aluno |
| `CLOSED` | Encerrado | Aluno |

### 2. Análise Emocional

- **KPIs por Trade:** Score emocional, consistência entry/exit
- **KPIs Agregados:** Best/worst emotion, tilt detection, compliance rate
- **Dashboard:** Visualização completa com recomendações

### 3. Melhorias de Segurança

- Validação de mentor em `createStudent`, `deleteStudent`, `resendStudentInvite`
- Validação de ownership em `closeTrade`
- Validação de permissões em `addFeedbackComment`

---

## 🚀 Deploy

### 1. Backend (Cloud Functions)

```bash
# Copiar arquivo
cp functions/index.js PROJECT/functions/

# Deploy
cd PROJECT/functions
npm install
firebase deploy --only functions
```

### 2. Frontend (TODOS OS ARQUIVOS INCLUÍDOS)

```bash
# Copiar TUDO de src/ para o projeto
cp src/App.jsx PROJECT/src/
cp src/Sidebar.jsx PROJECT/src/components/
cp -r src/components/* PROJECT/src/components/
cp -r src/pages/* PROJECT/src/pages/
cp -r src/hooks/* PROJECT/src/hooks/
cp -r src/utils/* PROJECT/src/utils/
```

**✅ App.jsx e Sidebar.jsx já estão integrados - basta copiar!**

### 3. Build e Deploy

```bash
npm run build
vercel --prod
```

---

## 📊 Estrutura de Dados

### Trade (campos novos)

```javascript
{
  // ... campos existentes ...
  
  status: 'OPEN' | 'REVIEWED' | 'QUESTION' | 'CLOSED',
  
  feedbackHistory: [
    {
      id: 'uuid',
      author: 'email@exemplo.com',
      authorName: 'Nome',
      authorRole: 'mentor' | 'student',
      content: 'Texto',
      status: 'REVIEWED',
      createdAt: Timestamp
    }
  ],
  
  closedAt: Timestamp | null,
  closedBy: 'email@exemplo.com' | null
}
```

### Compatibilidade

Trades existentes com `status: 'PENDING_REVIEW'` são mapeados automaticamente para `'OPEN'`.

---

## 🧪 Testes

1. **Criar trade** → Status deve ser `OPEN`
2. **Mentor comenta** → Status muda para `REVIEWED`
3. **Aluno marca dúvida** → Status muda para `QUESTION`
4. **Mentor responde** → Status volta para `REVIEWED`
5. **Aluno encerra** → Status muda para `CLOSED` (irreversível)

---

## 📁 Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `functions/index.js` | Cloud Functions v6.1.0 |
| `src/App.jsx` | App principal (v2.1.0) com FeedbackPage |
| `src/Sidebar.jsx` | Sidebar (v1.1.0) com item Feedback |
| `src/pages/FeedbackPage.jsx` | Página de feedback do aluno |
| `src/components/FeedbackThread.jsx` | Thread de comentários |
| `src/components/TradeStatusBadge.jsx` | Badge de status |
| `src/components/EmotionalAnalysisDashboard.jsx` | Dashboard emocional |
| `src/components/PlanEmotionalMetrics.jsx` | Métricas por plano |
| `src/hooks/useFeedback.js` | Hook para feedback |
| `src/utils/emotionalAnalysis.js` | Funções de análise |
