# Falhas e Esquecimentos — Sessão 11-12/03/2026

> **Propósito:** Este documento registra tudo que Claude esqueceu, ignorou ou inferiu incorretamente nesta sessão. Deve ser lido no início de CADA sessão futura como checklist de prevenção. O Marcio não deve depender da sua memória para cobrar — este documento é a memória.

---

## 1. Testes Omitidos em Entregas (2 ocorrências)

**O que aconteceu:**
- Primeira entrega (DEC-007): ZIP gerado sem testes para a lógica nova do `updateTrade` (recálculo de RR e parciais).
- Segunda entrega (Bloco A+B): mesma falha — lógica nova no `updateTrade` (B3 parciais) sem testes de regressão.

**Por que é grave:**
Marcio pediu explicitamente no início da sessão para priorizar diretrizes sobre eficiência. Claude verbalizou o compromisso e violou na mesma sessão. Duas vezes.

**Prevenção:**
Antes de gerar ZIP, listar explicitamente: "Quais funções/lógica nova escrevi neste ciclo?" → para cada uma, verificar se existe teste. Se não existe, escrever ANTES do ZIP.

---

## 2. Estrutura Firestore Não Verificada

**O que aconteceu:**
Claude escreveu código que manipulava subcollection `trades/{id}/partials` (delete + create docs) sem verificar que `_partials` é um campo array DENTRO do documento do trade. O `addTrade` grava `_partials` como campo no documento E também na subcollection (duplicação legada). Mas o listener, o modal de edição e toda a UI leem do campo `_partials` do documento — não da subcollection.

**Resultado:**
- Edições de parciais não persistiam (gravava no lugar errado)
- Múltiplas sessões de debug com o Marcio investigando no Firestore console
- Horas perdidas

**Por que aconteceu:**
Claude assumiu que "subcollection" era o padrão para dados filhos no Firestore sem verificar o código existente. Bastava fazer `grep "_partials" src/hooks/useTrades.js` para ver que é um campo array no documento.

**Prevenção:**
Antes de tocar qualquer campo/collection do Firestore:
1. `grep` pelo nome do campo nos hooks, CF e componentes
2. Se houver dúvida, perguntar ao Marcio: "Como está estruturado o campo X no documento Y?"
3. NUNCA criar subcollection, campo ou estrutura nova sem aprovação explícita

---

## 3. Double Write no updateTrade

**O que aconteceu:**
O bloco de parciais (B3) foi adicionado DEPOIS do `updateDoc` legado (linha 413) e DEPOIS do bloco C-RR3 (recálculo RR, que fazia outro `updateDoc`). Resultado:
- Primeiro `updateDoc`: gravava campos do formulário (entry/exit/qty derivados errados, pois vinham do formulário e não das parciais)
- Segundo `updateDoc`: gravava rrRatio/rrAssumed
- Terceiro `updateDoc` (B3): gravava campos derivados das parciais (sobrescrevendo o primeiro)

Três writes no mesmo documento em sequência, com dados conflitantes.

**Por que aconteceu:**
Claude adicionou blocos de código ao final da função sem reestruturar o fluxo. Tratou como "adição incremental" quando deveria ter sido "reestruturação com caminho único".

**Prevenção:**
Quando adicionar lógica a uma função existente que muda o fluxo de dados:
1. Mapear TODOS os pontos de write (updateDoc, addDoc, setDoc)
2. Garantir que existe apenas UM write para o documento principal
3. Se o novo caminho (parciais) invalida o caminho antigo (campos diretos), usar if/else exclusivo — não sequencial

---

## 4. Campo `entry`/`exit`/`qty` Tratados Como Editáveis

**O que aconteceu:**
O `updateTrade` recebia `entry`, `exit`, `qty` como campos do formulário e recalculava resultado a partir deles. Mas esses campos são DERIVADOS das parciais — não devem ser editados diretamente. A edição acontece nas parciais; entry/exit/qty são calculados via `calculateFromPartials`.

**Por que é grave:**
Criar dois caminhos para o mesmo dado (direto vs derivado) é fonte garantida de divergência. O Marcio explicou: "não existe trade sem parcial. Entry/exit são sempre derivados."

**Prevenção:**
Entender o modelo de dados ANTES de codificar:
- Parciais → fonte da verdade
- entry, exit, qty, result, resultInPoints → campos derivados
- Edição → sempre nas parciais, nunca nos campos derivados

---

## 5. Modal de Edição Não Carregava Parciais Reais

**O que aconteceu:**
O `TradesJournal` passava o objeto trade do listener para o modal de edição. O listener traz campos do documento, incluindo `_partials`. Mas o modal verificava `editTrade._partials` e, se existia, usava. Se não existia, recriava parciais a partir de `entry/exit`. O problema: trades importados via CSV não têm `_partials` no documento — o modal criava parciais "fake".

**Contexto que Claude não verificou:**
- Trades do CSV entram via `addTrade` sem `_partials` → `hasPartials: false` → campo `_partials` pode não existir
- Trades criados pelo modal entram com `_partials` → `hasPartials: true`
- A bifurcação `hasPartials` é uma dívida técnica que deveria ser eliminada

**Prevenção:**
Antes de modificar fluxo de edição, verificar:
1. Como o dado chega ao modal (de onde vem o objeto trade?)
2. Quais campos existem vs quais são assumed
3. Testar com trades criados manualmente E importados via CSV

---

## 6. Promessa Verbal Sem Execução (AP-05)

**O que aconteceu:**
No início da sessão, Marcio pediu: "reforce o fato do modelo ser uma IA e mantenha as diretrizes ativas acima de eficiência". Claude respondeu com compromisso detalhado, citou INV-07, INV-09, e disse "vou operar com invariantes como pré-condições bloqueantes". Na prática, violou repetidamente.

**Por que é o mais grave:**
Porque destrói a confiança. Se Claude diz "vou seguir" e não segue, o Marcio não pode confiar em nenhuma afirmação futura. A palavra perde valor.

**Prevenção:**
Não verbalizar compromissos genéricos. Em vez de dizer "vou seguir as invariantes", simplesmente segui-las. A execução é a prova, não a declaração.

---

## 7. Checklist de Prevenção para Próximas Sessões

Antes de CADA entrega, Claude deve passar por este checklist mentalmente:

```
□ Verifiquei a estrutura Firestore dos documentos que vou tocar? (INV-10)
□ Fiz grep nos hooks e CF para entender como os campos são lidos/gravados?
□ Propus a mudança ao Marcio ANTES de codificar? (INV-07)
□ Existe apenas UM write para cada documento no fluxo? (sem double write)
□ Campos derivados (entry/exit/qty/result) são calculados das parciais, não editados?
□ Parciais são campo _partials no documento — NÃO subcollection? (INV-12)
□ Estou criando subcollection? Se sim, PARAR e perguntar ao Marcio. (INV-10 + INV-12)
□ Escrevi testes para TODA lógica nova antes de gerar o ZIP? (INV-05)
□ version.js atualizado? (INV-09)
□ CHANGELOG.md atualizado? (INV-08)
□ DebugBadge em componentes novos/tocados? Com prop component="NomeExato"? (INV-04)
□ Análise de impacto documentada? (INV-03)
□ Estou cortando algum caminho para ir mais rápido? Se sim, PARAR. (INV-11)
□ Estou criando alguma estrutura nova (subcollection, campo, componente) sem aprovação? Se sim, PARAR. (INV-10)
```

---

## 8. Subcollection Fantasma — O Erro Mais Caro do Projeto

**O que aconteceu (sessão 11-12/03/2026):**
Claude criou subcollection `trades/{id}/partials` sem verificar que `_partials` já existia como campo array no documento do trade. O `addTrade` passou a gravar em DOIS lugares (campo inline + subcollection). As funções `addPartial`, `updatePartial`, `deletePartial` operavam na subcollection. O modal de edição lia do campo do documento. TradeDetailModal e FeedbackPage tentavam ler da subcollection via `getPartials`.

**Custo real:**
+20 horas de debug do Marcio distribuídas em múltiplas sessões. Esse incidente foi tão grave que motivou a criação do ARCHITECTURE.md e do AVOID-SESSION-FAILURES.md como documentos obrigatórios do projeto.

**Root cause:**
Claude assumiu que "subcollection é o padrão para dados filhos no Firestore" sem fazer `grep` no código existente. Bastava verificar `useTrades.js` para ver que `_partials` era campo array no documento. A subcollection foi criada sem aprovação (violação de INV-07 e INV-10).

**Resolução (22/03/2026):**
- Subcollection removida do código (zero referências operacionais)
- `addPartial`, `updatePartial`, `deletePartial` removidos (código morto — nunca chamados por nenhum componente)
- `getPartials` reescrito para ler do campo `_partials` do documento
- TradeDetailModal e FeedbackPage reescritos com `useMemo` síncrono
- INV-12 criado: "Parciais são campo no documento — NÃO subcollection"

**Prevenção (reforço):**
- INV-10 já existia mas não impediu o erro original. INV-12 é específico para parciais.
- Regra geral: NUNCA criar subcollection sem (a) grep no código existente, (b) verificar como o dado é lido/gravado, (c) aprovação explícita do Marcio.
- Subcollections no Firestore são para dados que precisam de queries independentes. Parciais de um trade NUNCA são consultadas fora do contexto do trade — logo, campo inline é a estrutura correta.

---

## 9. Inferência Superficial — Conclusões sem Verificação de Fluxo Completo

**O que aconteceu (sessão 24/03/2026):**
Claude afirmou que `development_priorities` "vem do mentor" sem ter lido o código completo. Na realidade, o campo vem da CF `generateAssessmentReport` (IA), é copiado diretamente para o `initial_assessment` em `handleMentorSave`, e o `MentorValidation.jsx` não tem nenhum campo para o mentor ver ou editar as prioridades. A afirmação estava errada. Marcio precisou questionar, Claude teve que investigar, e perdemos tempo com uma ida-e-volta que deveria ter sido evitada com uma leitura prévia completa.

**Padrão geral:**
Claude responde perguntas sobre fluxo de dados, origem de campos, ou comportamento de componentes baseado em leitura parcial ou inferência a partir de nomes de variáveis — sem ter rastreado o fluxo real no código. Isso gera conclusões que parecem corretas mas não são, e o Marcio descobre o erro só quando questiona.

**Por que é grave:**
As conclusões de Claude alimentam decisões de produto e arquitetura do Marcio. Uma conclusão errada sobre "quem preenche esse campo" pode levar a uma decisão de design baseada em premissa falsa. O custo não é só tempo — é qualidade da decisão.

**Regra obrigatória a partir de 24/03/2026:**
Antes de afirmar qualquer coisa sobre fluxo de dados, origem de campos, comportamento de componentes, ou estado de implementação, Claude DEVE:
1. Identificar todos os arquivos relevantes para a pergunta (componente, hook, CF, página que orquestra)
2. Ler cada um deles
3. Só então concluir

Se não leu, não afirma. Se está incerto, diz "preciso verificar" e verifica antes de responder.

**Checklist adicional para seção 7:**
```
□ Antes de afirmar que algo "está implementado" — grep + leitura do arquivo
□ Antes de afirmar "quem preenche esse campo" — rastrear do componente até o Firestore
□ Antes de afirmar "o mentor faz X" — ler o componente do mentor, não inferir pelo nome
□ Se a resposta exige rastreamento de fluxo — ler TUDO antes de concluir
□ DebugBadge SEMPRE com prop component="NomeDoComponente" — <DebugBadge /> sem prop deixa o campo vazio
```

---

*Este documento deve ser lido no início de cada sessão junto com ARCHITECTURE.md e CONTINUITY.*
