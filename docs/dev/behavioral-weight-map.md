# Mapa de Pesos Comportamentais — derivado do Framework Evolutivo

> **Status: APROVADO por Marcio (01/06/2026)** — inclui as 3 decisões abertas (findings novos pesam em F/O; positivos como bônus; faixas `ruleViolationRate` §5.3 viram gates). Números finais por severidade calibram na Fase 2 sobre a baseline congelada.
> SSoT de origem: [`trader_evolution_framework.md`](trader_evolution_framework.md). Encodado em `src/constants/behavioralTaxonomy.js`.
> Este mapa substitui os `EVENT_PENALTIES` ad-hoc de `emotionalAnalysisV2.js:77` (wiring na Fase 2).

## Princípio

Cada finding do motor unificado mapeia para **um viés nomeado no framework**, a **dimensão(ões)** 4D que ele informa (E/F/O), e o **efeito** no score/gate. O efeito deriva de:
- **Vieses** — framework §2.2 (disposition, revenge, overconfidence), §3 Bloco C (FOMO, martingale), §2.3 (regulação/locus).
- **Bottlenecks de progressão** — §7.1: *loss-aversion + overconfidence* travam o Emocional; *profit-taking/greed* trava o Financeiro; *triggers não-nomeados* travam o Operacional.
- **Indicador quantitativo de estágio** — §5.3 "Rule Violations %": Stage1 >30% · Stage2 10-20% · Stage3 <5% · Stage4 <1% · Stage5 ~0%. → a **taxa de findings negativos por trade** é a métrica-ponte para os gates de estágio.
- **Correlação de risco** — §6.2: "High Financial + Low Emotional = False Confidence → blow-up +50%"; martingale/averaging é sinal de blow-up.

## Tabela mestre

Severidade: **A**lta / **M**édia / **B**aixa. Efeito: `penalidade no score da dimensão` e/ou `gate count==0`.

| Finding (família canônica) | Viés (framework §) | Dimensão | Sev | Efeito no score/gate |
|---|---|---|---|---|
| `TILT` | Reatividade / regulação baixa (§2.3-2; §7.1 emo) | **E** | A | penalidade E alta; entra na `rule-violation rate`; `tilt+revenge==0` gate 4→5 |
| `LOSS_CHASING` (revenge + reentrada rápida pós-stop) | Revenge trading (§2.2 Q5) | **E** | A | penalidade E alta; rate; gate 4→5 |
| `STOP_PANIC` (tampering + breakeven cedo) | Loss aversion / disposition (§2.2; §7.1) | **E** | A | penalidade E alta; `no-stop-tampering count==0` gate 3→4 |
| `AVERAGING_DOWN` (martingale) | Martingale escalation / denial (§3 Bloco C) | **E+F** | A | penalidade E+F alta (sinal de blow-up §6.2) |
| `HOLD_ASYMMETRY` | Disposition effect (§2.2 Q4) | **E+F** | M | penalidade E+F |
| `LATE_EXIT` | Hope / loss aversion (§7.1) | **E+F** | M | penalidade E+F |
| `EARLY_EXIT` | Disposition / fear (§2.2 Q4) | **E+F** | M | penalidade E+F |
| `GREED_CLUSTER` | Profit-taking / greed (§3; §7.1 fin) | **F** | M | penalidade **F** (hoje vale zero) |
| `SUB_SIZING` | Avoidance / subdimensionar (§2.2; UNDERSIZED #129) | **E+F** | M | penalidade; `disciplined-sizing count==0` gate 3→4 |
| `CHASE_REENTRY` | Overconfidence / FOMO (§2.2 Q6) | **E+O** | M | penalidade; `no-chase count==0` gate 3→4 |
| `FOMO_ENTRY` | FOMO trigger (§3 Bloco C) | **E+O** | M | penalidade |
| `OVERTRADING` / `IMPULSE_CLUSTER` | Anxiety / impulsividade; rule violations (§5.3) | **E+O** | M | penalidade; conta como rule-violation |
| `DIRECTION_FLIP` | Confusion / falta de sistema (§4 operacional) | **O** | B | penalidade O |
| `HESITATION` | Indecisão / regulação (§2.3) | **E** | B | penalidade E baixa |
| `CLEAN_EXECUTION` (positivo) | Disciplina — perfil SAGE (§2.4) | **E** | — | **bônus** (reforço positivo) |
| `TARGET_HIT` (positivo) | Paciência / adesão ao plano (§5) | **E+O** | — | **bônus** |

## Mudanças vs. hoje (o que passa a pesar)

- **Novo no Financeiro (F):** GREED_CLUSTER, AVERAGING_DOWN, HOLD/EARLY/LATE_EXIT, SUB_SIZING — hoje valem zero; o framework os trata como disciplina de gestão de risco/profit-taking (§3, §7.1).
- **Novo no Operacional (O):** DIRECTION_FLIP, FOMO_ENTRY, OVERTRADING — triggers/sistema (§4).
- **Mantêm peso no Emocional (E):** TILT, LOSS_CHASING, STOP_PANIC (já pesavam).
- **Positivos passam a contar como reforço:** CLEAN_EXECUTION, TARGET_HIT.

## Métrica-ponte (gates de estágio)

`ruleViolationRate = findings_negativos_que_contam / trades_na_janela`, comparada às faixas §5.3:
| Estágio | Rule violations | (gate proposto) |
|---|---|---|
| 1→2 | sair de >30% | rate ≤ 0.30 |
| 2→3 | 10-20% | rate ≤ 0.15 |
| 3→4 | <5% | rate ≤ 0.05 + counts==0 (tampering/chase/sizing) |
| 4→5 | ~0% | rate ≤ 0.01 + tilt+revenge==0 |

## Exemplo numérico (massa Elza, 18/05 — dia de descontrole)
Janela com 9 ops de 18/05, findings: 9×OVERTRADING, 8×IMPULSE, 1×REVENGE(→LOSS_CHASING), 2×reentrada-rápida(→LOSS_CHASING), 1×DIRECTION_FLIP.
- `ruleViolationRate` do dia ≈ alto → puxa E e O pra baixo; LOSS_CHASING (3 ocorrências) bloqueia gate 4→5; DIRECTION_FLIP penaliza O.
- (Pesos numéricos exatos por severidade A/M/B a calibrar na Fase 2, sobre a baseline congelada — esta tabela fixa o **mapeamento**, não os números finais.)

## Decisões abertas para Marcio
1. **OK os findings novos passarem a pesar em F e O** (não só E)? — é o que o framework sugere, mas muda o perfil 4D dos alunos prospectivamente.
2. **Positivos (CLEAN_EXECUTION/TARGET_HIT) como bônus** no score, ou só informativos?
3. **Faixas de `ruleViolationRate`** acima (derivadas de §5.3) — aprovar como gates ou manter só os `count==0` atuais?
