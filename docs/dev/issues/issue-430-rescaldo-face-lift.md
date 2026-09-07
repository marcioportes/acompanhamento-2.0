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
- E — divergência da linha da tabela do Acompanhamento — **resolvida**: era a régua sob cada aluno (`divide-y`), mais a etiqueta caindo para baixo do nome. Não existia mockup: #427/#428 rodaram sem documento de controle e sem desenho, e a referência acabou sendo a foto do antes (`Temp/espelho-antes-427`).

## Sessions

- `fix 78e7b521` — fonte única da contagem, abas que quebram linha, Acompanhamento no Alpha, 6 telas novas no harness, PageHeader em Configurações/Mesa Prop
- `fix 4affee3e` — harness responde `getInviteStatusBatch`; a foto do Acompanhamento mostrava 12 candidatos de 12
- `fix dcffb429` — tabela sem régua por linha (fundo alternado); nome e etiqueta na mesma linha

## Shared Deltas

- `src/App.jsx` — `studentsNeedingAttention` deixa de reimplementar a regra; consome o helper novo
- `src/version.js` — bump v1.90.1 (já reservado no main)
- `docs/registry/versions.md` — marcar 1.90.1 consumida
- `docs/registry/chunks.md` — liberar CHUNK-02/16
- `CHANGELOG.md` — entrada `[1.90.1]`

## Decisions

- DEC-430-01 — contagem de "precisa de atenção" tem fonte única (`studentsAttention.js`); superfície que precisa do número importa, não reimplementa
- DEC-430-02 — barra de abas quebra linha, nunca rola: aba escondida com contagem é pendência que, para o mentor, não existe
- DEC-430-03 — Acompanhamento abre no Alpha; `Todos` é exceção a um clique
- DEC-430-04 — callable de LEITURA que uma tela dispara ao montar é respondida pelo harness com dado plausível; sem isso a foto mente sobre o estado que decide a linha
- DEC-430-05 — tabela longa separa linha por fundo alternado, não por régua; uma régua por linha desenha a grade e não o conteúdo

## Chunks

- CHUNK-16 (escrita) — MentorDashboard, barra de abas, contagem de atenção
- CHUNK-02 (escrita) — StudentsManagement
