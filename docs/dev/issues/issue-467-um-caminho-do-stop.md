# Issue 467 — fix: um caminho só para gravar e exibir o stop

> **Branch:** `fix/issue-467-um-caminho-do-stop`
> **Aberto em:** 25/09/2026
> **Status:** 🔵 Em andamento
> **Versão reservada:** 1.92.11
> **Épico:** #462 (Fase 4)

## Autorização

- [x] Mockup: painel de ordens do 24/09, antes e depois (abaixo). Só mudam o estado "retirada" e o preço exibido.
- [x] Memória de cálculo: stop do lado errado da entrada = sem stop (`stopDistanceOf` devolve null)
- [x] Marcio autorizou em 25/09/2026, na aprovação do plano do épico #462
- [x] Gate Pré-Código liberado

## Mockup — painel de ordens, 24/09

```
Stop    BUY 185280 5   retirada  →  ativa até a saída     (OCO morto quando o alvo da perna 2 executou)
Stop    BUY 184985 → 185135 5 executada                   (preço ENVIADO, o mesmo que o trade grava)
```

O restante não muda. O cabeçalho continua "Protegido o tempo todo". O painel responde se a posição esteve coberta, e esteve: a perna 2 estava protegida por um stop do lado do ganho. O import responde qual era o risco inicial comprovado, e a resposta é que não há. As duas respostas são verdadeiras e respondem perguntas diferentes (DEC-467-02).

## Phases

- A1 — `stopDistanceOf` (ESM + CJS): stop do lado errado, ou igual à entrada, = sem stop
- A2 — compliance (cliente e CF), R:R, `realizedRR`, `rrBreakdown`, gateway e telas usam o helper
- A3 — `conversationalIngest`: o enriquecimento usa `tradeStopFromLegs`; a guarda do #371 foi mantida
- A4 — `TradeOrdersPanel`: "retirada" é avaliada contra a saída da própria perna; o preço exibido é o enviado

## Sessions

- `task 01 [abertura] commit df3d9994 ok`
- `task 02 [A1-A4] ok — 5.359 testes em UTC e em BRT, 317 em functions, harness verde, build ok`

## Shared Deltas

- `src/version.js`: consumir a reserva da v1.92.11
- `docs/registry/versions.md`: marcar a 1.92.11 como consumida
- `docs/registry/chunks.md`: liberar o CHUNK-10, o CHUNK-05 e o CHUNK-04
- `CHANGELOG.md`: entrada `[1.92.11]`
- `docs/PROJECT.md`: encerramento

## Decisions

- DEC-467-01 — stop do lado errado da entrada tem o mesmo tratamento que ausência de stop, em todos os cálculos de risco
- DEC-467-02 — o cabeçalho do painel mede cobertura da posição, não risco inicial; o texto fica como está

## Chunks

- CHUNK-10, CHUNK-05 e CHUNK-04 (escrita)
