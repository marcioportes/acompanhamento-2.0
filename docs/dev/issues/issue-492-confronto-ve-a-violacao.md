# Issue #492 — fix: confronto emocional diz "execução saiu limpa" em trade com violação de plano

## Autorização

- [x] Mockup apresentado (20/10/2026 — texto do banner no chat)
- [x] Memória de cálculo apresentada (20/10/2026 — regra abaixo)
- [x] Marcio autorizou (20/10/2026 — "resolve")
- [x] Gate Pré-Código liberado

## Context

"Limpa" no confronto significava só "nenhum padrão negativo, MÉDIA/ALTA, com emoção mapeada". As violações de plano (`redFlags`) não entravam. Caso real: WINZ26 20/10, Ganância → Medo, sem stop, único padrão "Modelo não declarado" (sem emoção).

## Spec

Issue #492.

## Mockup

```
◐ CONFRONTO EMOCIONAL
Você declarou "Ganância", e a execução saiu do plano: sem stop declarado.
Confere se foi essa emoção que conduziu a operação?
```
Emoção positiva/neutra + violação: "Você declarou "Confiança", mas a execução saiu do plano: risco acima do autorizado — vale revisitar o que você sentiu de fato na entrada."

## Memória de Cálculo

- Entrada nova: violações VIGENTES do trade = `effectiveRedFlags(trade)` (as mesmas do bloco "Violações"; sem revogadas, pendências ou limpas pelo mentor).
- Regra: emoção declarada + nenhum padrão que sugira emoção + ≥1 violação vigente + veredito ≠ CONFIRMED → banner âmbar com a violação como fato. NEGATIVE/CRITICAL: pergunta "se foi essa emoção"; POSITIVE/NEUTRAL: "vale revisitar".
- Sem violação: textos de antes (inclusive "limpa").
- Sem emoção declarada: sem banner (igual a antes).
- Padrão com emoção presente: hipótese do #477 continua como manchete.
- Só leitura: vale para trade discutido sem regravar (INV-30). Veredito gravado pela CF não muda.

## Phases

- A — `emotionConfrontDisplay` recebe violações; `BehaviorPanel` passa `effective`; testes

## Sessions
- `A [confronto-ve-a-violacao] ok` — suíte 5523 passed (TZ=UTC); lint sem erro nos arquivos tocados

## Shared Deltas

- `src/version.js` — aplicar v1.92.21
- `docs/registry/versions.md` — v1.92.21 consumida
- `docs/registry/chunks.md` — liberar CHUNK-06
- `CHANGELOG.md` — entrada `[1.92.21]`

## Decisions

- DEC-492-01

## Chunks

- CHUNK-06 (escrita) — confronto emocional (exibição)
