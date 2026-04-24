# Worker Report — Template Estrito (R2)

> **Limite:** ≤ 2,5 KB (hard cap).
> **Localização do report:** `.cc-mailbox/outbox/NN-<slug>-report.md`
> **Regras:** sem narrativa, sem recontar diff, sem parágrafos de "raciocínio". Campo ausente → omite (não explica).

## Formato

```
TASK: NN-<slug>
STATUS: ok | fail

CLAIMS:
  commit: <sha>
  tests: <n passed> / <n failed>
  files:
    - <path1>
    - <path2>

DECISIONS: [DEC-AUTO-NNN-NN, ...]
INVARIANTS_CHECKED: [INV-04, INV-12, ...]
SHARED_FILES_UNTOUCHED: [CLAUDE.md, docs/PROJECT.md, ...]

ISSUES: <blocker descoberto ou null>
HANDOFF: <1-2 linhas pra próxima task>
```

## Exemplo preenchido

```
TASK: 14-d2-wire-narrativa-ia
STATUS: ok

CLAIMS:
  commit: a3302e01
  tests: 3/0
  files:
    - src/components/MaturityProgressionCard.jsx
    - src/__tests__/components/MaturityProgressionCard.test.jsx
    - src/utils/maturityAITrigger.js

DECISIONS: [DEC-AUTO-119-10]
INVARIANTS_CHECKED: [INV-04, INV-18]
SHARED_FILES_UNTOUCHED: [CLAUDE.md, docs/PROJECT.md, src/version.js]

ISSUES: null
HANDOFF: narrativa IA gatilha com proposedTransition=UP ou signalRegression=true. Próxima task (15 e1) congela maturitySnapshot no review.
```

## O que NÃO escrever

- ❌ "Implementei o componente X que recebe Y e faz Z" (já está no diff)
- ❌ "Escolhi a abordagem A porque achei melhor que B" (vira DEC-AUTO em `docs/decisions.md` se a decisão foi autônoma)
- ❌ "Comecei lendo o arquivo X, depois descobri Y..." (narrativa irrelevante)
- ❌ Recontagem de testes criados (já em `git diff` + CLAIMS.tests)
- ❌ Seção "Critérios de aceitação verificados" (redundante com INVARIANTS_CHECKED + tests passing)

## Validação automática

O coord roda `cc-validate-task.py` no report:
1. `commit_exists` — sha do CLAIMS existe em `git log`
2. `tests_match` — `n passed / n failed` bate com `npm test` real
3. `files_match` — arquivos listados batem com `git show --name-only <sha>`

Falha em qualquer check → **STOP-HALLUCINATION** (INV-27). Worker deve corrigir e reescrever o report.
