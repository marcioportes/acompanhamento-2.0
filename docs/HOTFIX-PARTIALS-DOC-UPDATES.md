# Atualizações de Documentação — Hotfix Parciais (22/03/2026)

> Aplicar manualmente ao ARCHITECTURE.md e AVOID-SESSION-FAILURES.md após o hotfix.

---

## 1. ARCHITECTURE.md — Adicionar INV-12 (após INV-11)

### INV-12: Parciais São Campo no Documento — NÃO Subcollection
**Parciais (`_partials`) são um campo array dentro do documento `trades/{id}`.** Não existe subcollection `trades/{id}/partials`. Toda leitura e escrita de parciais acontece no campo `_partials` do documento do trade.

**Todo trade tem parciais.** Mesmo um trade com uma única entrada e uma única saída tem 2 parciais (1 ENTRY + 1 EXIT). Não existe o conceito de "trade sem parciais" — o campo `hasPartials` é legado e será removido.

**Regras:**
1. Parciais são lidas do campo `trade._partials` (array no documento) — síncrono via listener, sem fetch assíncrono
2. Parciais são escritas via `addTrade` (spread no documento) e `updateTrade` (campo `_partials` no payload)
3. NUNCA criar subcollection para parciais — o campo inline é a única fonte de verdade
4. `getPartials()` existe como helper e lê do documento — NÃO de subcollection

**Origem:** Sessão 11-12/03/2026 — Claude criou subcollection `trades/{id}/partials` sem aprovação, sem verificar a estrutura existente. O `addTrade` já gravava `_partials` como campo array no documento. A duplicação (campo + subcollection) causou divergência silenciosa: edições gravavam num lugar, leituras buscavam noutro. Marcio precisou de +20 horas de debug distribuídas em múltiplas sessões para identificar a raiz do problema. Esse incidente originou a criação do ARCHITECTURE.md e do AVOID-SESSION-FAILURES.md como documentos obrigatórios. Na sessão de 22/03/2026, a subcollection foi definitivamente eliminada do código — `addPartial`, `updatePartial`, `deletePartial` (que operavam na subcollection) foram removidos como código morto, e `getPartials` foi reescrito para ler do campo do documento.

---

## 2. ARCHITECTURE.md — Atualizar mapa de Collections (seção 3.1)

Substituir o bloco `trades`:

```
trades (collection principal)
├── Escritor: addTrade (via AddTradeModal, csvStaging Activate, Order Import ingestBatch)
├── Cloud Functions: onTradeCreated, onTradeUpdated
├── Hooks: useTrades
├── Campo _partials: array de parciais DENTRO do documento (INV-12) — NÃO subcollection
│   Estrutura: [{ seq, type: 'ENTRY'|'EXIT', price, qty, dateTime, notes }]
│   Todo trade tem parciais (mínimo 2: 1 ENTRY + 1 EXIT)
├── Consumers UI: StudentDashboard, TradingCalendar, AccountStatement,
│                  FeedbackPage, PlanLedgerExtract, MentorDashboard
└── Side-effects: PL calculation, compliance rate, emotional scoring
```

---

## 3. ARCHITECTURE.md — Atualizar Dívidas Técnicas

Marcar como RESOLVIDOS:
- **DT-022:** Subcollection `partials` legada → **RESOLVIDO** 22/03/2026 (subcollection eliminada do código, `getPartials` reescrito para ler campo `_partials`)
- **DT-024:** `hasPartials` flag desnecessário → **PARCIALMENTE RESOLVIDO** 22/03/2026 (gates removidos do TradeDetailModal e FeedbackPage; campo ainda existe nos documentos mas não é usado como condição)

Adicionar novo:
- **DT-025:** Campo `hasPartials` e `partialsCount` nos documentos de trades são legado — todo trade tem parciais. Limpar esses campos numa migração futura ou ignorar (não causam problema, só ocupam espaço). | BAIXA | 22/03/2026

---

## 4. ARCHITECTURE.md — Adicionar ao Decision Log (DEC-024)

### DEC-024: Parciais são campo inline, subcollection eliminada (22/03/2026)
**Problema:** Desde a sessão 11-12/03/2026, `useTrades.js` mantinha duplicação: parciais gravadas como campo `_partials` (array) no documento do trade E como subcollection `trades/{id}/partials`. Leituras no TradeDetailModal e FeedbackPage buscavam da subcollection; edições via AddTradeModal liam do campo inline. Divergência silenciosa causou +20h de debug.
**Decisão:** Subcollection eliminada. `addPartial`, `updatePartial`, `deletePartial` removidos (código morto — nunca chamados por nenhum componente). `getPartials` reescrito para ler do campo `_partials` do documento. TradeDetailModal e FeedbackPage agora usam `useMemo` sobre `trade._partials` — leitura síncrona, zero fetch.
**Impacto:** useTrades.js (subcollection removida, código morto eliminado), TradeDetailModal.jsx (useMemo síncrono), FeedbackPage.jsx (useMemo síncrono), StudentDashboard.jsx (getPartials no destructuring).

---

## 5. AVOID-SESSION-FAILURES.md — Adicionar seção 8

### 8. Subcollection Fantasma — O Erro Mais Caro do Projeto

**O que aconteceu (sessão 11-12/03/2026):**
Claude criou subcollection `trades/{id}/partials` sem verificar que `_partials` já existia como campo array no documento do trade. O `addTrade` gravava em DOIS lugares (campo + subcollection). As funções `addPartial`, `updatePartial`, `deletePartial` operavam na subcollection. O modal de edição lia do campo do documento. TradeDetailModal e FeedbackPage tentavam ler da subcollection.

**Custo real:**
+20 horas de debug do Marcio distribuídas em múltiplas sessões. Esse incidente foi tão grave que motivou a criação do ARCHITECTURE.md e do AVOID-SESSION-FAILURES.md como documentos obrigatórios do projeto.

**Root cause:**
Claude assumiu que "subcollection é o padrão para dados filhos no Firestore" sem fazer `grep` no código existente. Bastava verificar `useTrades.js` para ver que `_partials` era campo array no documento. A subcollection foi criada sem aprovação (violação de INV-07 e INV-10).

**Resolução (22/03/2026):**
- Subcollection removida do código (zero referências operacionais)
- `addPartial`, `updatePartial`, `deletePartial` removidos (código morto)
- `getPartials` reescrito para ler do campo `_partials` do documento
- TradeDetailModal e FeedbackPage reescritos com `useMemo` síncrono
- INV-12 criado: "Parciais são campo no documento — NÃO subcollection"

**Prevenção (reforço):**
- INV-10 já existia mas não impediu o erro original. INV-12 é específico para parciais.
- Regra geral: NUNCA criar subcollection sem (a) grep no código existente, (b) verificar como o dado é lido/gravado, (c) aprovação explícita do Marcio.
- Subcollections no Firestore são para dados que precisam de queries independentes. Parciais de um trade NUNCA são consultadas fora do contexto do trade pai — logo, campo inline é a estrutura correta.

---

## 6. AVOID-SESSION-FAILURES.md — Atualizar Checklist (seção 7)

Adicionar ao checklist:

```
□ Parciais são campo _partials no documento — NÃO subcollection? (INV-12)
□ Estou criando subcollection? Se sim, PARAR e perguntar ao Marcio. (INV-10 + INV-12)
```

---

*Gerado: 22/03/2026*
*Hotfix: Eliminação definitiva de subcollection partials*
*Commit anterior: 280ad2a7 (fix parcial, insuficiente)*
