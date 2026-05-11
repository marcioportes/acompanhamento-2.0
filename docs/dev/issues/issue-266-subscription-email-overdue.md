# Issue #266 — fix: relatório diário Assinaturas mostra renovações futuras como inadimplentes

> Template enxuto (R4). Worktree: `~/projects/issue-266` · Branch: `fix/issue-266-subscription-email-overdue` · Versão reservada: **v1.61.1**

## Autorização

- [x] Mockup — exceção autorizada (bug fix, sem UI nova; label do email descrito em texto)
- [x] Memória de cálculo — apresentada no issue body (auto-recovery table)
- [x] Marcio autorizou — 11/05/2026 "confirmo"
- [x] Gate Pré-Código liberado

## Context

Email diário do CF `checkSubscriptions` (recebido por Marcio em 11/05/2026) classificou 4 assinaturas com `renewalDate` no FUTURO como "INADIMPLENTES EM ABERTO": Wilson (21/05), Yoaquim (03/12), Rodrigo (31/05), Gizele (31/05). Gizele também com R$ 0,00 — diagnóstico próprio. Causa raiz documentada no issue body: CF não tem auto-recovery + label cosmético usa `Math.abs` + `updateSubscription` UI é cego.

## Spec

Ver issue body: #266.

## Mockup — label do email

```
ANTES (bug)                                    DEPOIS (fix)
INADIMPLENTES EM ABERTO                        INADIMPLENTES EM ABERTO
• Wilson — venceu 21/05/2026 (10 dias)         • João Paulo — venceu há 96 dias (03/02/2026)
                                               • Rafael — venceu há 10 dias (01/05/2026)

                                               (Wilson/Yoaquim/Rodrigo/Gizele saem
                                                desta seção após auto-recovery; aparecem
                                                em "Vencendo Hoje" / "Vencendo em 7 Dias"
                                                / silenciosas, conforme daysToRenewal)
```

## Memória de cálculo — auto-recovery no CF

**Inputs:**
- `sub.status` em `students/{uid}/subscriptions/{subId}` (Firestore)
- `sub.renewalDate` (Timestamp)
- `sub.gracePeriodDays` (default 5)
- `student.loginBlockedReason` em `students/{uid}` (default null)

**Cálculo:**
- `today` = data do CF (00:00:00 BRT)
- `daysToRenewal = daysBetween(today, renewalDate)` (assinado; positivo = futuro)
- `graceDays = sub.gracePeriodDays ?? 5`

**Decisão para sub com `status === 'overdue'`:**

| Condição | Ação no Firestore | Roteamento no email |
|---|---|---|
| `daysToRenewal > 7` (futuro, longe) | `status → active`. Se `student.loginBlockedReason === 'auto'`: desbloqueia (`loginBlocked: false`, `loginBlockedReason: null`, Auth user enabled) | silenciosa (só conta em totalActive + monthlyRevenue) |
| `1 ≤ daysToRenewal ≤ 7` | `status → active` + desbloqueio condicional | `expiringSoon` |
| `daysToRenewal === 0` | `status → active` + desbloqueio condicional | `expiringToday` |
| `-graceDays ≤ daysToRenewal < 0` | `status → active` + desbloqueio condicional (assinatura dentro do grace = ainda ativa por política) | `expiringToday` (atenção: já vencida, dentro do grace) |
| `daysToRenewal < -graceDays` | mantém `status: 'overdue'` | `existingOverdue` (comportamento atual) |
| `renewalDate` ausente/inválido | mantém `status: 'overdue'` | `existingOverdue` |

**Exemplo numérico — Wilson em 11/05/2026:**
- `sub.status = 'overdue'`, `sub.renewalDate = 21/05/2026`, `graceDays = 5`
- `daysToRenewal = 10` → cai em "futuro, longe"
- Firestore: batch update `status: 'active'`. Se student.loginBlockedReason === 'auto': desbloqueia.
- Email: silenciosa (não aparece em nenhuma seção).

**Casos limites:**
- Trial com status='overdue' — N/A, trial usa `expired`, não `overdue`. Lógica do trial não muda.
- Sub com `status='active'` e `renewalDate < -graceDays` — comportamento atual mantido (vira `newOverdue`).
- Múltiplas subs do mesmo student — auto-recovery por sub individualmente.
- Sub com `gracePeriodDays === 0` — `-graceDays === 0`, então `daysToRenewal === 0` ainda recupera (today). Negativo qualquer cai em existingOverdue.

## Memória de cálculo — label cosmético

**ANTES (`checkSubscriptions.js:75-79`):**
```js
const days = Math.abs(daysBetween(today, date));
const dateLabel = isOverdue
  ? `venceu ${formatBrDate(date)} (${days} dias)`
  : `vence ${formatBrDate(date)}`;
```

**DEPOIS:**
```js
const diff = daysBetween(today, date);  // assinado
let dateLabel;
if (diff < 0) {
  dateLabel = `venceu há ${Math.abs(diff)} dia${Math.abs(diff) === 1 ? '' : 's'} (${formatBrDate(date)})`;
} else if (diff === 0) {
  dateLabel = `vence hoje (${formatBrDate(date)})`;
} else {
  dateLabel = `vence em ${diff} dia${diff === 1 ? '' : 's'} (${formatBrDate(date)})`;
}
```

Aplica em ambas as seções (newOverdue e existingOverdue). Plural correto.

## Phases

- F0 — diagnóstico readonly em prod: subs com `status='overdue'` + `renewalDate >= today − graceDays`; também investigar Gizele R$ 0,00 (script `scripts/issue-266-diag-overdue.mjs`)
- F1 — testes unitários (INV-05): auto-recovery (5 cenários) + label (3 cenários) + defensive hook (2 cenários)
- F2 — fix CF (`functions/subscriptions/checkSubscriptions.js`): auto-recovery + desbloqueio + label
- F3 — defensive `updateSubscription` (`src/hooks/useSubscriptions.js`): renewalDate futuro + status overdue → reset active
- F4 — deploy CF (`firebase deploy --only functions:checkSubscriptions`)
- F5 — verificação D+1: email do dia seguinte sem Wilson/Yoaquim/Rodrigo (Gizele com diagnóstico próprio em F0)
- F6 — encerramento via `cc-close-issue.sh 266`

## Sessions

_(preenche durante execução, 1 linha/task)_

## Shared Deltas

- `src/version.js` — bump 1.61.0 → 1.61.1, build 20260511 (já tem entrada CHANGELOG reservada)
- `docs/registry/versions.md` — marcar v1.61.1 consumida
- `docs/registry/chunks.md` — liberar CHUNK-02 (ESCRITA #266)
- `CHANGELOG.md` — nova entrada `[1.61.1] - 11/05/2026`

## Decisions

_(ID texto em docs/decisions.md)_

- DEC-AUTO-266-01 — auto-recovery no CF é safe-by-default: status overdue só é mantido quando renewalDate < today − graceDays. Reconcilia divergência entre UI (computa on-the-fly) e CF (lê literal Firestore).
- DEC-AUTO-266-02 — desbloqueio de Auth fica condicional a `loginBlockedReason === 'auto'`. Bloqueios manuais (mentor) não são revertidos automaticamente. Mirror simétrico do autobloqueio em G1 #263.

## Chunks

- CHUNK-02 Student (ESCRITA) — toca CF `checkSubscriptions` (subscriptions subcollection + students doc) + hook `useSubscriptions` (defensive em updateSubscription)
