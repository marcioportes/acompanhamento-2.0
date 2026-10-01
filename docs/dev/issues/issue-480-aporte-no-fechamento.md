# Issue #480 — fix: fechamento de ciclo não deixa aportar capital no plano

> **Branch:** `fix/issue-480-aporte-no-fechamento` · **Aberto em:** 01/10/2026 · **Versão reservada:** 1.92.15

## Autorização

- [x] Mockup — exceção: fast track ordenado pelo Marcio (alunos fechando ciclo no dia); a tela não muda de estrutura, só o texto do aviso e o "máx" do campo.
- [x] Memória de cálculo — abaixo e no body da issue.
- [x] Marcio autorizou (01/10/2026): *"se não tiver saldo na conta tem que aportar como fiz já, o resto fica no fechamento do cycle, e o aluno pode fazer a alteração. Fast track com isso, tenho alunos fechando ciclo hoje"*
- [x] Gate Pré-Código liberado

## Context

`plan.pl` é imutável fora do fechamento (C1, DEC-AUTO-259-20) e o gate do fechamento só aceitava PL ≤ equity do ciclo: a única rota de mudança permitia reduzir, nunca aportar. Aluno querendo subir o plano de 25k para 60k só tinha a opção de deletar o plano. No mesmo gate, dois defeitos: ciclo negativo bloqueava sozinho no Passo 6 (o cliente comparava o PL antigo, o servidor rola pro equity) e "Aceitar sugestão" devolvia o PL pré-ciclo.

## Spec

Ver issue body: #480.

## Memória de Cálculo

```
equityDoCiclo   = PL inicial do ciclo + resultado do ciclo            (cycleBaseline.plFinal / snapshot.plEnd)
saldoLivreConta = accounts.currentBalance − Σ plans.pl (outros planos ativos, mesmo accountId)
lastroConta     = saldoLivreConta − Σ trades.result (este plano, date > cycleEnd)
teto            = max(equityDoCiclo, lastroConta)
gate            : PL do próximo ciclo ≤ teto + 0,10
PL sem ajuste   = equityDoCiclo
```

- `max`: nunca mais rígido que o gate anterior.
- Trades pós-ciclo saem do lastro: já contam no saldo do ciclo aberto (C2).
- Conta ausente, saldo ilegível ou plano de outra conta → teto = equity do ciclo.
- Equity ≤ 0 → sem gate (como antes, no servidor).
- Exemplo: plano 25.645,60, ciclo −287,80 → equity 25.357,80. Conta em 25.357,80 → teto 25.357,80. Aporte de 34.642,20 na conta → teto 60.000,00 → PL 60k aceito.

## Phases

- A1 — helper `allocationCeiling` (ESM + espelho CJS, paridade testada)
- A2 — `closeCycle`: lastro lido no servidor (`accountBacking`) + gate pelo teto
- A3 — Passo 6: teto, PL efetivo sem ajuste = equity, textos
- A4 — advisor: `newPl` sugerido = capital base

## Sessions

- `A1–A4 01/10/2026 ok`

## Shared Deltas

- `src/version.js` — bump v1.92.15
- `docs/registry/versions.md` — marcar v1.92.15 consumida
- `docs/registry/chunks.md` — liberar CHUNK-03
- `CHANGELOG.md` — entrada `[1.92.15] - 01/10/2026`
- `docs/decisions.md` — DEC-480-01..03
- `docs/cloud-functions.md` — `closeCycle`: gate de capital pelo teto (equity × lastro da conta)
- `docs/PROJECT.md` — encerramento

## Decisions

- DEC-480-01 — teto do PL no fechamento = max(equity do ciclo, lastro da conta); aporte exige saldo na conta (decisão do Marcio).
- DEC-480-02 — lastro desconta PL dos outros planos ativos e trades posteriores ao ciclo; lido fora da transaction, conta derivada do plano gravado.
- DEC-480-03 — sem ajuste do aluno o PL efetivo é o equity do ciclo, no cliente e na sugestão do advisor (espelha o servidor).

## Chunks

- CHUNK-03 (escrita) — `closeCycle`, gate de capital do plano, Passo 6.
