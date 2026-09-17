# Issue #451 — fix: trade discutido é reescrito pelo servidor — a imutabilidade só existe contra o cliente

> **Branch:** `fix/issue-451-trade-discutido-imutavel`
> **Aberto em:** 17/09/2026
> **Status:** 🟢 Autorizado — modo autônomo
> **Versão reservada:** 1.92.3

## Autorização

- [x] Mockup — **não se aplica:** trava de escrita no servidor, sem UI nova.
- [x] Memória de cálculo apresentada (17/09/2026) — regra booleana + inventário medido na base
- [x] Marcio autorizou (17/09/2026): *"Ataca 451 em modo autônomo"*
- [x] Gate Pré-Código liberado

## Context

**Trade em `status: DISCUSSED` é imutável** — o registro do trade discutido é o registro da conversa que houve com o aluno. Hoje essa garantia existe **apenas contra o cliente**: `firestore.rules` torna terminal qualquer trade já `DISCUSSED`, mas toda função com admin SDK passa por fora das rules.

Duas funções reescrevem trade discutido sem olhar o status, e não são scripts esporádicos — são a rotina: editar `riskPerOperation`, `rrTarget`, `periodStop` ou `cycleStop` no plano dispara a cascata.

**239 dos 413 trades da base (58%) são `DISCUSSED`** e estão expostos.

## Spec

Ver issue body no GitHub: #451, mais o comentário "Como a regra é garantida" (desenho das 3 camadas).

## Mockup

Não se aplica. Efeito visível: a auditoria do plano passa a informar quantos trades foram preservados.

## Memória de Cálculo

### A regra

```
tradeEhImutavel(trade) = trade.status === 'DISCUSSED'
```

O critério é **só o status** (Marcio, 17/09/2026: *"Trades que estejam em ciclo fechado e não foram discutidos, podem ser alterados. Somente discussed é imutável."*). Ciclo fechado não entra — o seal do #259 no `firestore.rules` é outra coisa e fica como está.

### Inventário medido (17/09/2026)

| escrita | campos | gatilho |
|---|---|---|
| `recalculateCompliance` (`functions/index.js`) | `riskPercent`, `rrRatio`, `rrAssumed`, `compliance`, `redFlags` | cascata de `usePlans.updatePlan` nos 4 campos de risco + botão de auditoria |
| `recomputeBehaviorForStudent` (`functions/behavior/recomputeBehaviorProfiles.js`) | `behaviorProfile` (batch) | chamada pela cascata acima e outros caminhos |

Base: 413 trades — 239 `DISCUSSED`, 97 `CLOSED`, 57 `REVIEWED`, 19 `OPEN`, 1 `QUESTION`. Dos 162 em ciclo fechado, os 162 são `DISCUSSED` (a regra de ciclo não libera ninguém hoje).

### Casos limites

- **Transição para discutido:** `publishReview` faz `tx.update(d.ref, { status: 'DISCUSSED' })`. A trava barra escrita em quem **já está** discutido; a transição segue livre.
- **Exclusão:** cascatas (`deleteStudentData`, `deletePlanCascade`, `cascadeDeleteTradeRefs`) continuam apagando trade discutido. Imutável é sobre reescrever, não sobre apagar.
- **PL do plano:** `currentPl` é campo do plano, não do trade — segue recalculando normalmente.
- **Trade não discutido:** recalculado como hoje, inclusive dentro de ciclo fechado.
- **Doc sem campo `status`:** tratar como mutável (legado) — só `=== 'DISCUSSED'` trava.

## 3.1 Decisões Antecipadas (respostas do Marcio — aplicar sem novo gate)

- **D1** — critério é só `status === 'DISCUSSED'`. Ciclo fechado **não** entra.
- **D2** — a transição para `DISCUSSED` (publishReview) continua permitida.
- **D3** — exclusões em cascata continuam permitidas; a trava é de update, não de delete.
- **D4** — recálculo de PL do plano não muda.
- **D5** — a cerca **estende `src/__tests__/invariants/tradeWriteBoundary.test.js`** (o arquivo já existe e cobre só `src/` com padrões do SDK do cliente); não criar mecanismo novo. Whitelist explícita: helper + `publishReview` + cascatas de exclusão.
- **D6** — as duas funções reportam quantos trades preservaram, no retorno e no log.
- **D7** — suíte roda também em `TZ=UTC` antes do PR (lição do #449: a CI roda em UTC e a suíte local em BRT esconde defeito).
- **D8** — **nenhum backfill, nenhuma migração de dados.** Não tocar em trade existente.
- **D9** — sem campo novo no Firestore (INV-15 não é acionada).

## Phases

- **01-helper** — `functions/_shared/tradeImmutability.js`: predicado + duas variantes de escrita guardada (avulsa, que lê o doc; e com doc já lido, para batch/transação). Testes unitários: barra update em `DISCUSSED`, permite nos demais status, permite a transição para `DISCUSSED`, trata doc sem `status`.
- **02-aplicar** — `recalculateCompliance` e `recomputeBehaviorForStudent` passam pelo helper, pulam os discutidos e devolvem/logam `preservados`. Testes cobrindo os dois caminhos com massa mista.
- **03-cerca** — estender `tradeWriteBoundary.test.js` para varrer `functions/**` com padrões do admin SDK (`db.collection('trades')` + `.update(`/`.set(`/`.delete(`, `batch.update`, `tx.update`), com whitelist. O teste deve **reprovar** se alguém remover a guarda.
- **04-entrega** — suíte completa em `TZ=UTC` **e** no fuso local, lint nos arquivos tocados, build. Report com as duas contagens.

## Sessions

## Shared Deltas

- `src/version.js`: 1.92.3 (já reservada no main)
- `docs/registry/versions.md`: marcar 1.92.3 consumida
- `docs/registry/chunks.md`: liberar CHUNK-04
- `CHANGELOG.md`: entrada `[1.92.3]`
- `docs/PROJECT.md`: bump + parágrafo de encerramento **e linha na tabela de histórico**
- `docs/invariants.md`: avaliar se a trava vira invariante própria (proposta: sim — INV-30)

## Decisions

## Chunks

- CHUNK-04 (escrita) — trava de imutabilidade no servidor
- CHUNK-05 (leitura) — compliance
- CHUNK-11 (leitura) — behaviorProfile
