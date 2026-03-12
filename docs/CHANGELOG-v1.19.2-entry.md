## [1.19.2] - 2026-03-11

### Corrigido
- **DEC-007: RR assumido integrado em calculateTradeCompliance:** Trades sem stop agora calculam RR dentro do motor de compliance (não mais como cálculo isolado no addTrade). Usa `plan.pl` (capital base do ciclo) em vez de `currentPl` (flutuante). Resolve DT-017 (rrRatio -3.14 inconsistente)
- **Guard C4 removido:** `onTradeCreated`, `onTradeUpdated`, `recalculateCompliance` e `diagnosePlan` não preservam mais valores stale de rrRatio. O `calculateTradeCompliance` agora retorna RR correto para todos os cenários (com/sem stop)
- **updateTrade recalcula RR:** Edição de resultado, stop, entry, exit ou qty agora recalcula rrRatio (real com stop, assumido sem stop). Antes o rrRatio ficava congelado do addTrade original
- **diagnosePlan detecta rrAssumed stale:** Auditoria agora identifica trades com RR assumido incorreto (ex: calculado com PL antigo) como divergentes. Antes era cego a estes valores

### Modificado
- `compliance.js` v3.0.0: `calculateTradeCompliance` retorna `rrAssumed: boolean`. Trades sem stop: RR = result / (plan.pl × RO%). RR compliance (rrStatus) agora avaliado para todos os trades
- `functions/index.js` v1.9.0: `calculateTradeCompliance` com DEC-007. Guards C4 removidos em `onTradeCreated`, `onTradeUpdated`, `recalculateCompliance`. Persiste `rrAssumed` no documento do trade
- `useTrades.js`: `addTrade` usa `plan.pl` (DEC-007). `updateTrade` recalcula RR quando campos relevantes mudam
- `usePlans.js`: `diagnosePlan` comparação direta de rrRatio (sem guard C4)
- `version.js`: v1.19.2+20260311

### Testes
- 12 novos testes: 11 para DEC-007 RR assumido no compliance (win/loss/breakeven, plan.pl vs currentPl, moeda diferente, red flags), 1 para diagnosePlan rrAssumed stale detection
- 1 teste atualizado: loss sem stop agora gera 2 flags (NO_STOP + RR_BELOW_MINIMUM)
- 378 testes totais, zero regressão
