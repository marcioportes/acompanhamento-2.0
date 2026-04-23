# Issue #170 — SetupAnalysis V2: KPIs operacionais por setup

**Baseado na versão PROJECT.md:** 0.28.0  
**Branch:** `feature/issue-170-setup-analysis-v2`  
**Worktree:** `~/projects/issue-170`  
**Versão reservada:** v1.42.0  
**Milestone:** v1.2.0 — Mentor Cockpit  
**Modo:** Autônomo (degradado — scripts `cc-notify-email.py` / `cc-validate-task.py` ausentes; notificação manual)

---

## 1. Escopo (vindo do issue GitHub)

Substituir `SetupAnalysis.jsx` atual (barra proporcional + WR) por ferramenta de diagnóstico operacional que responda **"meu setup X está entregando o que promete?"**.

### E1 · Card de setup com 4 KPIs operacionais + sparkline
- Header: nome · N trades · PL total · WR
- Grid 2×2:
  - **Financial · EV por trade** = `totalPL / n`
  - **Financial · Payoff** = `avgWin / |avgLoss|` (fallback `—` quando insuficiente)
  - **Operational · ΔT W vs L** = `(tempoW − tempoL) / tempoL × 100%` — semáforo `>+20%` 🟢 / `-10%..+20%` 🟡 / `<-10%` 🔴 + tempos W/L em sub-linha
  - **Impact · Contribuição ao EV total** = `(n × EV_setup) / Σ(n × EV)` em %
- **Aderência RR** (sub-linha condicional): mostrar `X/N dentro da banda` com % e cor somente se `setups.targetRR` existir; omitida quando ausente (não fabrica dado)
- **Sparkline 6m**: PL acumulado do setup nos últimos 6 meses; reusa padrão da Matriz 4D (`EmotionAnalysis`)
- **Insight 1-linha**: reusa `buildInsight` (ofensor shift>40%, best performer payoff≥1.5, aderência RR<50%, fallback positivo)

### E2 · Ordenação e agrupamento por impacto
- Cards ordenados por `|contribEV|` desc
- Setups com `n < 3` agrupados em accordion "Esporádicos (N)" colapsado no rodapé
- Accordion expandido por default quando nenhum setup atinge `n ≥ 3`

### E3 · Util `analyzeBySetupV2` + testes
- Novo `src/utils/setupAnalysisV2.js` retornando por setup: `{ setup, n, totalPL, wr, ev, payoff, durationWin, durationLoss, deltaT, contribEV, adherenceRR, sparkline6m }`
- Aceita opcional `setupsMeta` (array de docs `setups` com `targetRR`); ausente → `adherenceRR = null`
- Zero campo Firestore novo
- 15-20 testes cobrindo cálculos puros + edges (n=1, só wins, só losses, sem `targetRR`, multi-moeda ignorada)

### E4 · Integração sem breaking change
- Substitui `SetupAnalysis.jsx` mantendo prop `trades` + nova prop opcional `setupsMeta`
- Consumo em `StudentDashboard` e `MentorDashboard` (ambos já importam)
- `DebugBadge component="SetupAnalysis"` mantido (INV-04)

## 2. Fora do Escopo
- Shift emocional por setup (join com `emotionMatrix4D`) → fase 2
- Aderência à checklist do setup (exige schema novo em `setups`) → fase 2
- Heatmap setup × emoção → fase 2
- Filtro drill-down por setup no resto do dashboard → decidir depois

## 3. Análise de Impacto

| Aspecto | Detalhe |
|---------|---------|
| Collections tocadas | **Leitura:** `trades`, `setups` (opcional). **Escrita:** zero |
| Cloud Functions | Nenhuma |
| Hooks/listeners | `useSetups` passa a ser consumido no `SetupAnalysis` via prop drilling |
| Side-effects (PL/compliance/emotional) | Zero |
| Blast radius | Baixo — componente isolado, API externa preservada |
| Rollback | `git revert` limpo |

### 3.1 Chunks necessários

| Chunk | Modo | Motivo |
|-------|------|--------|
| CHUNK-02 | escrita | `SetupAnalysis.jsx`, consumo em `StudentDashboard.jsx` |
| CHUNK-04 | leitura | `useTrades` para série 6m e cálculos |
| CHUNK-16 | leitura | `MentorDashboard` consumo (só passa `setupsMeta`) |

### 3.2 INV checklist
- ✅ INV-01/02 (zero escrita em `trades`/`plans`)
- ✅ INV-04 DebugBadge mantido
- ✅ INV-05 testes antes de UI (util + render)
- ✅ INV-10/15 zero estrutura Firestore nova
- ✅ INV-17 declarado (seção 3.3)
- ✅ INV-18 spec aprovada via issue body

### 3.3 Gate INV-17 — Arquitetura de Informação

| Nível | Domínio | Duplicação | Budget |
|-------|---------|------------|--------|
| seção (componente substituído) | Dashboard do Aluno | Nenhuma — evolui `SetupAnalysis` existente. Sparkline é o mesmo pattern da Matriz 4D (padrão unificado, não duplicação) | Net-zero (substitui) |

## 4. Ordem de implementação

1. **E3a** — Testes de `analyzeBySetupV2` (falhando)
2. **E3b** — Util `analyzeBySetupV2` (testes passam)
3. **E1a** — Testes render `SetupAnalysis` V2 (falhando)
4. **E1b** — UI `SetupAnalysis` V2 + extrair Sparkline reutilizável
5. **E2** — Ordenação + accordion esporádicos
6. **E4** — Wire `StudentDashboard` + `MentorDashboard` passando `setupsMeta` via `useSetups`
7. **Validação browser** — setup com muitos trades, esporádico, sem `targetRR`, perdedor com shift alto, multi-setup

## 5. Deltas de shared files (a aplicar no main no encerramento)

- `src/version.js` — promover 1.42.0 de RESERVADA para definitiva (remover tag `[RESERVADA — entrada definitiva no encerramento.]`)
- `docs/PROJECT.md` — entrada 0.29.0 Encerramento #170, liberar lock CHUNK-02, arquivar issue doc

**Nenhum outro shared file tocado.** `StudentDashboard.jsx` e `MentorDashboard.jsx` pertencem a CHUNK-02/16 e são editados dentro do worktree (não são shared files do Protocolo §4.1 — são arquivos do chunk com lock).

## 6. Log da sessão

### 22/04/2026 — Fase 3 §4.0 (Abertura no main)
- ✅ Bump PROJECT.md 0.27.0 → 0.28.0 + entrada de histórico
- ✅ Lock CHUNK-02 registrado em §6.3 para branch `feature/issue-170-setup-analysis-v2`
- ✅ v1.42.0 reservada em `src/version.js` (entrada CHANGELOG tagged [RESERVADA])
- ✅ Commit `3b69ea4b` no main: `docs: abertura #170 — lock CHUNK-02 + v1.42.0 reservada (SetupAnalysis V2)`
- ✅ Worktree criado em `~/projects/issue-170`
- ✅ Arquivo de controle criado

### 22/04/2026 — Implementação (modo autônomo)

**E3 · util `analyzeBySetupV2`** — commit `2bd11e82`
- `src/utils/setupAnalysisV2.js` (245 linhas)
- `src/__tests__/utils/setupAnalysisV2.test.js` (23 testes, 7 describes)
- Cobre: defensivo (null/undefined/array vazio/tipo inválido), agrupamento por setup com trim e fallback "Sem Setup", KPIs básicos (n/totalPL/wr/ev/payoff null quando falta wins ou losses), ΔT com derivação de entryTime/exitTime quando duration ausente, contribEV com denominador Σ|totalPL| preservando sinal, ordenação |contribEV| desc, flag `isSporadic` (n<3), aderência RR condicional (null sem setupsMeta, null sem targetRR, banda [target×0.8, target×1.2]), sparkline 6m (6 buckets mensais determinísticos via `today`, ignora trades fora da janela, 6 zeros para setup sem trades), edges (n=1, multi-moeda não particiona, result null/undefined vira 0).

**E1 + E2 · UI SetupAnalysis V2** — commit `52919bc7`
- `src/components/SetupAnalysis.jsx` (reescrito: 434 linhas, +349 vs V1)
- `src/__tests__/components/SetupAnalysisV2.test.jsx` (17 testes)
- Header com nome · N trades · PL total · WR
- Grid 2×2: Financial (EV + Payoff), Operational (ΔT com semáforo ±20%/±10% + tempos W/L brutos), Impact (ContribEV com sinal), Maturidade (Sparkline 6m + ícone Trend)
- Aderência RR condicional: linha só renderiza quando `setupsMeta[x].targetRR` existe. Cor: ≥70% verde, ≥40% âmbar, <40% vermelho
- Ordenação por `|contribEV|` desc; setups com n<3 em accordion "Esporádicos (N)" colapsado (expandido por default quando nenhum setup atinge n≥3)
- Insight 1-linha: ofensor contribEV<-20% → best performer payoff≥1.5 → aderência RR<50% → fallback positivo
- Sparkline local com mesmo visual do EmotionAnalysis (não extraído — duplicação intencional dentro do escopo do componente)
- DebugBadge `component="SetupAnalysis"` preservado (INV-04)

**E4 · Wire nos dashboards** — commit `e5239727`
- `StudentDashboard.jsx`: passa `setupsMeta={setups}` via `useSetups()` já presente (mudança de 1 linha)
- `MentorDashboard.jsx`: **não alterado** — `useSetups` não é consumido na página e os setups globais + pessoais mistos não têm filtro por `selectedStudent.uid`. Aderência RR fica omitida (condicional). Wire mentor-side proposto para fast-follow ou issue dedicada.

### Gate Pré-Entrega (INV-09 §4.2)

- ✅ `src/version.js` reservada para v1.42.0 (definitiva no encerramento)
- ✅ CHANGELOG de v1.42.0 escrito em version.js (tagged [RESERVADA])
- ✅ Testes para toda lógica nova: 23 util + 17 render = **40 novos testes**
- ✅ DebugBadge mantido em `SetupAnalysis` com `component="SetupAnalysis"`
- ✅ `npm test -- --run`: **1880/1880 passing** (baseline 1840 + 40)
- ✅ `npx eslint` nos arquivos tocados: zero errors, warnings pré-existentes não regressivos
- ✅ `npm run build`: verde em 14.74s
- ⏸️ **Validação browser pendente** (modo autônomo degradado — sem Marcio online). Cenários da spec a validar no merge:
  - Setup com muitos trades
  - Setup esporádico (accordion colapsado)
  - Setup sem `targetRR` (linha Aderência omitida)
  - Setup perdedor com shift alto (insight ofensor)
  - Multi-setup com diferentes impactos (ordenação por |contribEV|)

### CLAIMS (INV-27)

```
commit: e5239727 (tip)
chain: dcc8c59f → 2bd11e82 → 52919bc7 → e5239727
tests: 1880/1880 (baseline 1840 +40 novos)
files_added:
  - src/utils/setupAnalysisV2.js (245 linhas)
  - src/__tests__/utils/setupAnalysisV2.test.js (304 linhas, 23 testes)
  - src/__tests__/components/SetupAnalysisV2.test.jsx (180 linhas, 17 testes)
  - docs/dev/issues/issue-170-setup-analysis-v2.md
files_modified:
  - src/components/SetupAnalysis.jsx (reescrito: 349 linhas adicionadas)
  - src/pages/StudentDashboard.jsx (prop setupsMeta)
invariants:
  - INV-01/02: ✅ zero escrita em trades/plans
  - INV-04: ✅ DebugBadge component="SetupAnalysis"
  - INV-05: ✅ testes antes da UI (util E3 → UI E1/E2)
  - INV-10/15: ✅ zero estrutura Firestore nova
  - INV-17: ✅ declarado em §3.3
  - INV-18: ✅ spec aprovada via issue body (não há ambiguidade residual)
out_of_scope_untouched:
  - shift emocional por setup (fase 2)
  - aderência à checklist do setup (fase 2)
  - heatmap setup × emoção (fase 2)
  - filtro drill-down por setup no dashboard
  - wire MentorDashboard (setups não filtrados por aluno — fast-follow/issue nova)
```

### Próximo: PR + review do Marcio

## 7. CLAIMS por task (INV-27 universal)

Cada task entregue deve fornecer bloco CLAIMS estruturado para validação:

```
CLAIMS:
- commit: <sha>
- tests: <n passing>/<total>
- files_changed: [<path>, ...]
- invariants: [INV-04, INV-05, ...]
```

## 8. Origem

Spin-off do review #164. Durante validação browser, Marcio observou que o componente atual "só mostra agrupamento por setup" e pediu análise que vá além disso. Um setup é hipótese operacional (RR esperado, frequência ideal, tempo médio, contexto) — análise atual não responde se o setup entrega o que promete.
