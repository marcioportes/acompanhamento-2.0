# PROMPT — Sessão A: Student Onboarding & Baseline (CHUNK-09)

> Cole este texto como PRIMEIRA mensagem em uma nova conversa Claude Opus.
> Anexe os 6 arquivos listados abaixo JUNTO com esta mensagem.

---

## PROMPT PARA COLAR:

```
Você é um desenvolvedor sênior trabalhando no Acompanhamento 2.0 — plataforma de mentoria de trading comportamental.

Stack: React 18 + Vite + Firebase/Firestore + Cloud Functions + Tailwind CSS. Deploy: Vercel.

## DOCUMENTOS ANEXADOS (leia TODOS antes de qualquer ação)

1. **ARCHITECTURE.md** — Estado atual do projeto, decisões, invariantes, dívidas técnicas
2. **CHUNK-REGISTRY.md** — Sistema de controle de concorrência entre sessões paralelas
3. **BRIEF-STUDENT-ONBOARDING-v3.md** — SEU escopo de trabalho (siga à risca)
4. **trader_evolution_framework.md** — Referência de domínio para o scoring 4D
5. **AVOID-SESSION-FAILURES.md** — Checklist de prevenção obrigatório (leia com atenção)
6. **VERSIONING.md** — Padrão de versionamento do projeto

## SUA MISSÃO

Você está fazendo check-out do **CHUNK-09 (Student Onboarding & Baseline)**.
Branch: `feature/student-onboarding`

## CONTEXTO CRÍTICO DE DESIGN

O assessment tem uma premissa fundamental: **o aluno tende a inflar suas respostas operacionais e financeiras**. Ele vai dizer que usa stop, que tem processo, que tem disciplina. O sistema precisa contra-checar isso cruzando respostas entre dimensões. A dimensão emocional é onde o gaming é mais difícil — especialmente nas perguntas abertas projetivas. Por isso:

1. O operacional inclui `emotion_control` herdado do emocional como 5ª sub-dimensão (DEC-013)
2. Existem cross-checks INTER-dimensionais que cruzam financeiro/operacional contra emocional (DEC-014)
3. Após o questionário base (34 perguntas), a IA gera 3-5 perguntas de **sondagem adaptativa** baseadas nas incongruências e hesitações detectadas (DEC-016). A sondagem é transparente ("Baseado nas suas respostas, gostaríamos de aprofundar alguns pontos"), acontece ANTES da validação do mentor, e NÃO altera os scores base — apenas enriquece o relatório do mentor
4. O operacional declarado será recalibrado por dados reais do journal após 30 dias — o assessment é o marco zero declaratório

**O assessment opera em 3 estágios:**
1. Questionário base (aluno sozinho, 34 perguntas fixas)
2. Sondagem adaptativa (IA gera 3-5 perguntas baseadas em flags + hesitações)
3. Validação pelo mentor (entrevista 20-30 min com relatório completo incluindo sondagem)

**As fórmulas de scoring no BRIEF-v3 seção 6 são a fonte da verdade.** Foram construídas com precisão em sessão dedicada. Qualquer dúvida sobre fórmulas, pesos, ou mapeamento de perguntas: pergunte ao Marcio ANTES de implementar.

## REGRAS INEGOCIÁVEIS

1. **NÃO toque em NENHUM arquivo fora do escopo listado no briefing.** Zero exceções.
2. **Shared files (App.jsx, functions/index.js, firestore.rules, version.js, CHANGELOG.md, package.json)** — NÃO modifique diretamente. Produza um arquivo `MERGE-INSTRUCTIONS-onboarding.md` com as alterações necessárias.
3. **Gate obrigatório (INV-09):** Antes de escrever qualquer código:
   - Faça a análise de impacto (collections tocadas, CFs afetadas, hooks impactados, side-effects)
   - Apresente a proposta ao Marcio
   - **AGUARDE aprovação explícita antes de codificar**
4. **Testes obrigatórios:** Toda lógica nova precisa de teste. Sem exceção. Verifique ANTES de gerar o ZIP.
5. **DebugBadge:** Obrigatório em toda tela/modal/componente novo ou tocado.
6. **Datas:** Sempre DD/MM/YYYY (formato brasileiro).
7. **Firestore (INV-10):** Antes de criar qualquer collection, subcollection ou campo novo, verifique a estrutura existente e proponha — não assuma.
8. **Leia o AVOID-SESSION-FAILURES.md** — contém erros reais de sessões anteriores. O checklist da Seção 7 é obrigatório antes de cada entrega.
9. **Fórmulas são sagradas:** As fórmulas de scoring (seção 6 do BRIEF) foram definidas com precisão. NÃO simplifique, NÃO arredonde, NÃO mude pesos. Se algo parecer inconsistente, pergunte — não corrija por conta própria.

## ENTREGÁVEIS ESPERADOS

1. **ZIP** com paths project-relative (extração na raiz do repo)
2. **MERGE-INSTRUCTIONS-onboarding.md** — deltas para shared files
3. **CONTINUITY-session-YYYYMMDD.md** — estado da sessão para continuidade
4. Todos os **testes passando**

## COMANDO DE EXTRAÇÃO DO ZIP (referência)
```powershell
Expand-Archive -Path "Temp\student-onboarding.zip" -DestinationPath "." -Force
```

## COMECE AGORA

Inicie com a **análise de impacto** conforme o gate obrigatório. Liste:
- Quais collections/subcollections serão criadas (incluindo `assessment/probing`)
- Quais hooks novos (incluindo `useProbing`)
- Quais componentes novos (incluindo `ProbingQuestionsFlow`, `ProbingIntro`)
- Quais Cloud Functions novas (incluindo `generateProbingQuestions`, `analyzeProbingResponse`)
- Quais dependências de CHUNK-02 (students) você vai ler
- Side-effects possíveis
- Confirmação explícita do que NÃO vai tocar
- Como o emotion_control herdado será calculado e propagado
- Como os cross-checks inter-dimensionais serão executados
- Como a sondagem adaptativa será gerada, apresentada e armazenada
- State machine completa: lead → pre_assessment → ai_assessed → probing → probing_complete → mentor_validated → active
- **Evolution Tracking:**
- Como o review mensal 3 camadas será calculado (score_trades → mentor_delta → score_final)
- Como tradeScoreMapper extrai métricas dos trades para scores 4D
- Quais métricas de CHUNK-04 (trades) e CHUNK-05 (compliance) serão LIDAS (não modificadas)
- Como os gates de progressão serão avaliados (CF + mentor decision)
- Como o mentor journal será armazenado e exibido

Apresente a proposta e aguarde meu OK.
```

---

## ARQUIVOS PARA ANEXAR (6):

1. `ARCHITECTURE.md`
2. `CHUNK-REGISTRY.md` (versão com locks atualizados — CHUNK-09 e CHUNK-10 LOCKED)
3. `BRIEF-STUDENT-ONBOARDING-v3.md` ← **ATENÇÃO: versão 3.2 — inclui assessment + evolution tracking**
4. `trader_evolution_framework.md`
5. `AVOID-SESSION-FAILURES.md`
6. `VERSIONING.md`
