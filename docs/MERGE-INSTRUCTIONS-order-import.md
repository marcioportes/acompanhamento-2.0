# MERGE-INSTRUCTIONS: Order Import Pipeline (CHUNK-10)
## Branch: feature/order-import
## Data: 20/03/2026
## Versão base: 1.19.7

---

### version.js
- De: 1.19.7
- Para: 1.20.0

```javascript
const VERSION = {
  version: '1.20.0',
  build: '20260320',
  display: 'v1.20.0',
  full: '1.20.0+20260320',
};
```

**Nota:** Se a sessão de correção de dívida do CHANGELOG bumpou para 1.19.8+, ajustar o "De" mas manter "Para" como 1.20.0 (feature nova = MINOR).

---

### CHANGELOG.md
- Adicionar no topo (antes da entrada mais recente):

```markdown
## [1.20.0] - 2026-03-20

### Adicionado
- **Order Import Pipeline (CHUNK-10):** Importação de ordens brutas da corretora com detecção automática de formato (Tradovate + genérico). Pipeline: Upload → Parse → Validação 3 camadas → Preview → Staging → Ingestão → Correlação → Cross-check
- **Cross-check comportamental:** 8 métricas derivadas de ordens vs trades — stopOrderRate, modifyRate, cancelRate, marketOrderPct, holdTimeAsymmetry, averagingDownCount, ghostOrderCount, orderToTradeRatio
- **KPI Validation:** Detecção de inflação de KPIs (win rate inflado por ausência de stop, ghost orders, hold time asymmetry). Severidades NONE/MODERATE/SEVERE com alertas automáticos
- **Correlação ordem↔trade:** Matching por instrumento + timestamp + side + quantity com confidence score (0-1). Ghost orders detectados automaticamente
- **CrossCheckDashboard:** Painel mentor com métricas agrupadas (Proteção, Hold Time, Padrões, KPI Validation) + alertas comportamentais
- **KPIValidationCard:** Card compacto de status KPI para StudentDashboard
- **OrderImportPage:** Wizard modal com 5 etapas (Upload → Preview → Plano → Import → Resultado)
- **Novas collections Firestore:** `ordersStagingArea` (temporária), `orders` (imutável), `orderAnalysis` (cross-check por período)

### Componentes novos
- `src/pages/OrderImportPage.jsx`
- `src/components/OrderImport/OrderUploader.jsx`
- `src/components/OrderImport/OrderPreview.jsx`
- `src/components/OrderImport/OrderValidationReport.jsx`
- `src/components/OrderImport/OrderCorrelation.jsx`
- `src/components/OrderImport/CrossCheckDashboard.jsx`
- `src/components/OrderImport/KPIValidationCard.jsx`

### Utils novos
- `src/utils/orderParsers.js` v1.0.0 — Tradovate + genérico + helpers de normalização
- `src/utils/orderNormalizer.js` v1.0.0 — Schema unificado + deduplicação
- `src/utils/orderValidation.js` v1.0.0 — Pipeline 3 camadas (structural, consistency, business)
- `src/utils/orderCorrelation.js` v1.0.0 — Matching ordem↔trade com confidence
- `src/utils/orderCrossCheck.js` v1.0.0 — 8 métricas cross-check + averaging down detection
- `src/utils/kpiValidation.js` v1.0.0 — KPI inflation detection + alertas

### Hooks novos
- `src/hooks/useOrderStaging.js` v1.0.0 — Staging CRUD (padrão useCsvStaging)
- `src/hooks/useOrders.js` v1.0.0 — Listener read-only da collection orders
- `src/hooks/useCrossCheck.js` v1.0.0 — Cross-check compute + persist

### Testes
- 117 novos testes em 5 suites: orderParsers (44), orderValidation (23), orderCorrelation (14), orderCrossCheck (15), kpiValidation (21)
- 588 testes totais (27 suites), zero regressão
```

---

### StudentDashboard.jsx
- Adicionar imports:

```javascript
import OrderImportPage from '../pages/OrderImportPage'; // CHUNK-10: se não usar como page top-level
// OU, se preferir como componente inline:
import KPIValidationCard from '../components/OrderImport/KPIValidationCard';
import CrossCheckDashboard from '../components/OrderImport/CrossCheckDashboard';
import useOrderStaging from '../hooks/useOrderStaging';
import useOrders from '../hooks/useOrders';
import useCrossCheck from '../hooks/useCrossCheck';
```

- Adicionar state:

```javascript
const [showOrderImport, setShowOrderImport] = useState(false);
```

- Adicionar hooks (dentro do componente, após os hooks existentes):

```javascript
const orderStaging = useOrderStaging(overrideStudentId);
const { orders, stats: orderStats } = useOrders(overrideStudentId);
const crossCheckHook = useCrossCheck(overrideStudentId);
```

- Adicionar botão de import (próximo ao CsvImportCard):

```jsx
{/* Order Import — Botão */}
<button
  onClick={() => setShowOrderImport(true)}
  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-blue-500/20 bg-blue-500/5 hover:border-blue-500/40 transition-all text-xs text-blue-300"
>
  <Upload className="w-3.5 h-3.5" />
  Importar Ordens
</button>

{/* KPI Validation Card (se há análise) */}
{crossCheckHook.latestAnalysis?.kpiValidation && (
  <KPIValidationCard
    kpiValidation={crossCheckHook.latestAnalysis.kpiValidation}
    onClick={() => {/* scroll to cross-check ou abrir modal */}}
  />
)}
```

- Adicionar modal (ao final, junto com CsvImportWizard):

```jsx
{showOrderImport && (
  <OrderImportPage
    onClose={() => setShowOrderImport(false)}
    plans={plans}
    trades={trades}
    orderStaging={orderStaging}
    crossCheck={crossCheckHook}
  />
)}
```

- Adicionar CrossCheckDashboard (visível quando há análise, abaixo do PlanLedgerExtract ou em seção dedicada):

```jsx
{crossCheckHook.latestAnalysis && (
  <div className="mt-4">
    <CrossCheckDashboard analysis={crossCheckHook.latestAnalysis} />
  </div>
)}
```

**NOTA:** Estas são sugestões de integração. A posição exata no layout do StudentDashboard fica a critério do Marcio durante o merge, pois ele conhece o layout atual melhor.

---

### firestore.rules
- Adicionar regras para as 3 novas collections:

```
// ========== Order Import (CHUNK-10) ==========

match /ordersStagingArea/{docId} {
  allow read: if request.auth != null && (
    request.auth.uid == resource.data.studentId ||
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'mentor'
  );
  allow create: if request.auth != null;
  allow delete: if request.auth != null && (
    request.auth.uid == resource.data.studentId ||
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'mentor'
  );
  // Staging é write-once — sem update
  allow update: if false;
}

match /orders/{docId} {
  allow read: if request.auth != null && (
    request.auth.uid == resource.data.studentId ||
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'mentor'
  );
  allow create: if request.auth != null;
  // Ordens são IMUTÁVEIS após ingestão
  allow update: if false;
  allow delete: if false;
}

match /orderAnalysis/{docId} {
  allow read: if request.auth != null && (
    request.auth.uid == resource.data.studentId ||
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'mentor'
  );
  allow create: if request.auth != null;
  // Análises podem ser recalculadas (overwrite por novo doc, não update)
  allow update: if false;
  allow delete: if false;
}
```

---

### App.jsx
- **NÃO precisa de alteração.** OrderImportPage é modal renderizado dentro do StudentDashboard, não uma view top-level. Navegação via state local (`showOrderImport`).

---

### functions/index.js
- **NÃO precisa de alteração.** Zero Cloud Functions nesta versão. Tudo client-side.

---

### package.json
- **NÃO precisa de alteração.** Papaparse já está nas dependências (`^5.5.3`). Nenhuma nova dependência adicionada.

---

### Firestore Indexes (firestore.indexes.json)
- Adicionar índices compostos recomendados:

```json
{
  "collectionGroup": "orders",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "studentId", "order": "ASCENDING" },
    { "fieldPath": "planId", "order": "ASCENDING" },
    { "fieldPath": "submittedAt", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "orders",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "studentId", "order": "ASCENDING" },
    { "fieldPath": "importedAt", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "ordersStagingArea",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "studentId", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "orderAnalysis",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "studentId", "order": "ASCENDING" },
    { "fieldPath": "generatedAt", "order": "DESCENDING" }
  ]
}
```

**NOTA:** Hooks têm fallback sem index (sort client-side), então os indexes são otimização, não bloqueio.

---

*MERGE-INSTRUCTIONS v1.0 — 20/03/2026*
*Chunk: CHUNK-10 (Order Import Pipeline)*
*Branch: feature/order-import*
