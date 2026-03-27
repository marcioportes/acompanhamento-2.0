# reorganize-github-issues.ps1
# Renomeia issues, cria milestones e issues faltantes no GitHub
# Rodar da raiz do repo
# Pre-requisito: gh CLI autenticado (gh auth login)

Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

$ErrorActionPreference = "Continue"

function Invoke-Gh {
    param([string[]]$Args, [string]$Label)
    try {
        $result = & gh @Args
        Write-Host "  + $Label" -ForegroundColor Green
    } catch {
        Write-Host "  ERRO $Label : $_" -ForegroundColor Red
    }
}

Write-Host "=== Reorganizando issues do GitHub — Acompanhamento 2.0 ===" -ForegroundColor Cyan
Write-Host ""

# ─── 1. CRIAR MILESTONES ──────────────────────────────────────────────────────
Write-Host "[ 1/4 ] Criando milestones..." -ForegroundColor Yellow

Invoke-Gh @("api", "repos/:owner/:repo/milestones", "--method", "POST",
    "-f", "title=v1.1.0 — Student Experience",
    "-f", "description=Navegabilidade do aluno, equity curve por moeda + curva EV planejado, merge do assessment",
    "-f", "state=open") -Label "v1.1.0 — Student Experience"

Invoke-Gh @("api", "repos/:owner/:repo/milestones", "--method", "POST",
    "-f", "title=v1.2.0 — Mentor Cockpit",
    "-f", "description=Dashboard mentor consolidado, revisao semanal com KPIs congelados",
    "-f", "state=open") -Label "v1.2.0 — Mentor Cockpit"

Invoke-Gh @("api", "repos/:owner/:repo/milestones", "--method", "POST",
    "-f", "title=Backlog",
    "-f", "description=Issues sem milestone definido — priorizados futuramente",
    "-f", "state=open") -Label "Backlog"

# ─── 2. RENOMEAR ISSUES EXISTENTES ────────────────────────────────────────────
Write-Host ""
Write-Host "[ 2/4 ] Renomeando issues com prefixo padronizado..." -ForegroundColor Yellow

$renames = @(
    @{ N=94; T="feat: Controle de Assinaturas da Mentoria" },
    @{ N=93; T="feat: Order Import v1.1 — Modo Criacao (ordens->trades) + Confronto + Deduplicacao" },
    @{ N=92; T="feat: Student Onboarding e Assessment 4D — Fase A (CHUNK-09)" },
    @{ N=91; T="feat: Mentor editar feedback ja enviado" },
    @{ N=90; T="fix: Screen flicker durante ativacao de trades do CSV staging" },
    @{ N=89; T="fix: Aluno nao consegue deletar proprio plano (Firestore rules)" },
    @{ N=72; T="epic: Fechamento de Ciclo — Apuracao, Transicao e Realocacao" },
    @{ N=70; T="feat: Dashboard Mentor — Template na inclusao de Ticker" },
    @{ N=66; T="feat: Curva de Patrimonio — separada por moeda + curva EV planejado como benchmark" },
    @{ N=64; T="refactor: Dashboard Aluno — Refatorar tabela SWOT" },
    @{ N=56; T="fix: Dashboard Mentor — Sidebar Badge Connection" },
    @{ N=55; T="fix: DebugBadge duplo no ComplianceConfigPage embedded" },
    @{ N=52; T="epic: Gestao de Contas em Mesas Proprietarias (Prop Firms)" },
    @{ N=48; T="refactor: Student Emotional Detail — Reorganizar UX (Titulo, Calendario, Filtros)" },
    @{ N=45; T="refactor: Dashboard Mentor — Aba Precisam de Atencao" },
    @{ N=44; T="feat: Feedback Aluno — Indicador de Trades Revisados no Sidebar" },
    @{ N=31; T="feat: Dashboard Mentor — Preset de Feedback Semantico Automatico na Observacao" },
    @{ N=19; T="ops: Export/Import CSV do Firestore (backup + restore)" },
    @{ N=3;  T="epic: Aluno Dashboard V2 — Evolucao estrutural de logica e tracking" },
    @{ N=1;  T="refactor: Configuracoes — Substituir 3 botoes por Upload Seed" }
)

foreach ($item in $renames) {
    Invoke-Gh @("issue", "edit", "$($item.N)", "--title", $item.T) -Label "#$($item.N) $($item.T)"
}

# ─── 3. CRIAR ISSUES FALTANTES ────────────────────────────────────────────────
Write-Host ""
Write-Host "[ 3/4 ] Criando issues do backlog nao cadastrados..." -ForegroundColor Yellow

# debt: Node.js 20 — CRITICO
Invoke-Gh @("issue", "create",
    "--title", "debt: Node.js 20 -> 22 nas Cloud Functions (deadline 30/04/2026)",
    "--body", "Cloud Functions rodando Node.js 20, que depreca em 30/04/2026.`n`n## Solucao`n1. Alterar engines.node em functions/package.json para 22`n2. Upgrade firebase-functions de 4.9.0 para >=5.1.0`n3. Testar todas as CFs apos upgrade`n4. Deploy e validar em producao`n`nReferencia: DT-016 (PROJECT.md)",
    "--label", "type:architecture") -Label "debt: Node.js 20 -> 22 (CRITICO)"

# arch: Evolution Tracking
Invoke-Gh @("issue", "create",
    "--title", "arch: Evolution Tracking 4D — Reviews mensais, Gates de progressao, Timeline",
    "--body", "Fase B do CHUNK-09. Acompanhamento evolutivo pos-marco-zero.`n`n## Escopo`n- MonthlyReviewForm (3 camadas: score_trades + mentor_delta + score_final)`n- TraderEvolutionTimeline (Recharts)`n- ProgressionGateStatus`n- PromotionDecisionModal (PROMOTE/HOLD/OVERRIDE)`n- MentorJournalEntry + MentorJournalList`n- CFs: calculateMonthlyScores, evaluateProgression`n`nReferencias: SPEC-EVOLUTION-TRACKING.md, DEC-017 a DEC-020 (PROJECT.md)",
    "--label", "type:architecture") -Label "arch: Evolution Tracking 4D"

# feat: Revisao semanal
Invoke-Gh @("issue", "create",
    "--title", "feat: Revisao Semanal do Mentor — KPIs congelados + prep + link video + resumo IA",
    "--body", "Mentor precisa ir em varias telas desconectadas para preparar e conduzir a revisao semanal.`n`n## Comportamento esperado`n- Snapshot semanal de KPIs congelados para comparacao longitudinal`n- Campo de prep do mentor antes da reuniao`n- Link do video Zoom + resumo IA da discussao`n- Historico de revisoes anteriores acessivel`n`nMilestone: v1.2.0 — Mentor Cockpit",
    "--label", "type:feature") -Label "feat: Revisao Semanal do Mentor"

# feat: Dashboard mentor consolidado
Invoke-Gh @("issue", "create",
    "--title", "feat: Dashboard Mentor — Visao consolidada plano + meta + stop + KPIs por aluno",
    "--body", "Mentor precisa abrir multiplas telas para entender o estado atual de um aluno.`n`n## Comportamento esperado`n- Card de aluno com: plano ativo + ciclo + meta/stop + KPIs chave (WR, RR, Payoff, EV leakage)`n- Indicadores de compliance do periodo`n- Trades sem feedback pendentes`n- Link direto para revisao semanal`n`nMilestone: v1.2.0 — Mentor Cockpit",
    "--label", "type:feature") -Label "feat: Dashboard Mentor consolidado"

# arch: Behavioral Detection Engine
Invoke-Gh @("issue", "create",
    "--title", "arch: Behavioral Detection Engine — Motor de deteccao comportamental (CHUNK-11)",
    "--body", "Motor de deteccao comportamental em 4 camadas.`n`n## Camadas`n- Camada 1: Regras deterministicas (sem IA) — 21 regras catalogadas`n- Camada 2: Analise estatistica — Z-scores, anomalias`n- Camada 3: NLP sobre campo observacao (com IA)`n- Camada 4: Vision sobre screenshots (fase futura)`n`nReferencias: BEHAVIORAL-DETECTION-L1.md, CHUNK-11 (PROJECT.md secao 6.3)`nDependencia: aguarda CHUNK-10",
    "--label", "type:architecture") -Label "arch: Behavioral Detection Engine"

# fix: Templates CSV
Invoke-Gh @("issue", "create",
    "--title", "fix: Templates CSV vazam entre alunos (sem filtro por studentId)",
    "--body", "Templates CSV criados por um aluno ficam visiveis para todos. Adicionar filtro por studentId na query de templates.`n`nReferencia: DT-011 (PROJECT.md)",
    "--label", "type:bug") -Label "fix: Templates CSV vazam"

# debt: CF scheduled limpeza
Invoke-Gh @("issue", "create",
    "--title", "debt: CF scheduled — limpeza diaria csvStagingTrades (23h)",
    "--body", "Trades importados via CSV ficam na collection csvStagingTrades indefinidamente. Criar CF scheduled que deleta docs com createdAt < 24h.`n`nReferencia: DT-022 (PROJECT.md)",
    "--label", "type:architecture") -Label "debt: CF scheduled limpeza staging"

# ─── 4. INSTRUCOES PARA MILESTONES ────────────────────────────────────────────
Write-Host ""
Write-Host "[ 4/4 ] Atribuicao de milestones (fazer via GitHub UI)..." -ForegroundColor Yellow
Write-Host ""
Write-Host "  v1.1.0 — Student Experience:" -ForegroundColor Cyan
Write-Host "    #3  epic: Aluno Dashboard V2"
Write-Host "    #66 feat: Curva de Patrimonio"
Write-Host "    #64 refactor: SWOT"
Write-Host "    #90 fix: Screen flicker CSV"
Write-Host "    #89 fix: Aluno deletar plano"
Write-Host "    #92 feat: Student Onboarding (fechar apos merge do PR)"
Write-Host ""
Write-Host "  v1.2.0 — Mentor Cockpit:" -ForegroundColor Cyan
Write-Host "    #45 refactor: Aba Precisam de Atencao"
Write-Host "    #31 feat: Preset Feedback Semantico"
Write-Host "    #70 feat: Template Ticker"
Write-Host "    #56 fix: Sidebar Badge"
Write-Host "    Novos: Dashboard Mentor consolidado, Revisao Semanal"
Write-Host ""
Write-Host "  Backlog:" -ForegroundColor Cyan
Write-Host "    Todos os demais"
Write-Host ""
Write-Host "=== Concluido ===" -ForegroundColor Green
