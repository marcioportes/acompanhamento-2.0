# Mentor Lock — Spec Técnica

> SSoT para o lock comportamental do mentor sobre trades do aluno (correção pedagógica).
> Migrado de `docs/dev/archive/2026-Q2/issue-188-feedback-lock-currency-context.md` (refactor #199).
> **Implementação:** `src/utils/tradeGateway.js` + `firestore.rules` + `functions/index.js` (`onTradeUpdated`) + `src/components/feedback/MentorEditPanel.jsx`. Versão entregue: 1.45.0.

---

## Contexto

Mentor comenta no trade do aluno mas, sem mecanismo de correção, vira "mensageiro ignorado". Lock comportamental permite o mentor corrigir 3 campos subjetivos (`emotionEntry`, `emotionExit`, `setup`) e travar a interpretação pedagógica do trade. Aluno e CF de import preservam acesso a campos factuais (entry/exit/qty/result).

---

## Schema

### Mutações no doc trade (write atômico)

```js
trade._lockedByMentor = true
trade._lockedAt       = serverTimestamp()
trade._lockedBy       = { uid, email, name }
trade._mentorEdits.push({
  field, oldValue, newValue,
  editedAt, editedBy: { uid, email }
})   // append-only
trade._studentOriginal = { emotionEntry, emotionExit, setup }   // gravado no 1º edit, IMUTÁVEL após
trade.<field> = newValue   // só nos 3 whitelisted
```

### Whitelist `MENTOR_EDITABLE_FIELDS`

Definida em `src/utils/tradeGateway.js`:

```js
const MENTOR_EDITABLE_FIELDS = ['emotionEntry', 'emotionExit', 'setup'];
```

DEC-AUTO-188-02: campos comportamentais subjetivos. Factuais (entry/exit/qty/result/stopLoss/side) seguem fluxo normal.

### Metadata complementar (destravamento)

```js
trade._unlockedAt = serverTimestamp()
trade._unlockedBy = {
  uid: 'system' | string,
  email: 'system' | string,
  reason: 'import:<batchId>' | 'admin:<reason>'
}
```

---

## Gateway (`src/utils/tradeGateway.js`)

3 funções novas (todas dependem de `mentorContext.{uid, email, name}`):

### `editTradeAsMentor(tradeId, edits, ctx, deps)`
- Valida campo ∈ `MENTOR_EDITABLE_FIELDS` — rejeita qualquer outro
- Rejeita se `_lockedByMentor === true` (já travado)
- Rejeita se caller não é mentor
- Lê trade atual, monta `_mentorEdits` push, grava `_studentOriginal` se ainda não existe
- Single update atômico

### `lockTradeByMentor(tradeId, ctx, deps)`
- Marca lock sem editar campos (uso futuro: travar trade já correto)

### `unlockTradeByMentor(tradeId, ctx, deps)`
- Existe no gateway mas **sem UI v1** (DEC-AUTO-188-04)
- Casos extremos (mentor errou edição, dispute aluno-mentor): admin destrava manualmente direto no Firestore console + grava `_unlockedBy.reason: 'admin:<motivo>'`
- Função pode virar UI dedicada se frequência justificar

---

## Firestore Rules

3 gates combinados em `match /trades/{tradeId}`:

```rules
allow update: if (
  // Gate 1: ownership
  isOwner(resource.data.studentId) || isMentor()
)
&& (
  // Gate 2: lock dos 3 campos quando _lockedByMentor=true
  // qualquer non-mentor tentando tocar um dos 3 quando locked → bloqueia
  !(resource.data._lockedByMentor == true
    && !isMentor()
    && (request.resource.data.emotionEntry != resource.data.emotionEntry
      || request.resource.data.emotionExit != resource.data.emotionExit
      || request.resource.data.setup != resource.data.setup))
)
&& (
  // Gate 3: metadata guard — só mentor toca campos de lock
  // (CFs admin SDK bypassam rules)
  isMentor() ||
  (request.resource.data._lockedByMentor == resource.data._lockedByMentor
   && request.resource.data._lockedAt == resource.data._lockedAt
   /* etc para todos os _campos_ de lock */)
);
```

## Cloud Function — destravamento server-side por import (DEC-AUTO-188-03)

Lógica em `functions/index.js > onTradeUpdated`:

```js
exports.onTradeUpdated = onDocumentUpdated('trades/{tradeId}', async (event) => {
  const before = event.data?.before.data();
  const after  = event.data?.after.data();

  // Detecta import: importBatchId mudou + after tem importBatchId + estava locked
  if (
    before.importBatchId !== after.importBatchId
    && after.importBatchId != null
    && after._lockedByMentor === true
  ) {
    // admin SDK bypassa rules (que bloqueariam aluno de tocar metadata de lock)
    await event.data.after.ref.update({
      _lockedByMentor: false,
      _unlockedAt: FieldValue.serverTimestamp(),
      _unlockedBy: {
        uid: 'system',
        email: 'system',
        reason: `import:${after.importBatchId}`
      }
      // _mentorEdits[] e _studentOriginal preservados
    });
  }

  // (resto do pipeline: complianceFields recalc, maturity recalc, etc.)
});
```

**Justificativa (DEC-AUTO-188-03):** broker é fonte de verdade superior ao mentor e ao aluno. Se import trouxe nova fonte de dados (re-importação CSV ou conexão broker), trade volta ao estado mutável.

`_mentorEdits[]` e `_studentOriginal` permanecem intactos para auditoria.

Lógica server-side (não no gateway client) porque rules bloqueiam aluno de tocar metadata de lock — admin SDK é o único caminho legítimo.

## CF — `onTradeUpdated.complianceFields` inclui `emotionEntry` (DEC-AUTO-188-07)

Fix de bug pré-existente entrou junto com o lock:

**Antes:**
```js
const complianceFields = ['stopLoss', 'entry', 'exit', 'qty', 'side'];
```

**Depois:**
```js
const complianceFields = ['stopLoss', 'entry', 'exit', 'qty', 'side', 'emotionEntry'];
```

Reconstrução de redFlags filtra `BLOCKED_EMOTION` antes de regerar contra `after.emotionEntry` vs `plan.blockedEmotions`.

`setup` e `emotionExit` deliberadamente fora:
- `setup` não afeta cálculo de RR/RO/redFlags (geométrico). Maturity engine roda incondicionalmente em todo update — `setup` é capturado via `helpers.js` strategy-consistency mesmo sem estar em `complianceFields`.
- `emotionExit` não é consumido por nenhum dim do engine.

---

## UI

### `MentorEditPanel.jsx` (FeedbackPage)

Estados:

**A — Sem lock, mentor:** botão "▸ Editar campos do aluno (mentor)" colapsado, glass-amber border.

**B — Expandido:** 3 selects (emotionEntry/emotionExit/setup) com valor original em parênteses; botões "Cancelar" / "Reverter ao original" / "Confirmar e travar →"; aviso de imutabilidade.

**C — Modal de confirmação:** lista campos antes/depois; "Após confirmar, ninguém edita esses 3 campos."

**D — Pós-lock, visão aluno:** `🔒 Travado pelo mentor em DD/MM/YYYY` + asterisco (`Pullback*`) com tooltip "era Breakout, corrigido pelo mentor".

### `TradeLockBadge`
Componente compacto no header do FeedbackPage e como ícone `Lock` inline na ExtractTable.

### `TradeDetailModal` — bloco "Histórico de correções (N)"
Lista cada `_mentorEdits` entry no rodapé com `field / oldValue → newValue / editedAt / editedBy`.

---

## Exemplo numérico (timeline)

```
T0 — Aluno cria trade:
  emotionEntry='FOMO', setup='Breakout', emotionExit='Regret'
  plan.blockedEmotions = ['FOMO', 'REVENGE']
  → calculateTradeCompliance → redFlags = ['BLOCKED_EMOTION:FOMO']

T1 — Mentor edita+trava:
  edits = [
    { field:'emotionEntry', oldValue:'FOMO',     newValue:'Calmo' },
    { field:'setup',         oldValue:'Breakout', newValue:'Pullback' }
  ]
  trade._mentorEdits = [
    {field:'emotionEntry', oldValue:'FOMO', newValue:'Calmo', editedAt:24/04, editedBy:maria@},
    {field:'setup',         oldValue:'Breakout', newValue:'Pullback', editedAt:24/04, editedBy:maria@}
  ]
  trade._studentOriginal = { emotionEntry:'FOMO', emotionExit:'Regret', setup:'Breakout' }
  trade._lockedByMentor=true, _lockedAt=24/04 14:36, _lockedBy=maria
  → CF onTradeUpdated → 'Calmo' ∉ blockedEmotions → redFlags = []

T2 — Aluno reimporta CSV:
  trade.result 340 → 355 + importBatchId muda
  → CF onTradeUpdated detecta:
     before.importBatchId !== after.importBatchId
     && after.importBatchId != null
     && before._lockedByMentor === true
  → admin SDK grava:
     _lockedByMentor = false
     _unlockedAt = serverTimestamp()
     _unlockedBy = { uid:'system', email:'system', reason:'import:<batchId>' }
  → _mentorEdits[] e _studentOriginal preservados
  → Mentor vê sinal "trade destravado por import; reanalisar?"
```

---

## Limites operacionais

- Lock protege só os 3 campos comportamentais. Factuais (entry/exit/qty/result/stopLoss/side) seguem fluxo normal sem lock.
- Import (CSV/Order) que mexe em qualquer campo do trade destrava o lock; preserva `_mentorEdits[]` e `_studentOriginal` (auditoria).
- Admin destrava manualmente (campo livre pós-v1, sem UI dedicada).
- Trade em ciclo finalizado: `weeklyReviewSnapshot` NÃO é reescrito (integridade histórica).

---

## Decisões consolidadas

- **DEC-AUTO-188-01** — Schema 5 campos inline + array append-only `_mentorEdits` (não map, não subcollection). Inline porque fluxo de leitura sempre carrega o trade completo. Array preserva auditoria por edição. `_studentOriginal` gravado APENAS na 1ª edit, imutável após.
- **DEC-AUTO-188-02** — Escopo limitado a 3 campos comportamentais (`emotionEntry`, `emotionExit`, `setup`). Factuais sem lock.
- **DEC-AUTO-188-03** — Import destrava server-side via CF preservando auditoria; broker é fonte de verdade superior ao mentor. Admin SDK é o único caminho legítimo (rules bloqueiam aluno de tocar metadata de lock).
- **DEC-AUTO-188-04** — Admin destrava manualmente sem UI v1 (caso raro). Função `unlockTradeByMentor` existe no gateway para uso futuro.
- **DEC-AUTO-188-07** — `onTradeUpdated.complianceFields` inclui `emotionEntry` — fix de bug pré-existente. `setup` e `emotionExit` deliberadamente fora.

## Referências

- Implementação: `src/utils/tradeGateway.js`, `firestore.rules`, `functions/index.js` (`onTradeUpdated`)
- UI: `src/components/feedback/MentorEditPanel.jsx`, `src/components/TradeLockBadge.jsx`
- Testes: `src/__tests__/utils/tradeGatewayMentorLock.test.js`, `src/__tests__/components/TradeLockBadge.test.jsx`
- INV relevantes: INV-02 (gateway único), INV-15 (aprovação de schema)
