# Monte Carlo simulations — issue #201

Evidência reproduzível dos números expostos em `ATTACK_PROFILES[*].mcStats` (consumidos pelos tooltips em `AddAccountModal.jsx` / `AccountsPage.jsx`).

**Base comum:** Apex Intraday 50K, drawdown $2500, profit target $3000, 21 dias úteis, RR fixo 1:2, RNG `Math.random()`.

| Script | Pergunta | Recorte |
|---|---|---|
| `01-profiles-vs-trades.mjs` | 1 vs 2 trades/dia (modelo cego always-N) | 5 perfis × WR 0.40..0.60, 50k iter |
| `02-cadence-isolated.mjs` | RO fixo $375 vs daily exposure fixo $750, varia split | 1/2/3 trades, 50k iter |
| `03-stop-on-win-behavior.mjs` | Comportamento real (1º win → para; 1º loss → recovery) muda quanto? | always-2 vs stop-on-win vs cap-1L, 100k iter |
| `04-condensed-stats-tips.mjs` | Stats condensados que alimentam `mcStats` em propFirmDefaults | 5 perfis × WR 0.45/0.50/0.55, comportamento stop-on-win/recovery, 100k iter |

## Como rodar

```bash
node scripts/issue-201-monte-carlo/04-condensed-stats-tips.mjs
```

## Calibração de `ATTACK_PROFILES[*].mcStats`

Os números em `propFirmDefaults.js` vêm do output do script `04-...`. Recalibrar quando:

1. Mudar template base (Apex 50K → outro)
2. Mudar comportamento modelado (atual: stop-on-win com recovery após loss)
3. Atualizar valores de RO% nos perfis
4. Substituir RNG por seed determinístico (futuro DT)

## Insights principais

- **Comportamento real (stop-on-win) ≈ always-2** em bust (3.3% vs 3.3% em CONS_B WR 50%); custo é só ~24% mais lento (7.6 → 9.4 dias).
- **CONS_B (2 trades × 15%)** bate AGRES_B (1 trade × 30%) em todas as métricas exceto velocidade; AGRES_B paga 4× mais bust por aprovar 1.5 dia mais cedo.
- **Lei dos grandes números:** mesmo daily exposure ($750), fragmentar em 2 ou 3 eventos derruba bust (12.6% → 3.3% → 0.8%).
- **3+ trades/dia** mata em disciplina (vira overtrading), não em matemática — por isso não é exposto como perfil.

## Limitações

- RNG `Math.random()` não é seedable — resultados variam ±0.5pp entre runs. Aceitável para tooltip mas não para auditoria; substituir por `seedrandom` se virar requisito.
- Modelo assume drawdown estático ($2500); Apex Intraday é trailing intraday, então o número real é levemente otimista (drawdown trailing reduz na sequência ruim).
- `dailyLossLimit` ignorado quando null (Apex Intraday 50K) — alinhado com `NULL_DAILY_LOSS_FALLBACK_FRACTION = 1.0` em `calculatePlanMechanics.js`.
- 21 dias úteis derivados de `evalTimeLimit=30` calendário. Apex permite eval de 1 dia se hit target — modelo respeita isso (early exit).
