# Issue #497 — fix: aluno conversa e encerra feedback de trade em ciclo fechado

## Autorização

- [x] Regra de negócio aprovada — Marcio, 03/11/2026 (body da issue, "Regra aprovada")
- [x] Mockup apresentado — 04/11/2026
- [x] Memória de cálculo — não se aplica (sem fórmula; regra condicional descrita abaixo)
- [x] Marcio autorizou — 04/11/2026, "sim"
- [x] Gate Pré-Código liberado

## Context

O selo do #259 trava qualquer update em trade com `date ≤ plan.lastClosedCycleEnd`. As exceções
existentes são o mentor (#302, só metadado de revisão) e a `selfReview` do aluno (#308). A conversa do
aluno (dúvida → `QUESTION`, encerrar → `CLOSED`) ficou de fora por omissão: com o ciclo fechado, o
mentor revisa, mas o aluno não responde nem encerra, e a tela não avisa nada.

## Spec

Ver issue body no GitHub: #497.

## Mockup

**1. Feedback do trade (aluno, ciclo fechado, status Revisado).** Nada muda na tela. "Dúvida" e
"Encerrar" passam a funcionar. Se a gravação falhar por qualquer motivo, aparece um toast vermelho:

```
┌──────────────────────────────────────────────┐
│ ✕  Não foi possível enviar a dúvida          │
│    Tente novamente. Se persistir, avise o    │
│    mentor.                                   │
└──────────────────────────────────────────────┘
```
(no Encerrar o título é "Não foi possível encerrar o trade"; ao enviar comentário avulso,
"Não foi possível enviar o comentário")

**2. Fechamento de ciclo — Etapa 8 "Tudo pronto pro selo".** Novo bloco âmbar logo acima de
"Antes de selar". Só aparece se houver trade do período em Revisado ou Dúvida:

```
┌──────────────────────────────────────────────────────────────┐
│ ⚠ 3 trades deste ciclo ainda têm conversa em aberto          │
│   Você pode selar mesmo assim — depois do selo, a conversa   │
│   continua liberada; só os dados do trade ficam travados.    │
│                                                              │
│   30/10  WINZ26   Revisado — falta você encerrar   [Abrir →] │
│   29/10  WINZ26   Dúvida — aguardando o mentor     [Abrir →] │
│   28/10  WDOZ26   Revisado — falta você encerrar   [Abrir →] │
└──────────────────────────────────────────────────────────────┘
```

- Pior caso de altura: lista com rolagem própria a partir de 6 itens (máx. ~6 linhas visíveis).
- "Abrir →" fecha o wizard (o rascunho do fechamento já é salvo) e abre o feedback do trade. Para
  voltar ao fechamento, o aluno reabre o wizard pelo mesmo botão de sempre.
- Mentor fechando pelo painel dele vê o mesmo bloco, sem o "Abrir →".
- Zero pendências: o bloco não aparece. O botão "Selar" nunca é bloqueado por ele.

## Regra (servidor)

Update em trade de ciclo selado passa quando **todas** valem:
- quem escreve é o aluno dono do trade (o `isOwner`/`isOwnerByEmail` já existente);
- o único delta é `feedbackHistory`, `status`, `updatedAt` (sem `get()` do plano, igual ao #302);
- o status final é `REVIEWED` (comentário sem mudar status), `QUESTION` ou `CLOSED`;
- o status de origem é `REVIEWED` (a máquina de estados atual do aluno).

`DISCUSSED` continua barrado pelo bloco já existente (INV-30). Campos do trade seguem selados.

## Phases

- A1 — rule: exceção do aluno para a conversa + testes da allowlist/transições
- A2 — `FeedbackPage`: toast nas três falhas (comentário, dúvida, encerrar)
- B1 — helper puro `listOpenConversations(trades, cycleStart, cycleEnd)` + testes
- B2 — bloco na Etapa 8 + atalho "Abrir →" (aluno) + teste do componente
- C1 — suíte completa (TZ=UTC), build, deploy das rules após merge

## Sessions

| # | data | o que saiu |
|---|------|-----------|
| 1 | 04/11 | abertura: locks, v1.92.24, worktree, este doc com mockup |
| 2 | 04/11 | A1–C1: exceção #497 na rule + espelho `feedbackSealException.js`; toasts no FeedbackPage; `listOpenConversations` + `OpenConversationsNotice` na Etapa 8; 25 testes novos, suíte 5561 passed (TZ=UTC), build ok, rules compilam (dry-run) |

## Shared Deltas

- `firestore.rules` — exceção do aluno (A1); deploy após merge
- `docs/firestore-schema.md` — citar a exceção #497 ao lado de #302/#308
- `src/version.js`, `CHANGELOG.md`, `docs/registry/*` — encerramento

## Decisions

- DEC-497-01 — emulador de rules indisponível (sem Java): regra testada por espelho puro + teste de paridade sobre o texto de `firestore.rules`

## Chunks

- CHUNK-08 (escrita) — rules de `/trades` para a conversa, toast no `FeedbackPage`
- CHUNK-03 (escrita) — aviso na Etapa 8 do fechamento de ciclo
