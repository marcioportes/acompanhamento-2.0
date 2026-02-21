# Sprint 1.6.0 — Patch 2 (21/02/2026)

## Análise de Impacto

### Princípios respeitados
- Front NUNCA toca em `currentBalance` — só Cloud Functions via `onMovementCreated`
- `addAccount` grava `currentBalance: 0`, depois cria `INITIAL_BALANCE` movement
- Cloud Function soma amount ao saldo automaticamente
- Auditoria compara `currentBalance` (CF) vs soma movements (front)

### O que mudou (e SOMENTE isso)

| Arquivo | Mudança | Risco |
|---------|---------|-------|
| `useAccounts.js` | `INITIAL_BALANCE.date` usa `accountData.createdAt` (antes: `today`) | **BAIXO** — só afeta contas NOVAS |
| `AccountsPage.jsx` | Auditoria compara datas como strings YYYY-MM-DD (antes: Date objects) | **BAIXO** — elimina bug de fuso GMT-3 |
| `AccountsPage.jsx` | `handleFixIssues` grava `dateTime` como ISO (`2026-01-01T00:00:00.000Z`) (antes: `2026-01-01` sem T) | **BAIXO** — corrige parsing |
| `AccountsPage.jsx` | Detecta INITIAL_BALANCE com data posterior a outros movimentos | **NENHUM** — novo check, não altera existente |
| `AccountDetailPage.jsx` | **ZERO MUDANÇAS** | — |
| `TradesJournal.jsx` | Passa `getPartials` ao `TradeDetailModal` | **NENHUM** — prop nova, sem breaking change |
| `TradeDetailModal.jsx` | Fetch parciais da subcollection ao abrir | **NENHUM** — graceful fallback se sem partials |
| `AddTradeModal.jsx` | Items 1-5 (labels, inputs BR, moeda, validação, sanitização) | Ver rodada anterior |
| `useTrades.js` | Movement amount sanitizado como número | Ver rodada anterior |

### O que NÃO mudou
- Cloud Functions (`index.js`) — nenhuma alteração
- `useMovements.js` — nenhuma alteração
- Fluxo de `currentBalance` — permanece exclusivo da CF
- Reverse Ledger (AccountDetailPage) — âncora inalterada
- Firestore rules — inalteradas
- Nenhum import novo, nenhuma dependência nova

## Arquivos incluídos

Descompactar sobre a raiz do projeto (`acompanhamento-2.0/`):

```
src/
├── components/
│   ├── AddTradeModal.jsx      ← Items 1-5 (labels, BR inputs, moeda, validação, sanitização)
│   └── TradeDetailModal.jsx   ← Item 6 (fetch + display parciais)
├── hooks/
│   ├── useAccounts.js         ← Fix: INITIAL_BALANCE.date = createdAt da conta
│   └── useTrades.js           ← Item 5 (movement amount como número)
└── pages/
    ├── AccountsPage.jsx       ← Fix: Auditoria string YYYY-MM-DD + dateTime ISO
    └── TradesJournal.jsx      ← Fix: Passa getPartials ao TradeDetailModal
```

**NÃO incluídos (inalterados):**
- `AccountDetailPage.jsx`
- `useMovements.js`
- Cloud Functions `index.js`

## Deploy

```bash
cd acompanhamento-2.0
unzip -o sprint-1.6.0-patch2.zip
npm run dev  # teste local
```

## Checklist de teste

- [ ] Criar conta nova com data de abertura retroativa → INITIAL_BALANCE com data correta?
- [ ] Editar conta existente → clicar Verificar → auditoria detecta discrepância?
- [ ] Clicar Corrigir → saldo e data atualizados?
- [ ] Abrir detalhe de trade com parciais → parciais exibidas na tabela?
- [ ] Criar trade com parciais → labels Compra/Venda corretos?
- [ ] Resultado do trade formatado em moeda?
- [ ] Movement no Firestore → amount é número (não string)?

## Prompt de continuidade (para outra IA)

```
Contexto: Acompanhamento 2.0, plataforma de mentoria de trading.
Stack: React 18 + Vite + Firebase/Firestore + Tailwind CSS + Cloud Functions v1.
Repositório: marcioportes/acompanhamento-2.0
Branch: feature/trade-partials (v1.6.0)

Arquitetura de saldo:
- Front cria movements (INITIAL_BALANCE, DEPOSIT, WITHDRAWAL, TRADE_RESULT, ADJUSTMENT)
- Cloud Function onMovementCreated soma amount ao currentBalance da conta via transaction
- Front NUNCA atualiza currentBalance diretamente
- Auditoria (AccountsPage) compara currentBalance vs soma dos movements

Modelo de parciais:
- Subcollection: trades/{tradeId}/partials/{partialId}
- Campos: seq, type (ENTRY|EXIT), price, qty, dateTime, notes
- Trade master: hasPartials, partialsCount, avgEntry, avgExit, resultCalculated, resultInPoints
- Display: Compra/Venda mapeado pelo trade.side (LONG: ENTRY=Compra, SHORT: ENTRY=Venda)

Último sprint (1.6.0): 6 items de UX para parciais + fix auditoria de saldo/cronologia.
Próximos: bump version.js, merge para main, tag v1.6.0.
```
