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
- ✅ Arquivo de controle criado (este)

### Próximo: E3a (testes analyzeBySetupV2 falhando)

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
