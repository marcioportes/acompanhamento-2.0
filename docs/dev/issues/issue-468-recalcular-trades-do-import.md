# Issue 468 — chore: recalcular trades já gravados pelo import

> **Branch:** `chore/issue-468-recalcular-trades-do-import`
> **Aberto em:** 25/09/2026
> **Status:** 🔵 Em andamento
> **Versão reservada:** 1.92.12
> **Épico:** #462 (Fase 5)

## Autorização

- [x] Mockup: não se aplica (script)
- [x] Memória de cálculo: a mesma das Fases 3 e 4, mais a regra da folga do bracket (abaixo)
- [x] Marcio autorizou em 25/09/2026:
  - *"Recalcular os não discutidos"*, com dry-run antes;
  - depois do dry-run: *"Aplicar os recalculados"* (os ambíguos ficam de fora);
  - folga do bracket: *"Executado quando executou"*
- [x] Gate Pré-Código liberado

## Context

Os trades gravados antes das Fases 1–4 guardam o stop antigo, e o de 24/09 guarda 188.720 (R$ 7.070). O script reconstrói cada trade a partir das próprias `orders`, pelo mesmo código do import, e grava só o que mudou, nunca em trade discutido (INV-30).

## Phases

- A1 — `scripts/issue-468-recalc-import-trades.mjs` mais `scripts/lib/recalcImportTrades.mjs`: dry-run por padrão, `--apply` para gravar, relatório em JSON
- A2 — stop do import × stop digitado:
  - o stop digitado pelo aluno é preservado;
  - o caso ambíguo só é gravado com `--include-ambiguous`
- A3 — regra da folga (`stopPriceOf`/`stopPriceForLeg`, cliente e CF): a perna de stop do bracket exportada como LIMITE sem gatilho vale pela **execução** quando executou; quando foi cancelada, vale o limite enviado. O painel mostra o mesmo preço.

## Dry-run (26/09/2026, produção, só leitura)

- **Elza:** 43 trades discutidos, preservados.
- **Marcio:**
  - 16 recalculados;
  - 12 inalterados (com a regra da folga, os 8 que iam de R$ 250 para R$ 400 ficam iguais);
  - 2 com stop do aluno;
  - 2 ambíguos;
  - 1 bloqueado (09/09, a reconstrução não isola a operação).
- **24/09:** 188.720 → sem stop (R$ 7.070 → sem stop).

## Sessions

- `task 01 [abertura] commit 3684c648 ok`
- `task 02 [A1-A2] ok — 22 testes do script`
- `task 03 [A3] regra da folga + dry-run 2`

## Shared Deltas

- `src/version.js`: consumir a reserva da v1.92.12
- `docs/registry/versions.md`: marcar a 1.92.12 como consumida
- `docs/registry/chunks.md`: liberar o CHUNK-04 e o CHUNK-05
- `CHANGELOG.md`: entrada `[1.92.12]`
- `docs/PROJECT.md`: encerramento
- `docs/decisions.md`: DEC-468-01..03

## Decisions

- DEC-468-01 — stop do bracket exportado como LIMITE sem gatilho: vale a execução quando executou, e o limite enviado quando foi cancelado
- DEC-468-02 — recálculo só em trade não discutido; o stop digitado pelo aluno é preservado; o ambíguo fica de fora
- DEC-468-03 — o script mora em `scripts/` (ESM), para reusar o código do import sem cópia

## Chunks

- CHUNK-04 e CHUNK-05 (escrita)
