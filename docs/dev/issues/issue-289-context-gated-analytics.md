# Issue #289 — feat: Dashboard-Aluno — análises governadas pelo contexto (gate plano/ciclo)

> Template enxuto (R4). Spec completa no body do #289 (link, não duplicar).

## Autorização (OBRIGATÓRIA)

**Status: AUTORIZADO (28/05/2026, "dois PRs, pode abrir a issue" do Marcio).**
- [x] Mockup/abordagem revisados (plano de implementação aprovado via ExitPlanMode em 28/05)
- [x] Memória de cálculo: N/A — não há fórmula nova (gate de visibilidade + reescopo de query existente). Exceção implícita: o plano aprovado detalha a lógica.
- [x] Marcio autorizou (28/05/2026, "dois PRs, pode abrir a issue")
- [x] Gate Pré-Código liberado

## Context
Dashboard do aluno mostra todas as análises sem respeitar plano/ciclo. (1) Analytics que somam `result` ignoram `account.currency` → em escopo multi-conta misturam R$+US$ e carimbam R$. (2) Incoerência de IA: Setup/Emocional/Financeiro/Calendário aparecem sem plano; SWOT/Maturidade aparecem fora do ciclo. Objetivo: dashboard vira lente governada pela barra de contexto — sem plano sobra só a Curva de Patrimônio.

## Spec
Ver issue body no GitHub: #289. (Link, não duplicar.)

## Mockup
Sem plano selecionado: header + ContextBar + PlanCardGrid + guards + Curva de Patrimônio (full-width) + CTA "Selecione um plano para ver as análises". Com plano: layout atual intacto. Ciclo passado vs ativo muda a versão de SWOT/Maturidade exibida.

## Memória de Cálculo
N/A — sem fórmula nova. Gate boolean (`selectedPlanId != null`) + filtro de query por `cycleKey`.

## Phases
- **Fase 1 (PR 1)** — gate por plano dos analytics que somam moeda + re-aplicar label de moeda (#1) + curva sempre visível + reflow grid + empty-state CTA
- **Fase 2 (PR 2)** — SWOT escopado ao ciclo (`useLatestClosedReview` filtra por `cycleKey`) + Maturidade frozen (ciclo passado) vs viva (ciclo ativo) + empty states
- testes em cada fase (INV-05)

## Sessions
_(log linear)_

## Shared Deltas
- `src/version.js` — bump v1.69.0 (reservada)
- `docs/registry/versions.md` — marcar v1.69.0 consumida
- `docs/registry/chunks.md` — liberar CHUNK-04/08/13
- `CHANGELOG.md` — nova entrada `[1.69.0]`
- `docs/decisions.md` — DEC-AUTO-289-* (regra de IA: analytics que somam moeda exigem plano; SWOT/Maturidade seguem ciclo; curva é nível-conta sempre visível)

## Decisions
_(IDs — texto em docs/decisions.md no encerramento)_

## Chunks
- CHUNK-13 (escrita) — gate governado pela barra de contexto
- CHUNK-04 (escrita) — analytics do dashboard (calculateStats/setup/emotion, TradingCalendar)
- CHUNK-08 (escrita) — SWOT/reviews + maturidade frozen nas revisões (Fase 2)
