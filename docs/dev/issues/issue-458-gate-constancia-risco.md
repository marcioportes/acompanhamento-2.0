# Issue #458 — fix: gate de constância do risco zera a cada Salvar e pede 6 meses

## Autorização
- [x] Mockup: não se aplica. Não há tela nova; o card existente só troca o texto e o alvo.
- [x] Memória de cálculo: medição da base no body do issue.
- [x] Marcio autorizou em 24/09/2026: *"tira isso, ou mede com 2 e executa"*. Medido com 2 e executado.
- [x] Gate Pré-Código liberado

## Context
Na revisão do fechamento mensal (#457, achado 3), o gate `strategy-12-months` aparecia em 0 com alvo 6. Havia duas causas: `updatePlan` registrava toda chave do payload como alterada, e o alvo de 6 meses deixava o aluno sem sinal de progresso.

## Spec
Ver #458.

## Memória de Cálculo
- `strategyConsMonths = min(meses desde a última entrada de editHistory que toca RISK_FIELDS, senão plan.createdAt)` entre os planos ativos. A fórmula não muda.
- `changedFields = { k ∈ payload \ {pl} : norm(gravado[k]) ≠ norm(payload[k]) }`, onde `norm` iguala null/undefined/'', compara número e texto como string e objeto via JSON.
- `auditInfo.changedFields` explícito prevalece. Se a leitura falhar, audita o payload inteiro.
- Se `changedFields` vier vazio, nada entra no histórico e o recálculo não roda.
- Gate: `strategyConsMonths >= 2`.

## Phases
- A1 — alvo 2 meses (cliente + espelho CF) + texto
- A2 — `changedFields` por valor em `updatePlan`
- A3 — testes

## Sessions
- `task 01 [gate-e-diff] interativa`

## Shared Deltas
- `src/version.js` — v1.92.5
- `CHANGELOG.md` — entrada v1.92.5
- `docs/registry/chunks.md` / `versions.md` — liberar CHUNK-03 e CHUNK-09; consumir 1.92.5
- Deploy de CFs: `functions/maturity/constants.js` mudou → deploy das funções de maturidade.

## Decisions
- DEC-458-01 — `editHistory` já gravado não é limpo (não guarda o valor anterior; não dá para provar que era falso).
- DEC-458-02 — ajuste aplicado pelo ritual (`closeCycle`) segue sem registrar no `editHistory`: é a mudança documentada que o gate aceita.

## Chunks
CHUNK-03 (escrita), CHUNK-09 (escrita)
