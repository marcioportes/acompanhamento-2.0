# Issue #440 — fix: calendário ilegível + aba "Closures"

## Autorização

- [x] Marcio, 11/09/2026: *"pode atacar 2"* (o item 2 do levantamento de resquícios do face lift)
- [x] Gate Pré-Código liberado

## Causa

`TradingCalendar.jsx` pinta o número do dia com `text-slate-700`. O #428 remapeou a escala `slate`
(`tailwind.config.js:20`) e `slate-700` virou `#2a323d` — **1,44:1** de contraste sobre o fundo do
card, contra 4,5:1 do mínimo WCAG. Não é contraste baixo, é texto ausente.

`MentorDashboard.jsx:468` rotula a aba como `Closures` enquanto o menu diz `Fechamentos` — mesmo
destino, dois nomes, um em inglês.

## Correção

| onde | antes | depois | contraste |
|---|---|---|---|
| `TradingCalendar:183` dia sem trade | `slate-700` | `slate-500` | 1,44 → **3,94:1** |
| `TradingCalendar:237` separador `/` | `slate-700` | `slate-500` | idem |
| `TradingCalendar:278` dia sem trade | `slate-700` | `slate-500` | idem |
| `MentorDashboard:468` | `'Closures'` | `'Fechamentos'` | — |

`slate-500` e não `slate-400`: o dia sem trade continua secundário por hierarquia, só deixa de ser
invisível. `slate-400` (7,45:1) o igualaria ao dia com trade.

## Verificação

- 4.769 testes / 299 arquivos
- foto do harness antes e depois: os dias 6 a 30 passam de invisíveis a legíveis
- build verde

## Chunks

- CHUNK-16 (escrita) — Mentor Cockpit
