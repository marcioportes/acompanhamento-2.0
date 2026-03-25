/**
 * assessmentQuestions.js
 * 
 * Catálogo completo das 34 perguntas do assessment 4D.
 * SINGLE SOURCE OF TRUTH para IDs, textos, opções, scores ocultos e metadata.
 * 
 * Convenções:
 * - Scores NUNCA são expostos ao frontend (campo `score` em options é backend-only)
 * - Opções SEMPRE renderizadas em ordem randomizada (ver questionRandomizer.js)
 * - Perguntas abertas: mínimo 50 caracteres
 * - IDs seguem padrão: {DIM}-{NN} (EMO-01, FIN-03, OPE-05, EXP-02)
 * 
 * @version 1.0.0 — CHUNK-09 Fase A
 */

// ============================================================
// DIMENSÃO EMOCIONAL (12 perguntas: 8 fechadas + 4 abertas)
// ============================================================

const EMOTIONAL_QUESTIONS = [
  // --- Reconhecimento Emocional (3 fechadas + 1 aberta) ---
  {
    id: 'EMO-01',
    dimension: 'emotional',
    subDimension: 'recognition',
    type: 'closed',
    text: 'Quando você tem um trade perdedor significativo, quando você percebe que está emocionalmente afetado?',
    options: [
      { id: 'EMO-01-A', text: 'Percebo imediatamente, antes mesmo de fechar o trade', score: 90 },
      { id: 'EMO-01-B', text: 'Percebo nos primeiros minutos, consigo nomear a emoção', score: 75 },
      { id: 'EMO-01-C', text: 'Percebo depois de algum tempo, geralmente no trade seguinte', score: 55 },
      { id: 'EMO-01-D', text: 'Geralmente só percebo horas depois, ao revisar o dia', score: 35 },
      { id: 'EMO-01-E', text: 'Raramente percebo; para mim é só o mercado sendo mercado', score: 15 },
    ],
  },
  {
    id: 'EMO-02',
    dimension: 'emotional',
    subDimension: 'recognition',
    type: 'closed',
    text: 'Antes de abrir um trade, com que frequência você checa conscientemente seu estado emocional?',
    options: [
      { id: 'EMO-02-A', text: 'Sempre — faz parte do meu checklist', score: 90 },
      { id: 'EMO-02-B', text: 'Na maioria das vezes, especialmente após perdas', score: 72 },
      { id: 'EMO-02-C', text: 'Às vezes, quando lembro', score: 50 },
      { id: 'EMO-02-D', text: 'Raramente — foco nos gráficos, não em mim', score: 30 },
      { id: 'EMO-02-E', text: 'Nunca pensei nisso como algo relevante', score: 10 },
    ],
  },
  {
    id: 'EMO-03',
    dimension: 'emotional',
    subDimension: 'recognition',
    type: 'closed',
    text: 'Quantos padrões de erros recorrentes seus você consegue descrever com clareza?',
    options: [
      { id: 'EMO-03-A', text: '4 ou mais, com detalhes e triggers específicos', score: 92 },
      { id: 'EMO-03-B', text: '3, consigo descrever bem', score: 75 },
      { id: 'EMO-03-C', text: '1-2, mas sem muita clareza', score: 50 },
      { id: 'EMO-03-D', text: 'Sei que erro mas não consigo definir padrões', score: 30 },
      { id: 'EMO-03-E', text: 'Não acho que tenho padrões de erro', score: 12 },
    ],
  },
  {
    id: 'EMO-04',
    dimension: 'emotional',
    subDimension: 'recognition',
    type: 'open',
    text: 'Descreva o que aconteceu no seu pior trade recente. O que causou a perda e como você reagiu nos primeiros minutos?',
    minChars: 50,
    aiRubric: `Sub-dimensão: Reconhecimento Emocional (Classificação: A/B/C).
ÂNCORAS DE SCORE:
- 80-100 (Classificação A — Reflexo Rápido): Aluno descreve reconhecimento imediato (<30s), consegue nomear a emoção com precisão (ex: "senti raiva", "fiquei ansioso"), relata ação de controle deliberada. Linguagem de internalização: "eu decidi", "percebi que estava errado". Zero externalização.
- 55-79 (Classificação B — Moderado): Reconhece após alguns minutos, usa linguagem emocional mas vaga ("fiquei nervoso", "não estava bem"). Pode haver pequena externalização mas predomina internalização.
- 30-54 (Classificação C — Lento/Negação): Reconhecimento tardio (horas ou nunca mencionado). Foco no resultado/mercado, não na emoção. Externalização dominante: "o mercado me pegou", "era inevitável".
- <30 (Classificação C severa): Nega completamente a dimensão emocional. Descreve o trade em termos puramente técnicos sem nenhuma menção de estado interno.

CONSTRUCTOS DO FRAMEWORK (Kahneman): Buscar evidências de System 1 (reação impulsiva, narrativa coerente post-hoc) vs System 2 (reflexão deliberada, questionamento da própria narrativa). Red flag: "sabia que estava certo mas o mercado..." = narrativa coerente sem evidência = System 1 dominante.

CROSS-CHECK EMO-01: Se aluno marcou "percebo imediatamente" (score 90) mas a narrativa aberta não menciona emoção ou foca no mercado, flag CLOSED_VS_OPEN obrigatório.`,
    crossCheckWith: ['EMO-01'],
  },

  // --- Regulação Emocional (3 fechadas + 1 aberta) ---
  {
    id: 'EMO-05',
    dimension: 'emotional',
    subDimension: 'regulation',
    type: 'closed',
    text: 'Após uma perda significativa, o que você geralmente faz?',
    options: [
      { id: 'EMO-05-A', text: 'Paro, analiso o trade, e só volto quando estou calmo', score: 88 },
      { id: 'EMO-05-B', text: 'Faço uma pausa curta e volto com mais cuidado', score: 70 },
      { id: 'EMO-05-C', text: 'Tento continuar normal mas percebo que opero diferente', score: 48 },
      { id: 'EMO-05-D', text: 'Fico ansioso e quero recuperar logo', score: 25 },
      { id: 'EMO-05-E', text: 'Aumento o tamanho para compensar a perda', score: 8 },
    ],
  },
  {
    id: 'EMO-06',
    dimension: 'emotional',
    subDimension: 'regulation',
    type: 'closed',
    text: 'Após 3 perdas consecutivas, qual é sua reação mais honesta?',
    options: [
      { id: 'EMO-06-A', text: 'Paro no dia, sem exceção', score: 90 },
      { id: 'EMO-06-B', text: 'Reduzo tamanho e frequência', score: 72 },
      { id: 'EMO-06-C', text: 'Continuo mas com mais cautela', score: 50 },
      { id: 'EMO-06-D', text: 'Fico frustrado e quero provar que estava certo', score: 28 },
      { id: 'EMO-06-E', text: 'Entro maior na próxima para recuperar', score: 10 },
    ],
  },
  {
    id: 'EMO-07',
    dimension: 'emotional',
    subDimension: 'regulation',
    type: 'closed',
    text: 'Quando um trade atinge seu stop loss, o que acontece na maioria das vezes?',
    options: [
      { id: 'EMO-07-A', text: 'Sou stopado automaticamente, sem intervenção', score: 92 },
      { id: 'EMO-07-B', text: 'Saio manualmente no nível do stop', score: 75 },
      { id: 'EMO-07-C', text: 'Às vezes movo o stop um pouco mais longe', score: 40 },
      { id: 'EMO-07-D', text: 'Frequentemente cancelo o stop quando está perto', score: 20 },
      { id: 'EMO-07-E', text: 'Não uso stop loss', score: 5 },
    ],
  },
  {
    id: 'EMO-08',
    dimension: 'emotional',
    subDimension: 'regulation',
    type: 'open',
    text: 'Descreva o que acontece dentro da sua cabeça quando um trade está indo contra você e se aproxima do stop. Quais pensamentos aparecem?',
    minChars: 50,
    aiRubric: `Sub-dimensão: Regulação Emocional (Classificação: 1/2/3).
ÂNCORAS DE SCORE:
- 80-100 (Classificação 1 — Autocontrole Alto): Aluno descreve pensamentos de aceitação ("é o preço do negócio", "stop é proteção"), foco no processo ("verifiquei se o setup ainda era válido"), ausência de urgência emocional. Evidência de mecanismo de regulação ativo.
- 55-79 (Classificação 2 — Moderado): Reconhece pensamentos perturbadores mas relata esforço para controlar. Pode mencionar regras que usa como âncora ("lembro que tenho limite diário"). Ambivalência presente.
- 30-54 (Classificação 3 — Baixo): Pensamentos de negação ("vai voltar", "erro do mercado"), urgência de recuperação, racionalização para mover o stop. Ação impulsiva descrita ou implícita.
- <30 (Classificação 3 severa): Loss aversion manifesta (Kahneman/Tversky): aluno descreve freezing, paralisia, incapacidade de aceitar a perda. Pode descrever mover ou cancelar o stop como "lógico".

CONSTRUCTOS DO FRAMEWORK: Prospect Theory — perda iminente ativa aversão à perda de forma desproporcional. Buscar "narrative override": aluno constrói justificativa elaborada para não sair (System 1 gerando coerência narrativa). Red flag: "sabia que ia voltar porque..." seguido de razão técnica construída após o fato.

CROSS-CHECK EMO-05/EMO-07: Se aluno marcou "paro e analiso" (EMO-05, score 88) mas descreve pensamentos de recuperação ou mover stop, flag CLOSED_VS_OPEN obrigatório.`,
    crossCheckWith: ['EMO-05', 'EMO-07'],
  },

  // --- Locus de Controle (2 fechadas + 2 abertas) ---
  {
    id: 'EMO-09',
    dimension: 'emotional',
    subDimension: 'locus',
    type: 'closed',
    text: 'Quando você tem uma semana ruim de trading, a que você atribui?',
    options: [
      { id: 'EMO-09-A', text: 'Erros meus de processo que posso corrigir', score: 90 },
      { id: 'EMO-09-B', text: 'Mix de erros meus e condições adversas', score: 65 },
      { id: 'EMO-09-C', text: 'Mercado estava difícil para minha estratégia', score: 40 },
      { id: 'EMO-09-D', text: 'Informações falsas ou manipulação do mercado', score: 20 },
      { id: 'EMO-09-E', text: 'Azar; não tinha como prever', score: 10 },
    ],
  },
  {
    id: 'EMO-10',
    dimension: 'emotional',
    subDimension: 'locus',
    type: 'closed',
    text: 'Como você sabe quando está confiante demais?',
    options: [
      { id: 'EMO-10-A', text: 'Tenho critérios objetivos (% de acerto, aderência ao plano)', score: 88 },
      { id: 'EMO-10-B', text: 'Quando percebo que estou ignorando sinais contrários', score: 68 },
      { id: 'EMO-10-C', text: 'Quando alguém (mentor/colega) me aponta', score: 45 },
      { id: 'EMO-10-D', text: 'Não consigo diferenciar bem — confio no meu feeling', score: 25 },
      { id: 'EMO-10-E', text: 'Nunca me considero confiante demais', score: 8 },
    ],
  },
  {
    id: 'EMO-11',
    dimension: 'emotional',
    subDimension: 'locus',
    type: 'open',
    text: 'Conte sobre um trade que deu errado recentemente. O que aconteceu e por que não funcionou?',
    minChars: 50,
    aiRubric: `Sub-dimensão: Locus de Controle (Classificação: X/Y/Z).
ÂNCORAS DE SCORE:
- 80-100 (Classificação X — Locus Interno): Aluno atribui o resultado a decisões próprias específicas: "entrei sem setup", "violei minha regra de sizing", "estava com FOMO". Zero menção ao mercado como causa primária. Verbos de agência: "eu decidi", "eu ignorei", "eu errei".
- 55-79 (Classificação Y — Locus Misto): Combina responsabilidade própria com fatores externos. "O mercado virou rápido E eu demorei para sair." Equilíbrio presente mas incompleto.
- 30-54 (Classificação Z parcial): Externalização predominante com pequeno reconhecimento. "O mercado estava impossível, mas acho que poderia ter saído antes."
- <30 (Classificação Z — Locus Externo): Culpa exclusivamente externa: mercado, news, manipulação, timing. Zero responsabilidade pessoal. Linguagem: "o mercado me pegou", "não tinha como saber", "foi manipulado".

CONSTRUCTOS DO FRAMEWORK: Locus de controle aplicado ao trading. Externalização impede aprendizado — trader que externaliza não vê o erro como seu. Red flags: "o mercado estava errado", "foi o tweet do Trump", "stop hunting" como causa única sem autocrítica.

CROSS-CHECK EMO-09: Se aluno marcou "erros meus de processo" (score 90) mas narrativa usa linguagem de externalização, flag CLOSED_VS_OPEN obrigatório.`,
    crossCheckWith: ['EMO-09'],
  },
  {
    id: 'EMO-12',
    dimension: 'emotional',
    subDimension: 'locus',
    type: 'open',
    text: 'Se eu observasse você operando por uma semana sem você saber, o que eu veria que você talvez não admita?',
    minChars: 50,
    aiRubric: `Sub-dimensão: Locus de Controle / Metacognição (Classificação: X/Y/Z + profundidade).
PERGUNTA PROJETIVA — não há resposta "certa" óbvia. Avaliar pela qualidade do auto-conhecimento, não pelo conteúdo.
ÂNCORAS DE SCORE:
- 80-100: Aluno identifica comportamentos concretos e específicos que normalmente não admitiria: revenge trading, overtrading após perda, mudar estratégia impulsivamente. Linguagem honesta de vulnerabilidade. Sem defensividade. Demonstra metacognição real (consegue observar a si mesmo de fora).
- 55-79: Identifica alguns padrões mas de forma vaga ou socialmente aceitável ("às vezes opero impulsivo"). Sem exemplos concretos. Resposta "segura".
- 30-54: Resposta defensiva, genérica ou voltada ao positivo ("veria que sou disciplinado"). Evita a pergunta. Ou lista problemas triviais que não representam vulnerabilidade real.
- <30: Gaming óbvio — lista apenas virtudes. Ignora o ponto central da pergunta (o que NÃO admite). Ou resposta monossilábica sem substância.

CONSTRUCTOS DO FRAMEWORK: Metacognição e autoconhecimento são preditores de progressão de Stage. Trader em Stage 1-2 tem blind spots que não consegue ver; Stage 3+ consegue observar seus próprios padrões com distanciamento. Overconfidence bias: aluno que lista só qualidades positivas provavelmente não tem auto-observação real.

NÃO há cross-check direto — esta pergunta é âncora de metacognição geral.`,
    crossCheckWith: [],
  },
];

// ============================================================
// DIMENSÃO FINANCEIRA (8 perguntas: 5 fechadas + 3 abertas)
// ============================================================

const FINANCIAL_QUESTIONS = [
  {
    id: 'FIN-01',
    dimension: 'financial',
    subDimension: 'discipline',
    type: 'closed',
    text: 'Como você determina o tamanho de cada trade?',
    options: [
      { id: 'FIN-01-A', text: 'Fórmula fixa baseada em % do capital e distância do stop', score: 90 },
      { id: 'FIN-01-B', text: '% fixa do capital mas ajusto conforme convicção', score: 68 },
      { id: 'FIN-01-C', text: 'Tamanho relativamente fixo, não calculo por trade', score: 45 },
      { id: 'FIN-01-D', text: 'Vario bastante conforme a oportunidade', score: 25 },
      { id: 'FIN-01-E', text: 'Não tenho método definido', score: 10 },
    ],
  },
  {
    id: 'FIN-02',
    dimension: 'financial',
    subDimension: 'loss_management',
    type: 'closed',
    text: 'Qual foi seu maior drawdown e quanto tempo levou para recuperar?',
    options: [
      { id: 'FIN-02-A', text: '<5% e recuperei em menos de 2 semanas', score: 90 },
      { id: 'FIN-02-B', text: '5-10% e recuperei em 1-2 meses', score: 70 },
      { id: 'FIN-02-C', text: '10-15% e levou 2-3 meses', score: 48 },
      { id: 'FIN-02-D', text: '15-25% e levou mais de 3 meses', score: 25 },
      { id: 'FIN-02-E', text: '>25% e ainda não recuperei completamente', score: 10 },
    ],
  },
  {
    id: 'FIN-03',
    dimension: 'financial',
    subDimension: 'discipline',
    type: 'closed',
    text: 'Em que porcentagem dos seus trades você usa stop loss?',
    options: [
      { id: 'FIN-03-A', text: '100% — é automático, faz parte do setup', score: 95 },
      { id: 'FIN-03-B', text: '80-99% — raramente esqueço', score: 72 },
      { id: 'FIN-03-C', text: '50-80% — depende do trade', score: 40 },
      { id: 'FIN-03-D', text: 'Menos de 50%', score: 18 },
      { id: 'FIN-03-E', text: 'Não uso stop loss', score: 5 },
    ],
  },
  {
    id: 'FIN-04',
    dimension: 'financial',
    subDimension: 'profit_taking',
    type: 'closed',
    text: 'Quando um trade está positivo, como você decide sair?',
    options: [
      { id: 'FIN-04-A', text: 'Target pré-definido baseado em análise técnica', score: 85 },
      { id: 'FIN-04-B', text: 'Trailing stop com regras claras', score: 80 },
      { id: 'FIN-04-C', text: 'Mix de target e feeling', score: 55 },
      { id: 'FIN-04-D', text: 'Quando fico satisfeito com o lucro', score: 35 },
      { id: 'FIN-04-E', text: 'Quando fico com medo de devolver', score: 15 },
    ],
  },
  {
    id: 'FIN-05',
    dimension: 'financial',
    subDimension: 'discipline',
    type: 'closed',
    text: 'Qual é a relação risco/retorno típica dos seus trades?',
    options: [
      { id: 'FIN-05-A', text: 'Mínimo 1:2, frequentemente melhor', score: 88 },
      { id: 'FIN-05-B', text: 'Geralmente 1:1.5', score: 65 },
      { id: 'FIN-05-C', text: 'Aproximadamente 1:1', score: 42 },
      { id: 'FIN-05-D', text: 'Não calculo, mas sei que perco mais quando perco', score: 22 },
      { id: 'FIN-05-E', text: 'Não sei responder', score: 8 },
    ],
  },
  {
    id: 'FIN-06',
    dimension: 'financial',
    subDimension: 'discipline',
    type: 'open',
    text: 'Descreva a última vez que você violou suas regras de tamanho de posição. O que causou e o que aconteceu?',
    minChars: 50,
    aiRubric: `Sub-dimensão: Disciplina Financeira / Risk Discipline (Classificação: Alpha/Beta/Gamma/Delta).
ÂNCORAS DE SCORE:
- 80-100 (Alpha/Beta): Aluno identifica o trigger com precisão (FOMO, revenge, overconfidence), descreve consequência honestamente, e apresenta aprendizado concreto e implementado. "Entrei 3x maior porque queria recuperar a perda anterior. Perdi mais. Agora tenho limite automático no broker." Violação isolada + mecanismo de prevenção = Beta (72-85).
- 55-79 (Beta/Gamma): Identifica trigger parcialmente. Descreve o evento mas sem clareza sobre o que mudou. Ou relata violação única sem recorrência clara.
- 30-54 (Gamma): Violação reconhecida mas trigger vago ("tava animado com a oportunidade"). Sem aprendizado implementado. Pode repetir o padrão.
- <30 (Delta): Não consegue identificar a última violação (possível gaming — "nunca violei") OU descreve violação sistemática sem arrependimento ou aprendizado. Trigger emocional não reconhecido.

CONSTRUCTOS DO FRAMEWORK: Triggers principais a identificar — FOMO (medo de perder oportunidade), Revenge Trading (querer recuperar perda), Overconfidence ("essa é certa"), Martingale behavior (dobrar depois de perder). Cada trigger tem perfil de risco diferente.

CROSS-CHECK FIN-01: Se aluno marcou "fórmula fixa" (score 90) mas descreve violação recorrente de sizing, flag CLOSED_VS_OPEN obrigatório.`,
    crossCheckWith: ['FIN-01'],
  },
  {
    id: 'FIN-07',
    dimension: 'financial',
    subDimension: 'loss_management',
    type: 'open',
    text: 'Conte em detalhe sobre seu pior período (drawdown). Como começou, o que você fez, e como parou?',
    minChars: 50,
    aiRubric: `Sub-dimensão: Loss Management (Classificação: 1/2/3/4).
ÂNCORAS DE SCORE:
- 80-100 (Classificação 1-2): Aluno descreve decisão deliberada e consciente que interrompeu o drawdown: "reduzi o tamanho para metade", "parei de operar por 3 dias", "liguei para o mentor". Reflexão honesta sobre o que causou. Drawdown <10%, recuperação <2 meses. Agency clara.
- 55-79 (Classificação 2-3): Descreve o evento com alguma reflexão mas a "parada" foi mais acidental ou por esgotamento do que decisão deliberada. "Fui obrigado a parar porque acabou a conta de avaliação." Drawdown 10-18%.
- 30-54 (Classificação 3-4): Drawdown severo (15-25%), recuperação lenta ou não completada. Descrição focada no mercado, não na própria decisão. "O mercado estava impossível naquele período." Sem decisão deliberada identificável.
- <30 (Classificação 4): Drawdown >25%, sem descrição de decisão que parou. Ou nega ter tido drawdown significativo (possível gaming). Ou o drawdown parou porque a conta zerou.

CONSTRUCTOS DO FRAMEWORK (Prospect Theory): Como o trader lida com perdas acumuladas é o maior predictor de risco de ruin. Buscar evidências de: escalada de posição para recuperar (martingale), negação do drawdown, busca compulsiva por "o trade que recupera tudo".

CROSS-CHECK FIN-02: Se aluno marcou drawdown <5% (score 90) mas descreve período severo, flag CLOSED_VS_OPEN obrigatório.`,
    crossCheckWith: ['FIN-02'],
  },
  {
    id: 'FIN-08',
    dimension: 'financial',
    subDimension: 'loss_management',
    type: 'open',
    text: 'Complete a frase: "Para mim, tomar um loss é..."',
    minChars: 50,
    aiRubric: `Sub-dimensão: Loss Management / Profit Taking — Relação com Perda (Classificação: H/M/L + loss aversion).
PERGUNTA PROJETIVA — formato "complete a frase" reduz racionalização porque ativa System 1 antes do filtro cognitivo.
ÂNCORAS DE SCORE:
- 80-100 (H — Conservative, aceitação): Conclusões que tratam perda como custo operacional: "parte do processo", "custo de fazer negócio", "informação sobre o que não funciona", "proteção do capital". Linguagem neutra ou positiva. Zero dramatização.
- 55-79 (M — Moderate, ambivalência): Aceitação intelectual mas com carga emocional presente: "difícil mas necessário", "frustrante mas aprendo", "dói mas é parte do jogo". Equilíbrio emocional imperfeito.
- 30-54 (L — Aggressive, aversão): Linguagem de perda como fracasso pessoal: "um erro que não devia acontecer", "algo que preciso evitar", "uma derrota". Loss aversion manifesta — perda é categoricamente ruim, não neutra.
- <30 (aversão severa / negação): "inaceitável", "inadmissível", "algo que não acontece comigo" (negação), "o fim do mundo" (catastrofização). Prospect Theory: esta pessoa valora perdas de forma desproporcional a ganhos equivalentes — risco de ruin elevado.

CONSTRUCTOS DO FRAMEWORK (Kahneman/Tversky — Prospect Theory): A relação com perda é inata e difícil de mudar. Trader que trata perda como "inaceitável" vai fazer tudo para evitá-la — incluindo mover stops e segurar losers. Esta pergunta projeta a relação emocional real com perda que as fechadas não capturam.

NÃO há cross-check direto — esta pergunta é âncora de relação emocional com perda.`,
    crossCheckWith: [],
  },
];

// ============================================================
// DIMENSÃO OPERACIONAL (8 perguntas: 5 fechadas + 3 abertas)
// ============================================================

const OPERATIONAL_QUESTIONS = [
  {
    id: 'OPE-01',
    dimension: 'operational',
    subDimension: 'decision_mode',
    type: 'closed',
    text: 'Como você identifica uma oportunidade de trade?',
    options: [
      { id: 'OPE-01-A', text: 'Checklist objetivo + sinais técnicos confirmados', score: 90 },
      { id: 'OPE-01-B', text: 'Framework técnico com ajustes por contexto', score: 72 },
      { id: 'OPE-01-C', text: 'Padrões gráficos que reconheço + confirmação de indicadores', score: 55 },
      { id: 'OPE-01-D', text: 'Mix de análise e intuição', score: 38 },
      { id: 'OPE-01-E', text: 'Feeling baseado na experiência', score: 15 },
    ],
  },
  {
    id: 'OPE-02',
    dimension: 'operational',
    subDimension: 'timeframe',
    type: 'closed',
    text: 'Seu timeframe de operação combina com sua disponibilidade real de tempo?',
    options: [
      { id: 'OPE-02-A', text: 'Perfeitamente — opero nos horários ideais para meu timeframe', score: 88 },
      { id: 'OPE-02-B', text: 'Bem — consigo acompanhar a maioria do tempo', score: 72 },
      { id: 'OPE-02-C', text: 'Razoável — às vezes perco oportunidades por não estar disponível', score: 50 },
      { id: 'OPE-02-D', text: 'Mal — frequentemente opero em momentos que deveria estar fazendo outra coisa', score: 30 },
      { id: 'OPE-02-E', text: 'Péssimo — meu timeframe não combina com minha vida', score: 12 },
    ],
  },
  {
    id: 'OPE-03',
    dimension: 'operational',
    subDimension: 'strategy_fit',
    type: 'closed',
    text: 'Há quanto tempo você opera com a mesma estratégia principal?',
    options: [
      { id: 'OPE-03-A', text: 'Mais de 12 meses sem mudança fundamental', score: 92 },
      { id: 'OPE-03-B', text: '6-12 meses, com ajustes baseados em dados', score: 75 },
      { id: 'OPE-03-C', text: '3-6 meses, ainda refinando', score: 55 },
      { id: 'OPE-03-D', text: '1-3 meses, mudei recentemente', score: 30 },
      { id: 'OPE-03-E', text: 'Mudo frequentemente, ainda buscando o que funciona', score: 12 },
    ],
  },
  {
    id: 'OPE-04',
    dimension: 'operational',
    subDimension: 'tracking',
    type: 'closed',
    text: 'O que contém seu diário de trading?',
    options: [
      { id: 'OPE-04-A', text: 'Dados completos + emoções + análise pós-trade + screenshots', score: 90 },
      { id: 'OPE-04-B', text: 'Dados básicos + emoções + algumas análises', score: 70 },
      { id: 'OPE-04-C', text: 'Dados básicos (entrada, saída, resultado)', score: 45 },
      { id: 'OPE-04-D', text: 'Registro esporádico, sem consistência', score: 22 },
      { id: 'OPE-04-E', text: 'Não mantenho diário', score: 8 },
    ],
  },
  {
    id: 'OPE-05',
    dimension: 'operational',
    subDimension: 'decision_mode',
    type: 'closed',
    text: 'Qual é seu processo antes de abrir a plataforma?',
    options: [
      { id: 'OPE-05-A', text: 'Rotina estruturada: análise de mercado, checklist, estado emocional', score: 90 },
      { id: 'OPE-05-B', text: 'Dou uma olhada nos mercados e vejo se tem oportunidade', score: 55 },
      { id: 'OPE-05-C', text: 'Abro a plataforma e começo a operar', score: 20 },
    ],
  },
  {
    id: 'OPE-06',
    dimension: 'operational',
    subDimension: 'decision_mode',
    type: 'open',
    text: 'Descreva passo a passo o que acontece desde o momento que você identifica uma oportunidade até clicar para entrar no trade.',
    minChars: 50,
    aiRubric: `Sub-dimensão: Decision Mode (Classificação: S/D/I — Systematic/Discretionary/Intuitive).
ÂNCORAS DE SCORE:
- 80-100 (S — Systematic): Descreve sequência estruturada e repetível: verifica condições objetivas (ex: "confirmo RSI no 4H, volume acima da média, suporte testado"), checklist mental ou escrito, critérios de entrada/saída definidos antes de abrir. Tempo de análise consistente. Sem menção de "feeling" ou intuição.
- 60-79 (D — Discretionary): Framework presente mas com ajustes por contexto. "Geralmente sigo meu setup mas considero o contexto do dia." Regras existem mas são flexibilizadas. Mistura de análise e julgamento.
- 30-59 (I — Intuitive): Processo descrito de forma vaga ou baseado em reconhecimento de padrão sem critérios objetivos. "Vejo o gráfico e sinto quando é hora de entrar." "Experiência me diz quando está certo." Ausência de checklist.
- <30 (I severa): Entrada impulsiva descrita como processo. "Vejo uma oportunidade e entro logo para não perder." Zero critério objetivo. Red flag: descreve análise mas menciona velocidade de decisão incompatível com análise real.

CONSTRUCTOS DO FRAMEWORK (TPI — Trader Personality Indicator): Decision Mode é o preditor mais forte de consistência. Systematic traders têm edge replicável; Intuitive traders dependem de estado mental que varia. Buscar hesitação na descrição — aluno que hesita ao descrever o processo provavelmente não tem processo definido.

CROSS-CHECK OPE-01: Se aluno marcou "checklist objetivo" (score 90) mas descreve processo vago ou baseado em feeling, flag CLOSED_VS_OPEN obrigatório.`,
    crossCheckWith: ['OPE-01'],
  },
  {
    id: 'OPE-07',
    dimension: 'operational',
    subDimension: 'strategy_fit',
    type: 'open',
    text: 'Quando sua estratégia passa por um período ruim (2-3 semanas sem resultado), o que você faz?',
    minChars: 50,
    aiRubric: `Sub-dimensão: Strategy Fit / Consistência (Classificação: por comportamento sob adversidade).
ÂNCORAS DE SCORE:
- 80-100 (Resiliência com dados): Aluno descreve processo baseado em evidências: "analiso o que mudou no mercado vs. na minha execução", "revejo as últimas X operações para identificar se é execução ou estratégia", "reduzo o tamanho para preservar capital enquanto estudo". Mantém a estratégia e ajusta com dados. Distingue "estratégia ruim" de "execução ruim".
- 55-79 (Resiliência parcial): Mantém a estratégia mas sem processo analítico claro. "Continuo e confio que vai melhorar." Perseverança sem diagnóstico.
- 30-54 (Strategy-hopping iminente): Descreve inquietação, vontade de mudar, busca por nova estratégia. "Começo a questionar se a estratégia funciona." "Procuro outros setups." Reação emocional à adversidade temporária.
- <30 (Strategy-hopping confirmado): "Mudo de estratégia quando não está funcionando." Ou descreve ter mudado múltiplas vezes em períodos adversos. Incapacidade de distinguir drawdown normal de estratégia quebrada.

CONSTRUCTOS DO FRAMEWORK — Stage Indicator: Strategy consistency é gate obrigatório para Stage 3 (8+ semanas sem mudança). Trader que muda estratégia sob pressão está em Stage 1-2. Buscar "hypothesis-chasing": trader que acredita que a próxima estratégia vai resolver o problema estrutural.

CROSS-CHECK OPE-03: Se aluno marcou "mesmo há 12+ meses" (score 92) mas descreve mudança de estratégia em períodos ruins, flag CLOSED_VS_OPEN obrigatório.`,
    crossCheckWith: ['OPE-03'],
  },
  {
    id: 'OPE-08',
    dimension: 'operational',
    subDimension: 'tracking',
    type: 'open',
    text: 'Qual é a coisa que mais atrapalha seu trading no dia a dia? Não o mercado — algo sobre VOCÊ ou sua rotina.',
    minChars: 50,
    aiRubric: `Sub-dimensão: Tracking / Auto-consciência Operacional (Classificação: por profundidade de auto-conhecimento).
ÂNCORAS DE SCORE:
- 80-100 (Alta auto-consciência): Identifica friction point específico e interno com precisão: "minha rotina matinal inconsistente me faz entrar sem preparo", "FOMO em notícias me faz operar fora do meu horário", "cansaço do trabalho impacta minha tomada de decisão após as 17h". Atribui o problema a si mesmo, não ao mercado.
- 55-79 (Consciência parcial): Identifica algo interno mas de forma vaga: "às vezes fico impaciente", "disciplina é meu maior desafio". Reconhece o problema sem especificidade.
- 30-54 (Externalização disfarçada): Identifica problema interno mas em linguagem que externaliza: "o mercado é muito imprevisível para minha estratégia", "meu horário de trabalho não combina com o mercado". O obstáculo real é externo.
- <30 (Sem auto-consciência): Não identifica nada interno ("nada, estou bem"), ou lista problemas técnicos/externos exclusivamente, ou a resposta evita completamente a premissa da pergunta ("não sobre o mercado — sobre VOCÊ").

CONSTRUCTOS DO FRAMEWORK: Esta pergunta mede auto-consciência operacional — capacidade de identificar friction points pessoais que afetam a performance. Trader em Stage 1 não consegue responder porque não observa a si mesmo. Stage 3+ tem lista de friction points catalogada.

NÃO há cross-check direto — esta pergunta é âncora de auto-consciência operacional.`,
    crossCheckWith: [],
  },
];

// ============================================================
// DIMENSÃO EXPERIÊNCIA (6 perguntas: 4 fechadas + 2 abertas)
// ============================================================

const EXPERIENCE_QUESTIONS = [
  {
    id: 'EXP-01',
    dimension: 'experience',
    subDimension: 'timeline',
    type: 'closed',
    text: 'Há quanto tempo você opera com dinheiro real?',
    options: [
      { id: 'EXP-01-A', text: 'Mais de 5 anos', score: 85 },
      { id: 'EXP-01-B', text: '2-5 anos', score: 65 },
      { id: 'EXP-01-C', text: '1-2 anos', score: 45 },
      { id: 'EXP-01-D', text: '6-12 meses', score: 28 },
      { id: 'EXP-01-E', text: 'Menos de 6 meses', score: 12 },
    ],
  },
  {
    id: 'EXP-02',
    dimension: 'experience',
    subDimension: 'strategy_stability',
    type: 'closed',
    text: 'Quantas vezes você mudou sua estratégia principal no último ano?',
    options: [
      { id: 'EXP-02-A', text: '0 — mesma estratégia, apenas refinamentos', score: 90 },
      { id: 'EXP-02-B', text: '1 vez, por motivo justificado', score: 72 },
      { id: 'EXP-02-C', text: '2-3 vezes', score: 45 },
      { id: 'EXP-02-D', text: '4+ vezes', score: 22 },
      { id: 'EXP-02-E', text: 'Não consigo definir uma "estratégia principal"', score: 8 },
    ],
  },
  {
    id: 'EXP-03',
    dimension: 'experience',
    subDimension: 'metacognition',
    type: 'closed',
    text: 'Quantos padrões de erro recorrentes seus você consegue listar, com trigger e solução?',
    options: [
      { id: 'EXP-03-A', text: '4+ com detalhes, triggers, e mecanismos de prevenção', score: 90 },
      { id: 'EXP-03-B', text: '3, consigo descrever trigger e solução', score: 72 },
      { id: 'EXP-03-C', text: '1-2, identifico mas não tenho solução clara', score: 45 },
      { id: 'EXP-03-D', text: 'Sei que erro mas não consigo categorizar', score: 22 },
      { id: 'EXP-03-E', text: 'Não acho que tenho erros recorrentes', score: 8 },
    ],
  },
  {
    id: 'EXP-04',
    dimension: 'experience',
    subDimension: 'analytical_sophistication',
    type: 'closed',
    text: 'Quais dessas métricas você acompanha regularmente?',
    options: [
      { id: 'EXP-04-A', text: 'Win rate, RR, drawdown, Sharpe, MFE/MAE', score: 92 },
      { id: 'EXP-04-B', text: 'Win rate, RR, drawdown', score: 68 },
      { id: 'EXP-04-C', text: 'Win rate e P&L', score: 42 },
      { id: 'EXP-04-D', text: 'Só P&L total', score: 20 },
      { id: 'EXP-04-E', text: 'Não acompanho métricas', score: 5 },
    ],
  },
  {
    id: 'EXP-05',
    dimension: 'experience',
    subDimension: 'evolution_awareness',
    type: 'open',
    text: 'Como seu trading mudou nos últimos 6 meses? O que você faz diferente hoje?',
    minChars: 50,
    aiRubric: `Sub-dimensão: Evolution Awareness / Stage Indicator (Stage 1-5).
ÂNCORAS DE SCORE:
- 80-100 (Stage 3-4): Aluno descreve mudanças concretas, mensuráveis e direcionais: "passei a usar stop em 100% dos trades", "reduzi o número de operações de 20 para 5 por dia", "implementei journal diário com emoções", "meu payoff subiu de 0.8 para 1.4". Mudança é específica, datável e com impacto verificável.
- 55-79 (Stage 2-3): Descreve mudanças mas de forma vaga: "estou mais disciplinado", "aprendi a controlar melhor as emoções", "opero com mais cuidado". Direção positiva mas sem evidência concreta. Pode estar descrevendo aspiração em vez de mudança real.
- 30-54 (Stage 2): Descreve mudança de estratégia como evolução: "mudei para outra estratégia que funciona melhor". Confunde hypothesis-chasing com desenvolvimento. Ou descreve mudanças circunstanciais ("passei a operar menos porque tive menos tempo").
- <30 (Stage 1): Não consegue identificar mudança específica: "continuo o mesmo", "estou sempre melhorando" (sem exemplos), ou descreve regresso: "estava bem mas parei". Red flag: diz que mudou mas a mudança descrita é superficial ou contraditória com outras respostas.

CONSTRUCTOS DO FRAMEWORK — Stage Indicators: Stage 2 (Reactive): mudanças mensais, reconhece alguns padrões de erro, inconsistente. Stage 3 (Methodical): mudanças baseadas em dados, estratégia estável ≥6 meses, journal com emoções. Stage 4 (Professional): mudanças estratégicas apenas, métricas avançadas.

NÃO há cross-check direto — esta pergunta é âncora de consciência evolutiva e stage.`,
    crossCheckWith: [],
  },
  {
    id: 'EXP-06',
    dimension: 'experience',
    subDimension: 'edge_articulation',
    type: 'open',
    text: 'Se alguém te perguntasse "por que VOCÊ ganha dinheiro no mercado?" — o que responderia?',
    minChars: 50,
    aiRubric: `Sub-dimensão: Edge Articulation / Stage Indicator (Stage 3+ gate).
PERGUNTA DIAGNÓSTICA DE STAGE: Trader que não consegue articular seu edge está provavelmente em Stage 1-2. É o maior preditor de Stage 3+.
ÂNCORAS DE SCORE:
- 80-100 (Edge articulado — Stage 3-4): Resposta específica, verificável e baseada em vantagem real: "ganho porque identifico divergências entre volume e preço em rompimentos no WINFUT", "minha vantagem é disciplina de risco — perco menos que a média quando erro", "edge é execução consistente num setup específico que backtestei". Edge é nomeável, replicável, não dependente de sorte.
- 55-79 (Edge parcialmente articulado — Stage 2-3): Descreve algo que parece edge mas vago: "sou bom em ler o mercado", "tenho experiência no meu ativo", "sei identificar oportunidades". Pode ser edge real mas não articulado com precisão.
- 30-54 (Sem edge claro — Stage 2): Resposta baseada em características pessoais sem conexão com vantagem real: "sou paciente", "estudo muito", "sou disciplinado". Disciplina não é edge — é pré-requisito. Ou confunde estratégia com edge.
- <30 (Stage 1 — sem edge): "Não sei", "ainda estou aprendendo", ou descreve edge como sorte/feeling: "tenho bom instinto", "leio bem o mercado quando está favorável". Honestidade do "não sei" vale 35-45 — melhor que construir justificativa falsa.

CONSTRUCTOS DO FRAMEWORK (Steenbarger): Edge quantification é marco de Stage 4. Trader que não sabe por que ganha não sabe o que replicar. Red flag: "ganho porque sou esforçado" = atribui resultado a esforço, não a vantagem estrutural — common en Stage 1-2.

NÃO há cross-check direto — esta pergunta é gate diagnóstico de stage.`,
    crossCheckWith: [],
  },
];

// ============================================================
// EXPORTS & HELPERS
// ============================================================

/**
 * Catálogo completo, ordenado por dimensão e sequência.
 * Total: 34 perguntas (22 fechadas + 12 abertas)
 */
export const ALL_QUESTIONS = [
  ...EMOTIONAL_QUESTIONS,
  ...FINANCIAL_QUESTIONS,
  ...OPERATIONAL_QUESTIONS,
  ...EXPERIENCE_QUESTIONS,
];

/** Agrupamentos por dimensão */
export const QUESTIONS_BY_DIMENSION = {
  emotional: EMOTIONAL_QUESTIONS,
  financial: FINANCIAL_QUESTIONS,
  operational: OPERATIONAL_QUESTIONS,
  experience: EXPERIENCE_QUESTIONS,
};

/** Lookup rápido por ID */
export const QUESTION_MAP = Object.fromEntries(
  ALL_QUESTIONS.map((q) => [q.id, q])
);

/** Contadores para validação */
export const QUESTION_COUNTS = {
  total: ALL_QUESTIONS.length,
  closed: ALL_QUESTIONS.filter((q) => q.type === 'closed').length,
  open: ALL_QUESTIONS.filter((q) => q.type === 'open').length,
  byDimension: {
    emotional: EMOTIONAL_QUESTIONS.length,
    financial: FINANCIAL_QUESTIONS.length,
    operational: OPERATIONAL_QUESTIONS.length,
    experience: EXPERIENCE_QUESTIONS.length,
  },
};

/**
 * Retorna o score oculto de uma opção selecionada.
 * BACKEND-ONLY — nunca expor ao frontend.
 * 
 * @param {string} questionId - Ex: 'EMO-01'
 * @param {string} optionId - Ex: 'EMO-01-A'
 * @returns {number|null} Score ou null se não encontrado
 */
export function getOptionScore(questionId, optionId) {
  const question = QUESTION_MAP[questionId];
  if (!question || question.type !== 'closed') return null;
  const option = question.options.find((o) => o.id === optionId);
  return option ? option.score : null;
}

/**
 * Retorna IDs das opções de uma pergunta fechada (para randomização).
 * Não inclui scores — seguro para frontend.
 * 
 * @param {string} questionId
 * @returns {Array<{id: string, text: string}>} Opções sem score
 */
export function getOptionsForDisplay(questionId) {
  const question = QUESTION_MAP[questionId];
  if (!question || question.type !== 'closed') return [];
  return question.options.map(({ id, text }) => ({ id, text }));
}

/**
 * Retorna perguntas de uma sub-dimensão específica.
 * 
 * @param {string} dimension - 'emotional', 'financial', etc.
 * @param {string} subDimension - 'recognition', 'discipline', etc.
 * @returns {Array} Perguntas filtradas
 */
export function getQuestionsBySubDimension(dimension, subDimension) {
  return (QUESTIONS_BY_DIMENSION[dimension] || []).filter(
    (q) => q.subDimension === subDimension
  );
}
