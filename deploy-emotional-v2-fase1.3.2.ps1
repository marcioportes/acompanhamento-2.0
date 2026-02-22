# deploy-emotional-v2-fase1.3.2.ps1
Set-Location "C:\000-Marcio\Journal\acompanhamento-2.0\acompanhamento-2.0"

git checkout feature/emotional-system-v2
git add -A
git commit -m "feat(v1.7.0): Sistema Emocional v2 - Fase 1.3.2 Compliance Config

Novos arquivos:
- useComplianceRules.js: hook CRUD mentorConfig/{mentorId} (Firestore)
- ComplianceConfigPage.jsx: UI config TILT/REVENGE/Overtrading/Status/Notificacoes

Modificados:
- SettingsPage.jsx: tab Compliance adicionada, import ComplianceConfigPage, DebugBadge
- version.js: bump para v1.7.0

Compliance config:
- Listener realtime no Firestore (merge com defaults)
- Save parcial (merge), reset para defaults
- detectionConfig exportado pronto para analyzeEmotionsV2()
- 5 secoes: TILT, REVENGE, Overtrading, Status thresholds, Notificacoes
- Toggles, number inputs, status bars com emojis
- embedded=true para render dentro do SettingsPage
- DebugBadge em ComplianceConfigPage e SettingsPage"

git push origin feature/emotional-system-v2

gh pr create --base main --head feature/emotional-system-v2 --title "feat(v1.7.0): Sistema Emocional v2 - Fases 1.3.1 + 1.3.2" --body @"
## Sistema Emocional v2.0 - Fases 1.3.1 + 1.3.2

### Fase 1.3.1: Fundacao
- ``scripts/migrate-emotions.js`` - Migracao Firestore (14 emocoes + 6 campos)
- ``src/utils/emotionalAnalysisV2.js`` - Engine V2 (score, TILT, REVENGE, overtrading)
- ``src/hooks/useEmotionalProfile.js`` - Hook perfil emocional

### Fase 1.3.2: Compliance Config
- ``src/hooks/useComplianceRules.js`` - CRUD mentorConfig no Firestore
- ``src/pages/ComplianceConfigPage.jsx`` - UI de configuracao (embedded no SettingsPage)
- ``src/pages/SettingsPage.jsx`` - Tab Compliance adicionada + DebugBadge
- ``src/version.js`` - v1.7.0

### DebugBadge
- ComplianceConfigPage: adicionado
- SettingsPage: adicionado

### SemVer
v1.6.0 -> v1.7.0 (MINOR: novas features, zero breaking changes)

### Pre-requisito pos-merge
``node scripts/migrate-emotions.js --apply``

### Roadmap
- [x] Fase 1.3.1: Fundacao (engine + hooks)
- [x] Fase 1.3.2: Compliance Config
- [ ] Fase 1.4.0: Perfil Emocional persistido
- [ ] Fase 1.5.0: UI completa (Ledger, alertas)
"@

Write-Host ""
Write-Host "PR criado! Merge no GitHub, depois:" -ForegroundColor Green
Write-Host "  git checkout main; git pull; git tag -a v1.7.0 -m 'v1.7.0'; git push origin v1.7.0" -ForegroundColor Cyan
