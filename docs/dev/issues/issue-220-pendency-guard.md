# Issue #220 — feat: Pendency Guard no StudentDashboard (parte 2/3 de #218)

## Autorização

- [x] Spec aprovada como parte do plano #218 (mockup textual no body do issue + plano em `quiet-nibbling-wilkinson.md` Phase C)
- [x] Memória de cálculo trivial (filtros derivados de hooks existentes; "pendency guard é session-scoped (sessionStorage)" em DEC-AUTO-218 *)
- [x] Marcio autorizou: "go" (01/05/2026, após encerramento #219)
- [x] Gate Pré-Código liberado

## Context

Aluno deixa de fechar trades já revisados pelo mentor (sinal de não estar lendo o feedback) e takeaways das revisões ficam abertos. Sem email (custo). Resolver com modal popup ao abrir StudentDashboard listando 2 categorias; OK dispensa por sessão (sessionStorage), volta na sessão seguinte se persistir. Irritação deliberada pra forçar atenção.

## Spec

Ver issue body no GitHub: #220.

## Mockup

Modal glass card centrado, `z-50`, fundo overlay `bg-black/50`. Título "Você tem pendências".

Conteúdo: 2 cards lado-a-lado (ou empilhados em mobile):

- **Card âmbar (trades)** — ícone alerta, contagem grande "(2)", legenda "trades com feedback do mentor sem fechar". Lista top-5 (data + ticker + side + result colorido). Link "Ver todos" no rodapé do card → navega para `/extract` com filtro REVIEWED.
- **Card emerald (takeaways)** — ícone checklist, contagem "(3)", legenda "takeaways de revisões abertos". Lista top-5 (texto truncado + título da review). Link "Ver todos" → `/reviews`.

Footer: botão único "OK, entendi" (dispensa a sessão). Escape fecha = mesma coisa.

Quando uma das duas categorias está vazia, esconder card vazio. Quando AMBAS vazias → modal não renderiza.

## Memória de Cálculo

**Categorias derivadas de estado existente — zero campos novos.**

1. **Trades pendentes**: `useTrades(studentId).trades.filter(t => t.status === 'REVIEWED')`. Já existe (badge sidebar v1.19.7).
2. **Takeaways pendentes**: para cada review, item de takeaway é "aberto" se `!item.done && !(review.alunoDoneIds || []).includes(item.id)`. Achatar em lista flat com `reviewId`+`reviewTitle` para link.
   - Mesma fórmula que `PendingTakeaways.jsx` usa.

**Trigger condicional** (renderiza modal):

```
shouldShow =
  user.role === 'student'
  && !viewingAsStudent
  && onboardingStatus === 'active'
  && !sessionStorage.getItem(`pendency_dismissed_${user.uid}`)
  && (trades.length > 0 || takeaways.length > 0)
```

**Dismiss**: clique OK ou Escape → `sessionStorage.setItem(`pendency_dismissed_${uid}`, '1')`. Persiste na aba (F5 não traz de volta). Fecha aba/janela = nova sessionStorage = modal volta se itens persistirem.

## Phases

- C1 — `usePendencyGuard(studentId)` hook (agrega 2 categorias, lê sessionStorage, expõe `dismiss()`)
- C2 — `PendencyGuard.jsx` modal componente (glass card, Escape, OK, top-5)
- C3 — montar `<PendencyGuard>` em `App.jsx` envolvendo `<StudentDashboard>` (skip viewingAsStudent + onboarding inativo)
- C4 — testes hook + modal
- C5 — verificação UI local (Tailscale)

## Sessions

_(preenchido durante implementação)_

## Shared Deltas

- `src/version.js` — entrada `1.51.0` mantida (já reservada na abertura)
- `docs/registry/versions.md` — marcar 1.51.0 consumida no encerramento
- `docs/registry/chunks.md` — liberar CHUNK-02 no encerramento
- `CHANGELOG.md` — nova entrada `[1.51.0] - 01/05/2026`

## Decisions

Sem novas (todas já registradas como DEC-AUTO em `decisions.md` durante #218).

## Chunks

- CHUNK-02 (escrita) — App.jsx mount + envoltório do dashboard do aluno.
- CHUNK-08 (leitura) — `useWeeklyReviews` para takeaways.
- CHUNK-04 (leitura) — `useTrades` para REVIEWED.
