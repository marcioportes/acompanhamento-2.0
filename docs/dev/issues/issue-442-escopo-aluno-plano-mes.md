# Issue #442 — escopo aluno+plano, curva pelo mês do dia

## Autorização

- [x] Marcio, 12/09/2026: *"abre o issue e toca"*
- [x] Gate Pré-Código liberado

## Causa

`MentorDashboard:208` montava a ficha com todos os trades do aluno, sem filtro de plano.
**8 de 20 alunos com plano têm mais de um.** O Joe Hott tem três mesas — uma arriscando 6% por
operação, outra 10%, outra 1,7%, em USD e BRL — e a ficha somava os 31 trades num número só.

Isso quebrava expectancy (R de planos diferentes não é a mesma unidade), drawdown (curva de contas
separadas que nunca existiu), payoff e profit factor (moedas somadas). Win rate era o único que
sobrevivia, por ser contagem.

A regra já existia do outro lado: o dashboard do aluno trava com *"Selecione um plano"* desde o #289.

## O que mudou

| onde | antes | depois |
|---|---|---|
| `mentorRiskRadar` | um retrato por aluno (plano do dia) | **um por plano com trade** (`visaoRapidaPorPlano`) |
| `TorreVisaoRapida` | lista de alunos | lista **aluno+plano**, chave composta |
| ficha: análise | todos os trades do aluno | `tradesDoPlano` |
| ficha: curva e Resultado | tudo | **plano + mês do dia selecionado** |
| ficha: seletor de plano | não existia | só quando o mês tem >1 plano (3 de 41) |
| abrir ficha | só aluno | leva o `planId` do retrato escolhido |

## Dois defeitos meus, achados no caminho

1. **TDZ.** Declarei `tradesDoPlano` depois de usá-lo em `diagnosticoAluno` — é o defeito do #421,
   que deu tela branca. Reordenado; a foto do harness confirmou o render.
2. **Fuso.** Passei `focusDate={mês}-01`, e `new Date('2026-09-01')` é UTC: em BRT volta para 31/08 e
   o calendário abria no mês anterior. Ancorado no dia 15, que nenhum fuso desloca.

## Item removido do escopo

O issue listava "dashboard do aluno: o calendário navega solto". **Não é defeito** — `StudentDashboard:745`
já passa `focusDate` do contexto, e `isoDateToRange` constrói Date local, sem o deslocamento que me
mordeu na ficha. O `TradingCalendar` sincroniza desde o #289. Afirmação minha, errada, retirada.

## Verificação

- 4.769 testes / 302 arquivos, mais 4 novos em `mentorRiskRadar.test.js` cobrindo um retrato por plano,
  isolamento de trades entre planos e o R de cada um contra o RO do próprio plano
- foto do harness: ficha renderiza, Resultado passa de 14 para 3 trades, curva e calendário concordam em Setembro

## Chunks

- CHUNK-16 (escrita) — Mentor Cockpit
