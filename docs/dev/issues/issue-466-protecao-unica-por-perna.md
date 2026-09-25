# Issue 466 — fix: pernas e proteção, definição única, stop inicial por perna, risco somado

> **Branch:** `fix/issue-466-protecao-unica-por-perna`
> **Aberto em:** 25/09/2026
> **Status:** 🔵 Em andamento
> **Versão reservada:** 1.92.10
> **Épico:** #462 (Fase 3)

## Autorização

- [x] Mockup: não se aplica (pipeline)
- [x] Memória de cálculo: stop equivalente = média de entrada ∓ Σ(|entrada da perna − stop da perna| × qtd da perna) / qtd total
- [x] Marcio autorizou em 25/09/2026:
  - *"soma do risco das pernas"*;
  - *"Stop equivalente"*;
  - stop cancelado segundos depois da entrada *"conta, era a intenção"*
- [x] Gate Pré-Código liberado

## Context

Cinco definições de proteção/stop discordavam entre si: o import, o painel e os detectores. O harness do #463 mostrou 53 operações dos arquivos do Marcio com stop indefensável. Nos arquivos de aluno, eram 19 no Italo e 32 no Eduardo.

## Phases

- A1 — `src/utils/orderProtection.js` mais o espelho CJS `functions/shared/orderProtection.js`, com paridade testada
- A2 — `orderReconstruction`:
  - classificação pela função única;
  - órfã exige o mesmo ativo e nunca vira stop;
  - sai o atalho do `isStopOrder`
- A3 — `orderTradeCreation`: `stopLoss` = stop equivalente das pernas (null se alguma perna não tiver stop comprovado)
- A4 — `stopSemantic` compara com o preço executado da perna; `stopMovementAnalysis` analisa por perna, dentro da vida da posição
- A5 — `protectiveLegsOf` (engine e mirror) passa a usar a mesma definição
- A6 — `orderTradeComparison` e `AdjustmentModal` mostram o mesmo stop que o trade grava

## Sessions

- `task 01 [abertura] commit 1e4a86f9 ok`
- `task 02 [A1-A6] ok`:
  - as 64 entradas F3 do harness foram removidas;
  - violações de stop: Italo 19 → 0, Eduardo 32 → 0;
  - retomada igual ao import direto em todos os casos
- `task 03 [revisão] stop equivalente arredondado em 2 casas`

## Limitações conhecidas

- O bracket do Profit exportado como LIMITE sem "Preço Stop" carrega a folga (≈150 pts) no preço enviado. O risco sai inflado pela folga, porque o gatilho não existe no arquivo.
- `orders` não grava `origin`, então no servidor o filtro de "saída manual" não tem efeito.

## Shared Deltas

- `src/version.js`: consumir a reserva da v1.92.10
- `docs/registry/versions.md`: marcar a 1.92.10 como consumida
- `docs/registry/chunks.md`: liberar o CHUNK-10, o CHUNK-04 e o CHUNK-06
- `CHANGELOG.md`: entrada `[1.92.10]`
- `docs/PROJECT.md`: encerramento
- `docs/decisions.md`: DEC-466-01..05

## Decisions

- DEC-466-01 — stop equivalente em `trade.stopLoss`, sem campo novo (INV-15), arredondado em 2 casas
- DEC-466-02 — uma ordem protege no máximo a quantidade dela; perna não coberta = proteção parcial = sem stop
- DEC-466-03 — saída manual: LIMITE sem gatilho, com origem preenchida diferente de "Estratégia", não é proteção
- DEC-466-04 — stop cancelado depois da entrada conta como stop do trade (Marcio: *"era a intenção"*); a retirada é sinal comportamental
- DEC-466-05 — órfã só vai para uma operação do mesmo ativo e nunca vira stop

## Chunks

- CHUNK-10 (escrita), CHUNK-04 (escrita: criação do trade), CHUNK-06 (escrita: `protectiveLegsOf`)
