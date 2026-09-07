# Issue #430 — fix: rescaldo do face lift

## Autorização

- [x] Mockup — dispensado: três correções sobre tela existente + um default de filtro. Nenhuma tela nova.
- [x] Memória de cálculo — dispensada: o item 1 não cria regra, **remove** uma regra duplicada (a de `App.jsx`) e passa a consumir a que já existe (`identifyStudentsNeedingAttention` + filtro de assinatura ativa do #402).
- [x] Marcio autorizou — 07/09/2026: *"Resolve os 3 agora, e também não gostei da seção acompanhamento... No Acompanhamento, quando abrir, cair direto no Alpha."*
- [x] Gate Pré-Código liberado

## Context

As três pendências que o #427/#428 deixou registradas no PROJECT.md sem issue, mais o Acompanhamento,
que abriu em `Todos` quando o trabalho do mentor é o track Alpha.

## Spec

Ver issue body: #430.

## Phases

- A — `Precisam Atenção`: menu e aba passam a ler a mesma fonte
- B — barra de abas do mentor deixa de esconder aba em 1024
- C — Acompanhamento abre no Alpha
- D — telas fora do roteiro entram no harness e são conferidas foto a foto
- E — divergência da linha da tabela do Acompanhamento (aguarda Marcio dizer o que o desenho tinha)

## Sessions

## Shared Deltas

- `src/App.jsx` — `studentsNeedingAttention` deixa de reimplementar a regra; consome o helper novo
- `src/version.js` — bump v1.90.1 (já reservado no main)
- `docs/registry/versions.md` — marcar 1.90.1 consumida
- `docs/registry/chunks.md` — liberar CHUNK-02/16
- `CHANGELOG.md` — entrada `[1.90.1]`

## Decisions

## Chunks

- CHUNK-16 (escrita) — MentorDashboard, barra de abas, contagem de atenção
- CHUNK-02 (escrita) — StudentsManagement
