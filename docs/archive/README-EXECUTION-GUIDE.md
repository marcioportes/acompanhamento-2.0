# README — Guia Operacional de Execução
## Acompanhamento 2.0 — Sprint de Março/2026
### Versão 1.0 — 18/03/2026

---

## 1. VISÃO GERAL

Este documento é o seu guia passo-a-passo para executar as frentes paralelas de desenvolvimento. Siga na ordem — cada passo depende do anterior.

**Frentes planejadas:**
- **Frente A:** Student Onboarding & Baseline (CHUNK-09)
- **Frente B:** Order Import Pipeline (CHUNK-10)
- **Futuro:** Behavioral Detection (CHUNK-11) + Cycle Alerts (CHUNK-12)

**Princípio:** Nenhuma sessão de Claude toca código sem o mecanismo de controle estar no repositório primeiro.

---

## 2. SEQUÊNCIA DE EXECUÇÃO

```
FASE 0 — Preparação (você sozinho, sem sessão paralela)
  │
  ├─ Passo 1: Commit dos docs de controle no repo
  ├─ Passo 2: Criar branches
  ├─ Passo 3: Validar que main está limpo
  │
FASE 1 — Disparo das frentes paralelas (2 sessões Claude)
  │
  ├─ Passo 4: Abrir Sessão A (Onboarding)
  ├─ Passo 5: Abrir Sessão B (Order Import)
  ├─ Passo 6: Aguardar entrega de ambas
  │
FASE 2 — Integração (você sozinho)
  │
  ├─ Passo 7: Merge Frente A
  ├─ Passo 8: Merge Frente B
  ├─ Passo 9: Consolidar shared files
  ├─ Passo 10: Testes + deploy
  │
FASE 3 — Próximas frentes
  │
  ├─ Passo 11: Atualizar CHUNK-REGISTRY
  └─ Passo 12: Disparar CHUNK-11 e/ou CHUNK-12
```

---

## 3. FASE 0 — PREPARAÇÃO

### Passo 1: Commit dos documentos de controle

Antes de qualquer sessão paralela, os documentos de governança precisam estar no repo. Isso garante que qualquer sessão futura que receba o ARCHITECTURE.md também tenha visibilidade do sistema de chunks.

```powershell
# Navegue até o projeto
cd C:\000-Marcio\Journal\acompanhamento-2.0\acompanhamento-2.0

# Crie o diretório se não existir
New-Item -ItemType Directory -Path "docs\sprint-behavioral" -Force

# Copie os 5 documentos para o diretório
# (ajuste o path de origem conforme onde você salvou os downloads)
Copy-Item "Downloads\CHUNK-REGISTRY.md" "docs\sprint-behavioral\"
Copy-Item "Downloads\SESSION-BEHAVIORAL-ENGINE-20260317.md" "docs\sprint-behavioral\"
Copy-Item "Downloads\BEHAVIORAL-DETECTION-L1.md" "docs\sprint-behavioral\"
Copy-Item "Downloads\BRIEF-STUDENT-ONBOARDING-v2.md" "docs\sprint-behavioral\"
Copy-Item "Downloads\BRIEF-ORDER-IMPORT-v2.md" "docs\sprint-behavioral\"

# Commit
git add docs/sprint-behavioral/
git commit -m "docs: add sprint behavioral engine planning docs - CHUNK-REGISTRY, briefings, detection L1 design"
git push origin main
```

### Passo 2: Criar as branches

```powershell
# Branch para Frente A
git checkout main
git pull origin main
git checkout -b feature/student-onboarding

# Volte para main e crie branch para Frente B
git checkout main
git checkout -b feature/order-import

# Volte para main (estado limpo)
git checkout main
```

### Passo 3: Validar estado limpo

```powershell
# Confirme que main está limpo
git status
# Deve mostrar "nothing to commit, working tree clean"

# Confirme que as branches existem
git branch
# Deve listar: main, feature/student-onboarding, feature/order-import

# Rode os testes existentes para garantir baseline
npm test
```

### Passo 3.1: Atualizar CHUNK-REGISTRY

Abra `docs/sprint-behavioral/CHUNK-REGISTRY.md` e atualize a tabela de locks:

```markdown
| Chunk | Status | Branch | Sessão | Check-out | Notas |
|-------|--------|--------|--------|-----------|-------|
| CHUNK-09 | `LOCKED` | feature/student-onboarding | Sessão A | DD/MM/YYYY | Onboarding |
| CHUNK-10 | `LOCKED` | feature/order-import | Sessão B | DD/MM/YYYY | Orders |
```

Commit:

```powershell
git add docs/sprint-behavioral/CHUNK-REGISTRY.md
git commit -m "docs: lock CHUNK-09 and CHUNK-10 for parallel sessions"
git push origin main
```

---

## 4. FASE 1 — DISPARO DAS SESSÕES

### Passo 4: Abrir Sessão A — Student Onboarding

Abra uma nova conversa Claude Opus. Cole na primeira mensagem:

```
Você é um desenvolvedor trabalhando no Acompanhamento 2.0. 
Leia os documentos anexados e siga o briefing à risca.

Documentos obrigatórios:
1. ARCHITECTURE.md (estado atual do projeto)
2. CHUNK-REGISTRY.md (sistema de controle de concorrência)
3. BRIEF-STUDENT-ONBOARDING-v2.md (seu escopo de trabalho)
4. trader_evolution_framework.md (referência de domínio)

Você está fazendo check-out do CHUNK-09.
Branch: feature/student-onboarding
NÃO toque em nenhum arquivo fora do escopo listado no briefing.
Produza MERGE-INSTRUCTIONS para arquivos compartilhados.

Comece com a análise de impacto conforme o gate obrigatório.
```

**Anexar os 4 arquivos** como uploads.

### Passo 5: Abrir Sessão B — Order Import

Abra **outra** conversa Claude Opus (separada). Cole:

```
Você é um desenvolvedor trabalhando no Acompanhamento 2.0.
Leia os documentos anexados e siga o briefing à risca.

Documentos obrigatórios:
1. ARCHITECTURE.md (estado atual do projeto)
2. CHUNK-REGISTRY.md (sistema de controle de concorrência)
3. BRIEF-ORDER-IMPORT-v2.md (seu escopo de trabalho)

Você está fazendo check-out do CHUNK-10.
Branch: feature/order-import
NÃO toque em nenhum arquivo fora do escopo listado no briefing.
Produza MERGE-INSTRUCTIONS para arquivos compartilhados.

Comece com a análise de impacto conforme o gate obrigatório.
```

**Anexar os 3 arquivos** como uploads.

### Passo 6: Acompanhar e receber entregas

Cada sessão vai seguir o gate obrigatório:
1. Análise de impacto → proposta → **aguarda seu OK**
2. Código → testes → version bump proposto → CHANGELOG proposto
3. ZIP + MERGE-INSTRUCTIONS + CONTINUITY

**Você valida cada proposta antes de autorizar o código.** Não pule esse passo.

Ao receber o ZIP de cada frente, salve em:
```
C:\000-Marcio\Journal\acompanhamento-2.0\Temp\student-onboarding.zip
C:\000-Marcio\Journal\acompanhamento-2.0\Temp\order-import.zip
```

---

## 5. FASE 2 — INTEGRAÇÃO

### Passo 7: Merge Frente A (Onboarding)

```powershell
# Mude para a branch da Frente A
git checkout feature/student-onboarding

# Descompacte o ZIP
Expand-Archive -Path "Temp\student-onboarding.zip" -DestinationPath "." -Force

# Verifique os arquivos criados
git status

# Rode os testes
npm test

# Se testes passam, commit
git add -A
git commit -m "feat: student onboarding with 2-stage AI assessment, 4D scoring, randomized questionnaire"

# NÃO faça merge para main ainda — espere a Frente B
```

### Passo 8: Merge Frente B (Order Import)

```powershell
# Mude para a branch da Frente B
git checkout feature/order-import

# Descompacte
Expand-Archive -Path "Temp\order-import.zip" -DestinationPath "." -Force

# Verifique e teste
git status
npm test

# Commit
git add -A
git commit -m "feat: order import pipeline with cross-check KPI validation, Tradovate parser"
```

### Passo 9: Consolidar Shared Files

Agora é o passo crítico — aplicar os MERGE-INSTRUCTIONS de ambas as frentes nos arquivos compartilhados. Faça isso na branch main.

```powershell
git checkout main
git pull origin main
```

**9.1 — Merge Frente A no main:**
```powershell
git merge feature/student-onboarding --no-ff -m "merge: student onboarding (CHUNK-09)"
```

**9.2 — Merge Frente B no main (pode ter conflitos em shared files):**
```powershell
git merge feature/order-import --no-ff -m "merge: order import pipeline (CHUNK-10)"
```

**9.3 — Se houver conflitos:** Abra os arquivos conflitantes e resolva manualmente. Os conflitos esperados são:
- `src/App.jsx` — duas novas rotas (uma de cada frente). Inclua ambas.
- `functions/index.js` — dois novos exports. Inclua ambos.
- `firestore.rules` — duas novas collections. Inclua ambas.

**9.4 — Consolidar version.js:**
Ambas as frentes vão propor bump. Escolha um único número (ex: se ambas propõem 1.20.0, fique com 1.20.0 — se uma propõe 1.20.0 e outra 1.21.0, use 1.21.0 e ajuste o CHANGELOG).

**9.5 — Consolidar CHANGELOG.md:**
Combine as entradas de ambas as frentes sob a mesma versão.

**9.6 — Consolidar ARCHITECTURE.md:**
Adicione as decisões de ambas as frentes como seções novas.

### Passo 10: Testes + Deploy

```powershell
# Rode todos os testes com as duas frentes integradas
npm test

# Se tudo verde, commit da consolidação
git add -A
git commit -m "chore: consolidate v1.20.0 - onboarding + order import shared files"

# Deploy Cloud Functions (se novas funções foram adicionadas)
cd functions
npm install
firebase deploy --only functions
cd ..

# Push
git push origin main

# Deploy Vercel (automático se configurado, ou manual)
```

---

## 6. FASE 3 — PÓS-MERGE

### Passo 11: Atualizar CHUNK-REGISTRY

Abra `docs/sprint-behavioral/CHUNK-REGISTRY.md` e atualize:

```markdown
| Chunk | Status | Branch | Sessão | Check-out | Notas |
|-------|--------|--------|--------|-----------|-------|
| CHUNK-09 | `AVAILABLE` | — | — | — | Mergeado em v1.20.0 |
| CHUNK-10 | `AVAILABLE` | — | — | — | Mergeado em v1.20.0 |
| CHUNK-11 | `AVAILABLE` | — | — | — | Pronto para check-out |
| CHUNK-12 | `AVAILABLE` | — | — | — | Pronto para check-out |
```

Commit e push.

### Passo 12: Limpar branches

```powershell
git branch -d feature/student-onboarding
git branch -d feature/order-import
```

### Passo 13: Próximas frentes

Com CHUNK-09 e CHUNK-10 mergeados, as próximas frentes podem ser disparadas:

**CHUNK-11 (Behavioral Detection)** — agora tem o substrato de ordens (CHUNK-10) para as regras RULE-O*. Use o `BEHAVIORAL-DETECTION-L1.md` como briefing base.

**CHUNK-12 (Cycle Alerts)** — independente de CHUNK-10. Pode rodar em paralelo com CHUNK-11 se não houver conflito de arquivos.

Repita o ciclo: lock no registry → criar branch → abrir sessão → receber ZIP → merge → liberar lock.

---

## 7. CHECKLIST RÁPIDO (COLA NA TELA)

```
□ FASE 0
  □ Docs commitados no repo (docs/sprint-behavioral/)
  □ Branches criadas (feature/student-onboarding, feature/order-import)
  □ Main limpa, testes passando
  □ CHUNK-REGISTRY atualizado com locks

□ FASE 1
  □ Sessão A aberta com 4 docs anexados
  □ Sessão B aberta com 3 docs anexados
  □ Análise de impacto aprovada em cada sessão
  □ Código autorizado em cada sessão
  □ ZIPs recebidos + MERGE-INSTRUCTIONS + CONTINUITY

□ FASE 2
  □ ZIP A descompactado na branch A, testes passando
  □ ZIP B descompactado na branch B, testes passando
  □ Merge A no main
  □ Merge B no main (resolver conflitos se houver)
  □ version.js consolidado
  □ CHANGELOG consolidado
  □ ARCHITECTURE.md atualizado
  □ Testes finais passando
  □ Cloud Functions deployed
  □ Push + deploy Vercel

□ FASE 3
  □ CHUNK-REGISTRY atualizado (AVAILABLE)
  □ Branches deletadas
  □ Próximas frentes planejadas
```

---

## 8. TROUBLESHOOTING

**"A sessão Claude não seguiu o gate obrigatório"**
→ Pare a sessão. Reforce o gate. Se persistir, abra nova sessão com o briefing + a instrução explícita de que pular gates é violação documentada (referência: ARCHITECTURE.md, INV-09).

**"O ZIP tem arquivos fora do escopo"**
→ Não descompacte cegamente. Inspecione o conteúdo primeiro: `Get-ChildItem -Recurse Temp\*.zip | Select FullName`. Remova manualmente arquivos que não deveriam estar ali antes de descompactar.

**"Conflito de merge em arquivo inesperado"**
→ Se o conflito é em um arquivo que nenhuma frente deveria ter tocado, uma sessão violou o escopo. Resolva o conflito priorizando o código da main (que é a versão correta). Documente a violação.

**"Testes falham após merge"**
→ Provavelmente import paths ou dependências cruzadas. Verifique se ambas as frentes declararam suas dependências no MERGE-INSTRUCTIONS. Se falta um import, adicione manualmente.

**"Cloud Function falha no deploy"**
→ Verifique `functions/package.json` — ambas as frentes podem ter adicionado dependências diferentes. Rode `cd functions && npm install` antes do deploy. Lembre: deadline Node.js 20 é 30/04/2026.

---

## 9. PRIORIDADE DO ALUNO SEM STOP (CASO URGENTE)

O caso do aluno com 80+ trades/dia sem stop é urgente e não precisa esperar o pipeline completo de Order Import. Ações imediatas possíveis:

**Curto prazo (hoje/amanhã):**
1. Conversa direta com o aluno sobre a obrigatoriedade de stop
2. Configurar no plano do aluno: `requireStop: true` (se compliance DEC-006 já permite)
3. Revisar manualmente os últimos trades e calcular o risco real que ele está carregando

**Médio prazo (após Order Import):**
1. Importar histórico de ordens → gerar cross-check retroativo
2. Mostrar ao aluno o risco real vs. o KPI que ele vê
3. Ajustar plano com limites de frequência (max trades/dia)

O import de ordens vai formalizar o que você já sabe intuitivamente. Mas a intervenção de mentoria não precisa esperar o software.

---

*README Version 1.0 — 18/03/2026*
*Autor: Sessão de planejamento arquitetural*
*Para: Marcio Portes (integrador único)*
