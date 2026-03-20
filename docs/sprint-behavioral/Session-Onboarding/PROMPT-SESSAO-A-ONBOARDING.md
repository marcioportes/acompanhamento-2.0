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
3. **BRIEF-STUDENT-ONBOARDING-v2.md** — SEU escopo de trabalho (siga à risca)
4. **trader_evolution_framework.md** — Referência de domínio para o scoring 4D
5. **AVOID-SESSION-FAILURES.md** — Checklist de prevenção obrigatório (leia com atenção)
6. **VERSIONING.md** — Padrão de versionamento do projeto

## SUA MISSÃO

Você está fazendo check-out do **CHUNK-09 (Student Onboarding & Baseline)**.
Branch: `feature/student-onboarding`

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
- Quais collections/subcollections serão criadas
- Quais hooks novos
- Quais componentes novos
- Quais dependências de CHUNK-02 (students) você vai ler
- Side-effects possíveis
- Confirmação explícita do que NÃO vai tocar

Apresente a proposta e aguarde meu OK.
```

---

## ARQUIVOS PARA ANEXAR (6):

1. `ARCHITECTURE.md`
2. `CHUNK-REGISTRY.md` (versão com locks atualizados)
3. `BRIEF-STUDENT-ONBOARDING-v2.md`
4. `trader_evolution_framework.md`
5. `AVOID-SESSION-FAILURES.md`
6. `VERSIONING.md`
