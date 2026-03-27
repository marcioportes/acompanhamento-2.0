# Issue #78: Compliance Incorreto em Trades Sem Stop Loss (Epic)

**Versão alvo:** v1.19.1 (hotfix)
**Tipo:** Epic (5 sub-tasks)
**Prioridade:** Alta
**Módulos impactados:** Cloud Functions (calculateTradeCompliance), useCsvStaging, ExtractTable, useDashboardMetrics, useTrades
**Labels:** `bug`, `epic:compliance`, `Sev1`

---

## Contexto

O sistema trata trades sem stop loss como "risco 100% do PL", gerando red flags de RO FORA_DO_PLANO em **todos** os trades sem stop — mesmo quando o resultado (win ou loss controlado) está dentro do risco planejado. Isso polui o dashboard, distorce o WR Planejado, e confunde aluno e mentor.

Além disso, trades importados via CSV não recebem `tickerRule` (specs do ticker), causando cálculos incorretos e red flags espúrias. O arredondamento do RR estimado mascara non-compliance visual.

**Evidências:** Trades com loss de US$220 (RO$=US$1.000) marcados como "RO FORA_DO_PLANO". Trade com RR real de 1.99:1 exibido como 2.0:1 (RR alvo = 2:1), parecendo compliant quando não é.

---

## C1: Fix calculateTradeCompliance — RO% sem stop

### Problema
`calculateTradeCompliance` (CF + frontend `compliance.js`) seta `riskPercent = 100` quando trade não tem stop. Isso gera `FORA_DO_PLANO` em 100% dos trades sem stop, independente do resultado real.

### Solução
- Trade sem stop + **loss**: `riskPercent = |result| / planPl * 100` (risco retroativo baseado na perda efetiva)
- Trade sem stop + **win**: `riskPercent` = N/A ou 0 (não é possível determinar risco sem stop em trade vencedor)
- Flag `S/STOP` continua como alerta informativo separado (trade sem stop = risco indeterminado)
- Flag `RO FORA_DO_PLANO` só dispara se `riskPercent > plan.riskPerOperation` (com o novo cálculo)

### Arquivos impactados
- `functions/index.js` — `calculateTradeCompliance`, `onTradeCreated`, `onTradeUpdated`, `recalculateCompliance`
- `src/utils/compliance.js` — espelho frontend

### Estimativa: 2-3h | Complexidade: Média-Alta (CF + deploy)

---

## C2: CSV Import — tickerRule ausente

### Problema
O wizard CSV (csvMapper → staging → activate) nunca busca as specs do ticker (tickSize, tickValue, pointValue) do master data. `activateTrade` passa `tickerRule: stagingTrade.tickerRule ?? null`, mas ninguém popula `stagingTrade.tickerRule`.

### Solução
No `activateTrade` (useCsvStaging), antes de chamar `addTradeFn`:
1. Buscar ticker no master data via exchange + symbol
2. Setar `tickerRule` no tradeData se encontrado
3. Fallback: se ticker não encontrado no master data, manter null (cálculo simples)

### Consideração
Trades já importados sem tickerRule precisam de backfill (script) ou re-edição manual.

### Arquivos impactados
- `src/hooks/useCsvStaging.js` — `activateTrade`
- Possível: `src/hooks/useMasterData.js` — helper para buscar tickerRule por symbol+exchange

### Estimativa: 2-3h | Complexidade: Média

---

## C3: Arredondamento RR — 2 casas decimais

### Problema
`calculateAssumedRR` arredonda `rrRatio` para 2 casas (`Math.round(rrRatio * 100) / 100`), mas o display em `ExtractTable` formata com 1 casa (`toFixed(1)`), transformando 1.99 em "2.0:1". Com RR alvo de 2:1, o aluno vê "2.0:1" e pensa que atingiu, mas o sistema marca non-compliant.

### Solução
- Display com 2 casas decimais: `1.99:1` em vez de `2.0:1`
- Ou: display dinâmico — 1 casa quando compliant, 2 casas quando non-compliant (para evidenciar a diferença)

### Arquivos impactados
- `src/components/extract/ExtractTable.jsx` — formatação da coluna RR

### Estimativa: 30min | Complexidade: Baixa

---

## C4: WR Planejado considerar RR assumido

### Problema
`winRatePlanned` em `useDashboardMetrics` usa `trade.rrRatio` que é `null` em trades sem stop (pré-B2) ou trades onde a CF sobrescreveu com `null`. Esses trades são excluídos do cálculo, subestimando o WR Planejado.

### Solução
- Quando `trade.rrRatio` é null e trade não tem stop, calcular RR assumido on-the-fly via `calculateAssumedRR`
- Usar o plano do trade (`trade.planId` → `plansMap`) para obter RO% e RR alvo
- Bug relacionado: CF `onTradeUpdated` sobrescreve `rrRatio` com `null` em trades sem stop — CF deve respeitar `rrAssumed: true` e não sobrescrever

### Arquivos impactados
- `src/hooks/useDashboardMetrics.js` — `winRatePlanned`
- `functions/index.js` — `onTradeUpdated` guard para `rrAssumed`

### Estimativa: 2h | Complexidade: Média

---

## C5: updateTrade — recalcular pontos no override

### Problema
Ao editar o resultado de um trade (resultOverride), o `resultInPoints` fica com o valor original. Pontos e resultado ficam inconsistentes. Exemplo: trade 1000→1199 = +199pts, override para R$200, pontos continua +199.

### Solução
- Se `resultOverride` é diferente do `resultCalculated`, recalcular `resultInPoints` proporcionalmente
- Ou: marcar `resultInPoints` como N/A quando há override (pontos não representam o resultado real)
- Decisão necessária: override muda o preço de saída implícito? Se sim, recalcular exit. Se não, aceitar inconsistência e sinalizar.

### Arquivos impactados
- `src/hooks/useTrades.js` — `updateTrade`

### Estimativa: 1-2h | Complexidade: Média

---

## Critérios de Aceite (Global)

- [ ] C1: Trade sem stop + win NÃO marca RO FORA_DO_PLANO
- [ ] C1: Trade sem stop + loss < RO$ NÃO marca RO FORA_DO_PLANO
- [ ] C1: Trade sem stop + loss > RO$ MARCA RO FORA_DO_PLANO
- [ ] C1: Flag S/STOP continua presente como alerta informativo
- [ ] C2: Trades importados via CSV recebem tickerRule do master data
- [ ] C3: RR exibido com 2 casas decimais (1.99:1, não 2.0:1)
- [ ] C4: WR Planejado inclui trades sem stop via RR assumido
- [ ] C4: CF onTradeUpdated não sobrescreve rrRatio quando rrAssumed=true
- [ ] C5: Override de resultado recalcula ou invalida resultInPoints
- [ ] Testes de regressão para cada sub-task
- [ ] Zero quebra em Cloud Functions existentes
- [ ] CHANGELOG atualizado (INV-08)
- [ ] DebugBadge em componentes novos/tocados (INV-04)

---

## Ordem de implementação sugerida

1. **C1** (RO% sem stop) — base, afeta CF e frontend
2. **C3** (Arredondamento) — quick fix, melhora visual imediata
3. **C4** (WR Planejado + guard CF) — depende do conceito de C1
4. **C2** (tickerRule CSV) — independente, pode ser paralelo
5. **C5** (pontos override) — decisão de design necessária

---

## Estimativa total: 8-11h
