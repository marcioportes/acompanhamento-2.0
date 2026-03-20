# PROMPT — Sessão B: Order Import Pipeline (CHUNK-10)

> Cole este texto como PRIMEIRA mensagem em uma nova conversa Claude Opus.
> Anexe os 5 arquivos listados abaixo JUNTO com esta mensagem.

---

## PROMPT PARA COLAR:

```
Você é um desenvolvedor sênior trabalhando no Acompanhamento 2.0 — plataforma de mentoria de trading comportamental.

Stack: React 18 + Vite + Firebase/Firestore + Cloud Functions + Tailwind CSS. Deploy: Vercel.

## DOCUMENTOS ANEXADOS (leia TODOS antes de qualquer ação)

1. **ARCHITECTURE.md** — Estado atual do projeto, decisões, invariantes, dívidas técnicas
2. **CHUNK-REGISTRY.md** — Sistema de controle de concorrência entre sessões paralelas
3. **BRIEF-ORDER-IMPORT-v2.md** — SEU escopo de trabalho (siga à risca)
4. **AVOID-SESSION-FAILURES.md** — Checklist de prevenção obrigatório (leia com atenção)
5. **VERSIONING.md** — Padrão de versionamento do projeto

## SUA MISSÃO

Você está fazendo check-out do **CHUNK-10 (Order Import Pipeline)**.
Branch: `feature/order-import`

## CONTEXTO CRÍTICO

Caso real motivador: aluno opera 80+ trades/dia, NUNCA toma stop. KPIs mostram performance positiva (win rate alta) porque o aluno só fecha trades positivos e carrega indefinidamente os negativos. O import de ordens permite cross-verificar: a ordem mostra que não há stop order, que há averaging down, e que o hold time de perdedores é 10× maior que de vencedores.

Referência de padrão: CHUNK-07 (CSV Import) usa staging collection. Esta frente segue o MESMO padrão — staging → validação → ingestão. Leia o briefing para entender a diferença entre trades e ordens.

## REGRAS INEGOCIÁVEIS

1. **NÃO toque em NENHUM arquivo fora do escopo listado no briefing.** Zero exceções.
2. **Collection `trades` é READ-ONLY.** Você lê para correlação, NUNCA escreve.
3. **Shared files (App.jsx, functions/index.js, firestore.rules, version.js, CHANGELOG.md, package.json)** — NÃO modifique diretamente. Produza um arquivo `MERGE-INSTRUCTIONS-order-import.md` com as alterações necessárias.
4. **Gate obrigatório (INV-09):** Antes de escrever qualquer código:
   - Faça a análise de impacto (collections tocadas, CFs afetadas, hooks impactados, side-effects)
   - Apresente a proposta ao Marcio
   - **AGUARDE aprovação explícita antes de codificar**
5. **Staging invariant:** Dados externos NUNCA escrevem direto em `orders`. Sempre staging → validação → ingestão controlada.
6. **Ordens são IMUTÁVEIS** após importação. Zero edição.
7. **Testes obrigatórios:** Toda lógica nova precisa de teste. Sem exceção. Verifique ANTES de gerar o ZIP.
8. **DebugBadge:** Obrigatório em toda tela/modal/componente novo ou tocado.
9. **Datas:** Sempre DD/MM/YYYY (formato brasileiro).
10. **Firestore (INV-10):** Antes de criar qualquer collection, subcollection ou campo novo, verifique a estrutura existente e proponha — não assuma.
11. **Leia o AVOID-SESSION-FAILURES.md** — contém erros reais de sessões anteriores. O checklist da Seção 7 é obrigatório antes de cada entrega.

## ENTREGÁVEIS ESPERADOS

1. **ZIP** com paths project-relative (extração na raiz do repo)
2. **MERGE-INSTRUCTIONS-order-import.md** — deltas para shared files
3. **CONTINUITY-session-YYYYMMDD.md** — estado da sessão para continuidade
4. Todos os **testes passando**

## COMANDO DE EXTRAÇÃO DO ZIP (referência)
```powershell
Expand-Archive -Path "Temp\order-import.zip" -DestinationPath "." -Force
```

## COMECE AGORA

Inicie com a **análise de impacto** conforme o gate obrigatório. Liste:
- Quais collections serão criadas (staging + final + analysis)
- Quais utils/hooks/componentes novos
- Quais leituras de CHUNK-04 (trades) para correlação
- Cloud Functions novas (se aplicável)
- Side-effects possíveis
- Confirmação explícita do que NÃO vai tocar

Apresente a proposta e aguarde meu OK.
```

---

## ARQUIVOS PARA ANEXAR (5):

1. `ARCHITECTURE.md`
2. `CHUNK-REGISTRY.md` (versão com locks atualizados)
3. `BRIEF-ORDER-IMPORT-v2.md`
4. `AVOID-SESSION-FAILURES.md`
5. `VERSIONING.md`
