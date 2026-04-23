# Issue #174 — Wire setupsMeta em MentorDashboard (fix E4 out-of-scope de #170)

**Baseado na versão PROJECT.md:** 0.32.0
**Branch:** `fix/issue-174-mentor-setups-meta`
**Worktree:** `~/projects/issue-174`
**Versão reservada:** v1.42.1 (patch)

## 1. Escopo

Completar o E4 da spec de #170 que foi cortado durante o merge. A spec dizia "Consumido em StudentDashboard e **MentorDashboard**" — só o StudentDashboard recebeu wire.

Mudanças em `src/pages/MentorDashboard.jsx`:

1. Importar `useSetups` (linha ~top com outros hooks)
2. Consumir no body do componente
3. Memoizar filtro por aluno selecionado: `s.isGlobal || s.studentId === selectedStudent?.uid`
4. Passar `setupsMeta={studentSetups}` ao `<SetupAnalysis>`

## 2. Impacto

| Aspecto | Detalhe |
|---------|---------|
| Collections | Zero escrita. `useSetups` já tem listener ativo para mentor — não adiciona query nova. |
| CFs | Nenhuma |
| Hooks | `useSetups` passa a ser consumido em `MentorDashboard.jsx` |
| Blast radius | Zero — isolado ao MentorDashboard |
| Rollback | `git revert` limpo |

## 3. INVs

- INV-01/02: ✅ zero escrita em trades/plans
- INV-04: DebugBadge mantido
- INV-05: teste antes da implementação
- INV-10/15: zero estrutura Firestore nova

## 4. Ordem de implementação

1. Teste falhando: setup de outro aluno NÃO deve aparecer no `setupsMeta` quando mentor visualiza aluno X
2. Implementação (import + memo + prop)
3. Teste passa
4. Suite completa verde
5. PR com `Closes #174`

## 5. Deltas shared files

- `src/version.js` já bumped para 1.42.1 na abertura (main commit `372c87aa`) — promovo [RESERVADA] no encerramento
- `docs/PROJECT.md` §6.3 lock registrado; no encerramento libero + bump 0.32.0 → 0.33.0 + entrada §10 CHANGELOG

## 6. Log da sessão

### 23/04/2026 — Abertura
- Issue #174 criada no GitHub
- PROJECT.md v0.31.0 → v0.32.0 (abertura registrada na tabela de histórico)
- Lock CHUNK-16 registrado em §6.3
- v1.42.1 reservada em `src/version.js`
- Worktree criado em `~/projects/issue-174`
- Control file criado (este)
