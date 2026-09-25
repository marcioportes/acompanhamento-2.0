# Issue 463 — test: harness do import de ordens contra o relatório da corretora

> **Branch:** `test/issue-463-harness-import-vs-corretora`
> **Aberto em:** 25/09/2026
> **Status:** 🔵 Em andamento
> **Versão reservada:** 1.92.7
> **Épico:** #462 (Fase 0: gate das Fases 1–5)

## Autorização

- [x] Mockup: **não se aplica** (só teste, sem UI)
- [x] Memória de cálculo: o critério de stop defensável está no plano do épico #462 e em `violacoesDoStop`
- [x] Marcio autorizou em 25/09/2026, com a aprovação do plano do épico, incluindo as decisões *"soma do risco das pernas"* e *"recalcular os não discutidos"*
- [x] Gate Pré-Código liberado

## Context

O import de ordens é corrigido sintoma a sintoma desde o #156, sem um teste que o compare com a corretora. Esta fase monta esse teste. Ele usa 8 dias reais do Marcio, com 105 operações. O que hoje falha fica registrado com a fase que o corrige, e essa lista só pode encolher.

## Spec

Ver o issue #463 e o épico #462.

## Phases

- A1 — `src/__tests__/helpers/brokerReplay.js`: faz o replay pelo mesmo caminho do `OrderImportPage`, tanto o direto quanto a retomada do staging. Também tem o leitor do relatório de performance e `violacoesDoStop`.
- A2 — Fixtures em `src/__tests__/fixtures/broker-replay/`: 8 pares ordens × performance, arquivos originais em latin-1.
- A3 — `orderImportVsBroker.test.js`, com três perguntas por operação (corretora, stop, retomada) e o stop anotado à mão nos dias curtos.
- A4 — `orderImportVsBroker.known.js`: as falhas atuais, marcadas com a fase que as corrige. Rodam como `it.fails`.
- A5 — Pares de aluno ficam fora do repo e rodam com `ORDER_REPLAY_ALUNOS=<pasta>`.

## Sessions

- `task 01 [abertura] commit 09b91172 ok`
- `task 02 [A1-A5] ok — 345 casos verdes em UTC e em BRT; suíte 5.249/309 em UTC; build ok. Prova de que o teste pega regressão: tirar 1 falha conhecida → 2 reprovam; zerar o stopLoss no pipeline → 67 reprovam.`

## Retrato do main (v1.92.5)

- **Corretora:** 104 de 105 operações conferem. A exceção é 11/09 16:17, preço do 1º fill (F2 #465).
- **Stop:** 53 operações gravam stop indefensável. Os motivos: zeragem ou inversão, fora da janela da perna, cancelada antes da entrada, outro ativo, mesmo lado da entrada, não adversa à perna. Tudo isso é corrigido na F3 #466.
- **Retomada:** 2 operações dão stop diferente do import direto (03/09 16:57 e 24/09), corrigido na F3 #466.
- **Operação aberta:** grava `entryTime` em `Z`, corrigido na F1 #464.
- **Não coberto pelo critério:** a folga do limite do bracket, quando ele é exportado como LIMITE sem Preço Stop, infla o risco (achado B1 da investigação). O gatilho não existe no arquivo; isso fica para a F3.

## Shared Deltas

- `src/version.js`: consumir a reserva da v1.92.7
- `docs/registry/versions.md`: marcar a 1.92.7 como consumida
- `docs/registry/chunks.md`: liberar o CHUNK-10
- `CHANGELOG.md`: entrada `[1.92.7]`
- `docs/PROJECT.md`: encerramento

## Decisions

- DEC-463-01: stop anotado à mão só nos dias curtos (20/04, 04/05, 23/09 e 24/09). Os demais usam o critério geral `violacoesDoStop`.

## Chunks

- CHUNK-10 (escrita): só testes e fixtures
