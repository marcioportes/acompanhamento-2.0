# Issue #278 — feat: UNDERSIZED_TRADE — calibragem 65% + evidência educacional (R-local vs R-plano)

> **Template enxuto (R4).** Máximo 400 linhas.

## Autorização (OBRIGATÓRIA — sem isto é PROIBIDO iniciar desenvolvimento)

**Regra — construção do documento de controle com Marcio:**

1. **Discussão em nível de negócio** — máximo possível; técnico derivado pela IA.
2. **Mockup SEMPRE** — UI nova/modificada apresenta mockup textual antes do código.
3. **Memória de Cálculo SEMPRE** — feature com fórmula/score apresenta memória de cálculo antes do código.
4. **Exceção** — só se Marcio autorizar explicitamente.
5. **Autorização escrita** — após mockup + memória revisados, Marcio escreve "autorizado", "aprovado", "go" ou equivalente.

**Status atual do documento:**
- [x] Mockup apresentado (consta no body do issue #278 — bloco "Mockup")
- [x] Memória de cálculo apresentada (consta no body do issue #278 — bloco "Memória de cálculo")
- [x] Marcio autorizou (22/05/2026: "confirma, atualiza o issue e segue")
- [x] Gate Pré-Código liberado

## Context

Detector `UNDERSIZED_TRADE` (issue #129 / Shadow Behavior v1.0) hoje silencia o cenário de 50% de utilização do RO contratado (guarda `ratio >= 0.50` strict) e, quando dispara, entrega evidência mecânica que não explica ao aluno por que o padrão é nocivo. Gatilho real: sessão 22/05/2026 — aluno com plano `RO=10%` operando em 5% sistematicamente; detector mudo. Insight maior emergiu: subdimensionar stop sem reduzir alvo na mesma proporção infla artificialmente Payoff/PF/EV porque esses indicadores usam **R-local** (do stop usado) em vez de **R-plano** (do RO contratado). Resultado: "donut" — aluno parece com edge ótimo, saldo real fica em zero quando vem o primeiro loss de RO cheio.

## Spec

Ver issue body no GitHub: #278.

## Mockup

Ver bloco "Mockup (textual — sem ASCII pesado)" no issue body — `ShadowBehaviorPanel` card UNDERSIZED_TRADE antes/depois + `tradeId` muted no header do `TradeDetailModal`.

## Memória de Cálculo

Ver bloco "Memória de cálculo" no issue body — Inputs, Fórmulas (`ratio`, `planRoAmount`, `expectedGainAtPlanRR`, `rGapVsPlan`, `hiddenRrInflation`), Limites/gates, Exemplo numérico do caso real Marcio (5%/10%).

## Phases

- **A1 — Engine: calibragem + enrichment + evidência ampliada** (CF + cliente paridade + testes unitários)
  - DEFAULT_CONFIG: `ratioThreshold: 0.65`, `mediumRatio: 0.50` (comparação `<=` em `< mediumRatio` vira `<= mediumRatio`), `highRatio: 0.30`
  - Enrichment loop carrega `planRoPct`, `planPl`, `planRrTarget` no trade
  - `detectUndersizedTrade` retorna 9 campos na evidence (4 existentes + 5 novos)
  - Branches: win-RR-ok / win-RR-no / loss-BE — refletido em `evidence.scenario: 'WIN_RR_HIT' | 'WIN_RR_MISS' | 'LOSS_BE'`
  - Testes: novos casos (50% MEDIUM, US$60/RO125 com RR hit, loss subdimensionado, planPl ausente fallback)
- **A2 — UI: sentença-chave + bloco educacional + tradeId**
  - `ShadowBehaviorPanel`: card UNDERSIZED_TRADE com primeira linha = sentença-chave por `scenario`, parágrafo educacional, evidência técnica em accordion `[Evidência técnica ▼]`
  - Helper de formatação \$ (usa `account.currency` quando disponível; fallback `formatCurrency` global)
  - `TradeDetailModal`: span muted `text-xs font-mono text-slate-500/40` com `trade.id` no header right + tooltip "Click para copiar"
  - Testes: render por scenario, copy snapshot, tradeId presente
- **A3 — Doc + encerramento**
  - CHANGELOG entrada 1.63.0
  - decisions.md entradas DEC-AUTO-278-01..04
  - PR + Closes #278

## Sessions

_(log linear — uma linha por task após Coord disparar)_

## Shared Deltas

- `src/version.js` — bump 1.62.0 → 1.63.0 (consumida) no encerramento
- `docs/registry/versions.md` — marcar 1.63.0 consumida
- `docs/registry/chunks.md` — liberar CHUNK-04 leitura + CHUNK-08 leitura
- `CHANGELOG.md` — nova entrada `[1.63.0] - DD/MM/2026`

## Decisions

_(IDs apenas — texto em `docs/decisions.md`)_

## Chunks

- CHUNK-04 (Trade Ledger) — leitura (shadow analysis lê trades/plans; Panel renderizado em TradeDetailModal)
- CHUNK-08 (Mentor Feedback) — leitura (ShadowBehaviorPanel também consumido em FeedbackPage)

Sem ESCRITA — issue declarou só leitura (campos da evidence são in-memory dentro de `shadowBehavior.patterns[].evidence`, não persistem campo novo). INV-15 não aplicável.

## §3.1 Decisões Antecipadas

(Marcio autorizou em 22/05/2026 após sessão de spec review com 2 casos reais — 5%/10% e US$ 60/RO 125.)

- **Threshold + escala**: `ratioThreshold: 0.65`, `mediumRatio: 0.50` com `<=`, `highRatio: 0.30`. 50% de utilização cai em MEDIUM (não LOW) — alinhado com tom donut.
- **Sentença-chave como primeira linha do card** (não detalhe enterrado): "RR cumprido. Alvo do plano não atingido." em wins com RR local hit. Variantes em loss e win-RR-miss.
- **Memória de cálculo ajustada**: `hiddenRrInflation = 1 / ratio` (era fórmula errada que dava 1.0 no caso US$ 60/125); `planRsDelivered = result / planRoAmount` adicionado — "Rs do plano efetivamente entregues" — é o número que destrói a ilusão.

## §3.2 Decisões Autônomas

- **DEC-AUTO-278-01** (22/05/2026): Escala com comparação `<=` em `mediumRatio` (50% utilização → MEDIUM, não LOW). Tom donut pede sensibilidade na faixa intermediária.
- **DEC-AUTO-278-02** (22/05/2026): Em trades de loss subdimensionados, bloco educacional adapta texto (sem alvo a comparar). Campos `expectedGainAtPlanRR`/`rGapVsPlan`/`hiddenRrInflation`/`planRsDelivered` ficam null em loss/BE. `scenario: 'LOSS_BE'` na evidence.
- **DEC-AUTO-278-03** (22/05/2026): Copy do bloco educacional igual para aluno e mentor. Painel já é mentor-only por default; quando aluno tem acesso (FeedbackPage), vê o mesmo conteúdo. Evita drift de manutenção dupla.
- **DEC-AUTO-278-04** (22/05/2026): `tradeId` muted (`text-xs font-mono text-slate-500/40`) só no header do `TradeDetailModal`. Panel embedded em FeedbackPage fica limpo. Tooltip "Click para copiar" via `title=` (navegador nativo).

## §4 Sessões (Gates Humanos)

_(preenchido a cada email STOP/HUMAN_GATE/FINISHED + resposta natural do Marcio)_

## §5 Encerramento

_(preenchido no §4.3 — deltas finais aplicados no main + PR + close)_

## §6 Notas operacionais

- Coord session ID: _(será gravado em `.coord-id` após `cc-spawn-coord.sh`)_
- Worktree path: `/home/mportes/projects/issue-278`
- Branch: `feat/issue-278-undersized-evidence`
- Versão reservada: **v1.63.0**
- Locks: CHUNK-04 leitura + CHUNK-08 leitura

Sem conflito esperado com #259 (ESCRITA em CHUNK-04/16): shadow files (`analyzeShadowBehavior.js`, `shadowBehaviorAnalysis.js`, `ShadowBehaviorPanel.jsx`, `TradeDetailModal.jsx`) não tocados pela branch `feat/issue-259-cycle-closure`. Único overlap em `src/pages/FeedbackPage.jsx` — #278 não precisa modificar (Panel já é importado e renderizado lá).
