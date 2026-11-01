# Issue #495 — fix: trade que entregou o alvo do plano é acusado de subdimensionado e trava estágio

## Autorização

- [x] Mockup: exceção — card existente; só sai ou troca a frase (apresentado em texto em 01/11/2026)
- [x] Memória de cálculo apresentada (abaixo)
- [x] Marcio autorizou (01/11/2026, "abre" à proposta de abrir e levar até produção com a regra)
- [x] Gate Pré-Código liberado

## Context

MNQ 01/11/2026: RO US$ 200, RR 2:1, risco US$ 112, +US$ 402,50. O card diz "alvo não atingido", "menos de um stop cheio" e trava estágio. O detector só compara com o RR local e o texto fixo veio do caso de 0,96R da #278.

## Spec

Ver issue body no GitHub: #495.

## Memória de Cálculo

- **Inputs:** `trade.result`, `trade.riskPercent`; do plano `riskPerOperation`, `pl ?? currentPl`, `rrTarget ?? 2`. Na leitura: `family.evidence.actualGain` e `expectedGainAtPlanRR`.
- **Fórmula:** alvo = PL × RO% × RR. `result >= alvo` → não é subdimensionamento (sem tolerância). `result >= PL × RO%` e abaixo do alvo → padrão fica, texto "cobre um stop cheio". Abaixo de 1 RO → texto do #278.
- **Casos limites:** sem PL → sem alvo em dinheiro, flag continua, sem afirmar alvo. Perfil anterior ao #278 sem os campos → continua. Loss → inalterado. Trade discutido → não regravado; filtro na leitura.
- **Exemplos:** US$ 402,50 → não dispara. US$ 400 → não dispara. US$ 399 → dispara. US$ 224 → 1,12R, "cobre um stop cheio". US$ 120 / RO 125 → 0,96R, denúncia mantida.

## Phases

- A1 — detector (cliente + CF), `familiaVigente` (taxonomia + espelho)
- A2 — leitura: painel, confronto, pesos de maturidade (cliente + CF), radar, veredicto da revisão
- A3 — texto do card; testes

## Shared Deltas

- `src/version.js` — v1.92.23 (encerramento)
- `docs/registry/versions.md` — marcar v1.92.23 consumida
- `docs/registry/chunks.md` — liberar CHUNK-11
- `CHANGELOG.md` — entrada `[1.92.23]`
- `docs/PROJECT.md` — header + DEC-495-01
- `docs/decisions.md` — DEC-495-01: alvo do plano entregue (resultado ≥ RO × RR) não é subdimensionamento; `familiaVigente` aplica a regra na leitura de perfis gravados
- `docs/dev/behavioral-weight-map.md` — sem mudança de peso

## Decisions

- DEC-495-01

## Chunks

- CHUNK-11 (escrita) — detector e exibição do padrão
