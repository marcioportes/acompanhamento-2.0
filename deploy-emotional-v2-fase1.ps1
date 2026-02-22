# deploy-emotional-v2-fase1.ps1
# Fase 1.3.1: Fundacao do Sistema Emocional v2.0
# Executar na raiz do projeto: .\deploy-emotional-v2-fase1.ps1

Set-Location "C:\000-Marcio\Journal\acompanhamento-2.0\acompanhamento-2.0"

# Garantir que estamos em main atualizada
git checkout main
git pull origin main

# Criar branch
git checkout -b feature/emotional-system-v2

# Os arquivos ja devem ter sido extraidos do ZIP:
# - scripts/migrate-emotions.js
# - src/utils/emotionalAnalysisV2.js
# - src/hooks/useEmotionalProfile.js
# (useMasterData.js NAO muda - ja esta em producao como v4.0)

# Stage
git add -A

# Commit
git commit -m "feat(v1.7.0): Sistema Emocional v2 - Fase 1.3.1 Fundacao"

# Push
git push origin feature/emotional-system-v2

# PR
gh pr create --base main --head feature/emotional-system-v2 --title "feat(v1.7.0): Sistema Emocional v2 - Fase 1.3.1 Fundacao" --body @"
## Sistema Emocional v2.0 - Fase 1.3.1

### Arquivos novos
- ``scripts/migrate-emotions.js`` - Migracao Firestore (14 emocoes + 6 campos novos)
- ``src/utils/emotionalAnalysisV2.js`` - Engine de analise emocional V2 (Firestore-based)
- ``src/hooks/useEmotionalProfile.js`` - Hook para perfil emocional do aluno

### O que a engine V2 faz
- Score emocional por trade (entrada 60% + saida 40% + bonus/penalidade)
- Score do periodo normalizado 0-100
- Deteccao de TILT (trades consecutivos com emocao negativa)
- Deteccao de REVENGE (sequencia rapida apos loss, aumento de qty, emocao explicita)
- Deteccao de OVERTRADING (limite diario configuravel)
- Correlacao compliance financeiro + emocional
- Status do aluno (HEALTHY/ATTENTION/WARNING/CRITICAL)
- Scores diarios para graficos de evolucao
- Tendencia emocional (IMPROVING/STABLE/WORSENING)

### Compatibilidade
- V1 (emotionalAnalysis.js) permanece intocado
- useMasterData.js ja tem helpers v2 em producao (v4.0)
- Nenhum componente de UI consome V2 ainda - sera feito nas fases seguintes
- Zero breaking changes

### Pre-requisito pos-merge
Executar migracao do Firestore:
``node scripts/migrate-emotions.js`` (dry-run)
``node scripts/migrate-emotions.js --apply`` (aplicar)

### Roadmap
- [x] Fase 1.3.1: Fundacao (esta PR)
- [ ] Fase 1.3.2: ComplianceRules + ComplianceConfigPage
- [ ] Fase 1.4.0: Perfil Emocional persistido + notificacoes
- [ ] Fase 1.5.0: UI completa (Ledger extract, alertas mentor)
"@

Write-Host ""
Write-Host "PR criado! Faca merge no GitHub." -ForegroundColor Green
Write-Host ""
Write-Host "APOS MERGE, execute a migracao do Firestore:" -ForegroundColor Yellow
Write-Host "  node scripts/migrate-emotions.js          # dry-run" -ForegroundColor Cyan
Write-Host "  node scripts/migrate-emotions.js --apply  # aplicar" -ForegroundColor Cyan
Write-Host ""
Write-Host "APOS migracao, tag:" -ForegroundColor Yellow
Write-Host "  git checkout main; git pull; git tag -a v1.7.0 -m 'v1.7.0: Sistema Emocional v2 - Fase 1.3.1'; git push origin v1.7.0" -ForegroundColor Cyan
