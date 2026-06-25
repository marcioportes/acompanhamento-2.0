# Issue #315 — feat: humanizar "Evidência técnica" do BehaviorPanel

> Template enxuto (R4). Fast-track autorizado por Marcio (25/06/2026).

## Autorização

**Status atual do documento:**
- [x] Mockup apresentado (tabela antes→depois no chat + body do issue)
- [x] Memória de cálculo — N/A (sem fórmula; só mapeamento rótulo + formatação)
- [x] Marcio autorizou — 25/06/2026 "abre a issue fast-track"
- [x] Gate Pré-Código liberado

## Context

O accordion "Evidência técnica" do `BehaviorPanel` despeja campos crus do schema do
motor comportamental (`intervalMinutes`, `previousSide`, `actualRR: 0.11538…`). Sem o
dicionário de dados, o aluno não entende o que aquilo diz sobre o que ele fez.
Objetivo: substituir o dump por rótulos PT-BR + valores formatados, mantendo a
transparência do diagnóstico.

## Spec
Ver issue body no GitHub: #315.

## Mockup
Accordion mantém o mesmo layout (grid 2 colunas), trocando `key: rawValue` por
`Rótulo PT-BR: valor formatado`. Título "Evidência técnica" → menos intimidador
("Os números por trás" / "Como cheguei nisso" — decidir na implementação).
Exemplos (DIRECTION_FLIP):
- Tempo desde o trade anterior: 7,9 min
- Operação anterior: Compra · Resultado anterior: −R$ 49,00
- Esta operação: Venda · Ativo: WINM26

## Memória de Cálculo
N/A — sem cálculo. Apenas:
- Dicionário `EVIDENCE_FIELD_LABELS` (key → { label, format }).
- Formatadores: moeda (`formatCurrencyDynamic`), %, min, lado (LONG→Compra/SHORT→Venda),
  RR (2 casas). Campo não-mapeado → fallback (oculta campos só-de-motor:
  `scenario`, `hiddenRrInflation`, `planRsDelivered`, `rrLocalAchieved`).

## Phases
- A1 — Dicionário de rótulos + formatadores em `behaviorDisplay.jsx` + testes (INV-05)
- A2 — Componente `EvidenceTechnical` compartilhado; trocar dump em `BehaviorPanel.jsx` e `UndersizedBody`
- A3 — Revisar título do bloco + build verde

## Sessions
- _(a preencher)_

## Shared Deltas
- `src/version.js` — bump v1.78.0 (reservado no main)
- `docs/registry/versions.md` — marcar v1.78.0 consumida (no encerramento)
- `docs/registry/chunks.md` — liberar CHUNK-11 (no encerramento)
- `CHANGELOG.md` — nova entrada `[1.78.0] - 25/06/2026`

## Decisions
- _(a preencher se houver DEC-AUTO)_

## Chunks
- CHUNK-11 (escrita) — display do `trade.behaviorProfile`
