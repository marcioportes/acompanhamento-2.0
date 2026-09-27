# Issue 477 — fix: detector comportamental crava medo

> **Branch:** `fix/issue-477-emocao-hipotese`
> **Aberto em:** 27/09/2026
> **Status:** 🔵 Em andamento
> **Versão reservada:** 1.92.14

## Autorização

- [x] Mockup: 24/09 depois (abaixo)
- [x] Memória de cálculo: regras abaixo
- [x] Marcio autorizou em 27/09/2026:
  - hesitação só conta tentativa de entrada: *"1) ok"*;
  - montagem de posição vira aviso sem emoção: *"prefiro que venha um warning: houve montagem de posição com médio para trás, ou frente — eu decido com o aluno"*;
  - confronto emocional como hipótese: *"3) ok"*
- [x] Gate Pré-Código liberado

## Mockup — 24/09

- **Faixa verde:** "Você declarou 'Disciplinado' e a execução confirma — stop enviado junto com a entrada, e cada adição com proteção própria."
- **Card neutro:** "ℹ Montagem de posição — Houve montagem de posição com preço médio para trás — 1 adição contra a posição, com proteção própria."
- Sem hesitação e sem medo.

## Regras

- **Hesitação:** só conta a ordem que cumpre tudo isto:
  - lado da entrada;
  - cancelada sem executar;
  - cancelada até 30 min antes da entrada (mesmo corte do #369);
  - preço a até a distância do stop, ou 0,25% da entrada, o que for maior.

  Cancelar e reenviar em até 30 s, com quantidade ou preço corrigidos, é **ajuste** e não conta.
- **Montagem de posição:** `POSITION_BUILD_AGAINST` e `POSITION_BUILD_FAVOR` substituem `AVERAGING_DOWN`. Sem emoção, sem gravidade, sem score e sem gate, não entram no confronto e não impedem a "Execução limpa". Perfis antigos com `AVERAGING_DOWN` são lidos como aviso "para trás".
- **Confronto emocional:**
  - só existe com padrão negativo, com emoção, de gravidade média ou alta;
  - o texto é uma hipótese acompanhada da evidência;
  - novo veredito `CONFIRMED`, para quando a declaração positiva é confirmada pela execução.

## Sessions

- `task 01 [abertura] commit b5d88e4f ok`
- `task 02 [regras 1-3] ok`
- `task 03 [revisão] aviso neutro não impede a execução limpa`

## Shared Deltas

- `src/version.js`, `docs/registry/*`: v1.92.14; liberar o CHUNK-06
- `CHANGELOG.md`, `docs/PROJECT.md`, `docs/decisions.md` (DEC-477-01..03)

## Decisions

- DEC-477-01 — hesitação só conta tentativa de entrada; reenvio com ajuste não conta
- DEC-477-02 — montagem de posição é aviso neutro para o mentor decidir com o aluno
- DEC-477-03 — confronto emocional é hipótese com evidência; gravidade baixa não confronta

## Chunks

- CHUNK-06 (escrita); CHUNK-10 (leitura)
