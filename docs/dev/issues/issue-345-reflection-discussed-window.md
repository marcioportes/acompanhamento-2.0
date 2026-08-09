# Issue #345 — fix: reflexão não grava vindo do aviso do dashboard (janela fecha em DISCUSSED)

## Autorização (OBRIGATÓRIA — sem isto é PROIBIDO iniciar desenvolvimento)

**Status atual do documento:**
- [x] Mockup apresentado — ver seção Mockup (3 estados + copy)
- [x] Memória de cálculo — **exceção autorizada** por Marcio ("pode pular a memória",
      09/08/2026). Não há fórmula, score, agregação nem threshold: a única regra nova é
      booleana (`status === 'DISCUSSED'` fecha a janela).
- [x] Marcio autorizou — 09/08/2026: "autorizado, pode pular a memória"
- [x] Gate Pré-Código liberado — leitura completa (fila → modal → componente → gateway →
      rules → `publishReview`), impacto declarado abaixo, INV-17/INV-18 cumpridas

## Context

Aluno chega pelo aviso "Trades a refletir" do dashboard, preenche a reflexão, clica em
Salvar e nada acontece — o trade volta pra fila e o aviso cobra o mesmo trade pra sempre.

`publishReview` marca **todos** os membros da revisão como `status: 'DISCUSSED'` sem exigir
`selfReview` (`functions/reviews/publishReview.js:85-90`). Rules e gateway tratam DISCUSSED
como terminal/imortal a writes de cliente (#269 v2), mas a fila e os gates de UI não conhecem
essa regra: oferecem a edição e o erro morre em `console.error`.

Objetivo: a UI passa a **respeitar** a regra que rules e gateway já impõem, e nenhuma falha
de write volta a ser silenciosa. Nada muda em `firestore.rules`, `publishReview` ou no gateway.

## Spec

Ver issue body no GitHub: #345.

## Mockup

### 1. Fila "Trades a refletir" (dashboard do aluno)

Sem mudança visual. Muda o conjunto: trade com `status === 'DISCUSSED'` **sai da lista** e
sai do contador do header. Fila que só tinha itens discutidos → card não renderiza (`null`,
comportamento atual quando `pending.length === 0`). O colapso do #329 (limiar 8) segue
operando sobre a lista já filtrada.

### 2. Trade DISCUSSED sem `selfReview`, visto pelo próprio aluno

`TradeReviewSection` ganha um estado read-only novo — hoje esse trade cai no formulário
editável (que não grava). Mesma moldura visual dos outros estados
(`border border-white/10 rounded-xl p-4 bg-white/5 mt-4`):

```
┌────────────────────────────────────────────────────────────────┐
│ 🗒  Reflexão            [ Janela fechada ]                     │
│                                                                │
│ Este trade foi discutido na revisão sem a sua auto-análise.    │
│ A reflexão vale antes da revisão — depois de conversar com o   │
│ mentor ela já não mede o que você pensava na hora do trade.    │
│                                                             ᴰᴮ │
└────────────────────────────────────────────────────────────────┘
```

- Badge "Janela fechada": `border-amber-500/30 text-amber-300`, mesmo formato do badge
  "Faria de novo: Sim/Não" do estado de leitura.
- Sem botão. Nada clicável — não promete gravação.
- Mentor não vê este estado: continua no alerta âmbar do `StudentReflectionPanel` (#323),
  que não muda.

### 3. Erro ao salvar (qualquer estado editável)

Hoje: exceção → `console.error` → painel volta ao normal, aluno não vê nada.
Passa a exibir, acima da linha de botões:

```
┌────────────────────────────────────────────────────────────────┐
│ ⚠ Não foi possível salvar sua reflexão. Tente de novo.        │
│   <mensagem técnica do erro, text-[11px] text-red-300/70>      │
└────────────────────────────────────────────────────────────────┘
```

- Caixa `border-red-500/30 bg-red-500/10 text-red-200`, `text-xs`.
- O formulário **não** é resetado (as respostas digitadas ficam) — hoje `reset()` só roda no
  sucesso, então isso já está correto; o que falta é a mensagem.
- Botão "Salvar revisão" reabilita depois da falha; `saving` continua guardando duplo clique.
- A mensagem técnica é exibida de propósito: é o que evita o próximo chamado invisível.

## Análise de Impacto

| Aspecto | Detalhe |
|---------|---------|
| Collections tocadas | nenhuma — nenhum write novo; só leitura de `trade.status` em display-time |
| Cloud Functions | nenhuma — **sem deploy** |
| Hooks/listeners | nenhum |
| Side-effects (PL, compliance, emotional) | nenhum — `selfReview` não entra no score 4D |
| Blast radius | 3 arquivos de UI/constantes + 2 de teste. Aluno: fila menor + estado novo no trade discutido. Mentor: zero (`StudentReflectionPanel` intocado) |
| Rollback | revert do PR — sem migração, sem dado gravado |

**INV-17:** nenhum nível de navegação novo; domínio CHUNK-04 (reflexão do trade); zero
duplicação (o estado nasce dentro do `TradeReviewSection`, não como card novo); budget
+~40 linhas em componente existente.

## Phases

- A1 — `PendingReflections`: excluir DISCUSSED do filtro + teste ✅
- A2 — gate de edição respeita DISCUSSED ✅ — **desvio de design deliberado** (ver abaixo)
- B1 — `TradeReviewSection`: estado read-only "janela fechada" + teste ✅
- C1 — `TradeReviewSection`: `submitError` visível no salvar + teste ✅

### Desvio de A2 (decisão técnica, DEC-AUTO-345-02)

O issue previa repetir `status !== 'DISCUSSED'` nos 3 call sites de `canReview`
(`TradeDetailModal:454`, `AddTradeModal:839` e `:1205`). Implementado diferente: a regra vira
predicado único `isReflectionWindowClosed(trade)` em `src/constants/tradeReviewFramework.js`
— o mesmo módulo que o gateway já importa — e o próprio `TradeReviewSection` decide.
Nenhum call site muda.

Motivo: `canReview` significa "este usuário pode refletir" (não-mentor, trade fechado);
"a janela fechou" é outra dimensão. Espalhar a segunda regra por 3 call sites triplicaria
o ponto de divergência que **causou** este bug. A defesa em profundidade real são as rules
e o gateway, que já rejeitam. Efeito colateral bom: o `canReview={true}` hardcoded do
`AddTradeModal` deixa de ser um furo em potencial.

## Sessions

- `task A1+A2+B1+C1 [reflection-discussed-window] commit <sha> ok — 13 testes novos, suíte 3581/3581, lint 0, build ok`

## Shared Deltas

Aplicar no MAIN após o merge:
- `src/version.js` — bump v1.83.3 (linha `(RESERVA)` já registrada no lock `d8edb524`)
- `docs/registry/versions.md` — marcar 1.83.3 consumida (PR + squash)
- `docs/registry/chunks.md` — liberar CHUNK-04
- `CHANGELOG.md` — entrada `[1.83.3] - DD/MM/2026`
- `docs/PROJECT.md` — bump + nota de encerramento (gap conhecido do `cc-close-issue.sh`)
- `docs/decisions.md` — 1 linha para a decisão da janela

## Decisions

- DEC-AUTO-345-01 — a janela de reflexão fecha quando o trade vira DISCUSSED; a UI alinha-se
  às rules em vez de contradizê-las (alternativa descartada: enfraquecer rules ou criar
  callable com admin SDK para furar o invariante do #269 v2).
- DEC-AUTO-345-02 — a regra da janela vira predicado único `isReflectionWindowClosed` no
  módulo que gateway e componentes já compartilham, em vez de replicada nos call sites de
  `canReview` (ver "Desvio de A2").
- DEC-AUTO-345-03 — mensagem de erro de write exibe o motivo técnico ao aluno (`err.message`),
  não só um texto genérico: é o que transforma "nada acontece" em chamado diagnosticável.

## Chunks

- CHUNK-04 (escrita) — `TradeReviewSection`, `PendingReflections`, gates em
  `TradeDetailModal` / `AddTradeModal`
- CHUNK-08 (leitura) — `StudentReflectionPanel` inalterado, só conferir paridade
