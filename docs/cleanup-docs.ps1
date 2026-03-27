# cleanup-docs.ps1
# Reorganiza estrutura de docs/ do projeto Acompanhamento 2.0
# Rodar da raiz do repo: C:\000-Marcio\Journal\acompanhamento-2.0\acompanhamento-2.0\

Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

$ErrorActionPreference = "Continue"

Write-Host "=== Limpeza e reorganizacao de docs/ ===" -ForegroundColor Cyan
Write-Host ""

# ─── 1. CRIAR PASTAS ──────────────────────────────────────────────────────────
Write-Host "[ 1/5 ] Criando estrutura de pastas..." -ForegroundColor Yellow

foreach ($dir in @(
    "docs\archive\sprint-behavioral",
    "docs\dev\issues",
    "docs\ops"
)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    Write-Host "  + $dir"
}

# ─── 2. ARQUIVAR — raiz de docs/ ──────────────────────────────────────────────
Write-Host ""
Write-Host "[ 2/5 ] Arquivando documentos obsoletos da raiz de docs/..." -ForegroundColor Yellow

$rootToArchive = @(
    "docs\ARCHITECTURE.md",
    "docs\AVOID-SESSION-FAILURES.md",
    "docs\VERSIONING.md",
    "docs\CHANGELOG.md",
    "docs\HOTFIX-PARTIALS-DOC-UPDATES.md",
    "docs\MERGE-INSTRUCTIONS-onboarding.md",
    "docs\MERGE-INSTRUCTIONS-order-import.md",
    "docs\README-EXECUTION-GUIDE.md"
)

foreach ($file in $rootToArchive) {
    if (Test-Path $file) {
        $dest = "docs\archive\" + (Split-Path $file -Leaf)
        try {
            Move-Item -Path $file -Destination $dest -Force
            Write-Host "  -> $file  =>  archive/"
        } catch {
            Write-Host "  ERRO ao mover $file : $_" -ForegroundColor Red
        }
    } else {
        Write-Host "  (nao encontrado, pulando) $file"
    }
}

# CONTINUITY files
Get-ChildItem -Path "docs" -Filter "CONTINUITY-session-*.md" -ErrorAction SilentlyContinue | ForEach-Object {
    try {
        Move-Item -Path $_.FullName -Destination "docs\archive\$($_.Name)" -Force
        Write-Host "  -> $($_.Name)  =>  archive/"
    } catch {
        Write-Host "  ERRO ao mover $($_.Name) : $_" -ForegroundColor Red
    }
}

# ─── 3. ARQUIVAR — docs/dev/ ──────────────────────────────────────────────────
Write-Host ""
Write-Host "[ 3/5 ] Arquivando documentos obsoletos de docs/dev/..." -ForegroundColor Yellow

if (Test-Path "docs\dev\PROMPT_CONTINUIDADE.md") {
    try {
        Move-Item -Path "docs\dev\PROMPT_CONTINUIDADE.md" -Destination "docs\archive\PROMPT_CONTINUIDADE.md" -Force
        Write-Host "  -> PROMPT_CONTINUIDADE.md  =>  archive/"
    } catch {
        Write-Host "  ERRO: $_" -ForegroundColor Red
    }
}

foreach ($file in @(
    "docs\dev\issues\GITHUB-ISSUES-ALTA.md",
    "docs\dev\issues\ISSUE-71-epic.md",
    "docs\dev\issues\ISSUE-73-epico.md",
    "docs\dev\issues\ISSUE-78-epic.md",
    "docs\dev\issues\github-issues-completo.md"
)) {
    if (Test-Path $file) {
        $name = Split-Path $file -Leaf
        try {
            Move-Item -Path $file -Destination "docs\archive\$name" -Force
            Write-Host "  -> $name  =>  archive/"
        } catch {
            Write-Host "  ERRO ao mover $name : $_" -ForegroundColor Red
        }
    }
}

# ─── 4. REORGANIZAR sprint-behavioral/ ────────────────────────────────────────
Write-Host ""
Write-Host "[ 4/5 ] Reorganizando sprint-behavioral/..." -ForegroundColor Yellow

foreach ($file in @(
    "docs\sprint-behavioral\BRIEF-STUDENT-ONBOARDING-v2.md",
    "docs\sprint-behavioral\BRIEF-STUDENT-ONBOARDING-v3.md",
    "docs\sprint-behavioral\BRIEF-ORDER-IMPORT-v2.md",
    "docs\sprint-behavioral\PROMPT-SESSAO-A-ONBOARDING-v2.md",
    "docs\sprint-behavioral\SESSION-BEHAVIORAL-ENGINE-20260317.md",
    "docs\sprint-behavioral\CHUNK-REGISTRY.md"
)) {
    if (Test-Path $file) {
        $name = Split-Path $file -Leaf
        try {
            Move-Item -Path $file -Destination "docs\archive\sprint-behavioral\$name" -Force
            Write-Host "  -> $name  =>  archive/sprint-behavioral/"
        } catch {
            Write-Host "  ERRO ao mover $name : $_" -ForegroundColor Red
        }
    }
}

foreach ($file in @(
    "docs\sprint-behavioral\trader_evolution_framework.md",
    "docs\sprint-behavioral\SPEC-EVOLUTION-TRACKING.md",
    "docs\sprint-behavioral\BEHAVIORAL-DETECTION-L1.md",
    "docs\sprint-behavioral\BRIEF-EVOLUTION-TRACKING-FASEB.md"
)) {
    if (Test-Path $file) {
        $name = Split-Path $file -Leaf
        try {
            Move-Item -Path $file -Destination "docs\dev\$name" -Force
            Write-Host "  -> $name  =>  dev/ (referencia ativa)"
        } catch {
            Write-Host "  ERRO ao mover $name : $_" -ForegroundColor Red
        }
    }
}

if (Test-Path "docs\sprint-behavioral") {
    $remaining = Get-ChildItem "docs\sprint-behavioral" -ErrorAction SilentlyContinue
    if ($null -eq $remaining -or $remaining.Count -eq 0) {
        try {
            Remove-Item "docs\sprint-behavioral" -Force
            Write-Host "  -> docs/sprint-behavioral/ removida (vazia)"
        } catch {
            Write-Host "  ERRO ao remover pasta: $_" -ForegroundColor Red
        }
    } else {
        Write-Host "  ATENCAO: docs/sprint-behavioral/ ainda tem arquivos:" -ForegroundColor Yellow
        $remaining | ForEach-Object { Write-Host "    - $($_.Name)" }
    }
}

# ─── 5. ATUALIZAR .gitignore ───────────────────────────────────────────────────
Write-Host ""
Write-Host "[ 5/5 ] Atualizando .gitignore..." -ForegroundColor Yellow

$addition = "`n# Arquivos temporarios de functions`nfunctions/diff_index.txt"
try {
    Add-Content -Path ".gitignore" -Value $addition -Encoding UTF8
    Write-Host "  + functions/diff_index.txt adicionado"
} catch {
    Write-Host "  ERRO ao atualizar .gitignore: $_" -ForegroundColor Red
}

# ─── RESULTADO ────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=== Estrutura final de docs/ ===" -ForegroundColor Cyan

Get-ChildItem -Path "docs" -Recurse -ErrorAction SilentlyContinue |
    Where-Object { -not $_.PSIsContainer -and $_.Extension -ne ".png" } |
    ForEach-Object {
        $_.FullName.Replace((Get-Location).Path + "\", "")
    } | Sort-Object | ForEach-Object { Write-Host "  $_" }

Write-Host ""
Write-Host "=== Proximos passos ===" -ForegroundColor Cyan
Write-Host "  1. Verificar estrutura acima"
Write-Host "  2. git add docs/ .gitignore"
Write-Host "  3. git commit -m `"chore: reorganizar docs/ — PROJECT.md, archive, cleanup`""
Write-Host "  4. git push origin feature/student-onboarding"
Write-Host "  5. Rodar reorganize-github-issues.ps1"
