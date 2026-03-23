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
    aiRubric: 'IA busca: latência de reconhecimento, nomeação de emoção, externalização vs. internalização',
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
    aiRubric: 'IA busca: regulação vs. impulsividade, aceitação vs. negação, mecanismos de coping',
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
    aiRubric: 'IA busca: linguagem de externalização vs. agency. "O mercado me pegou" vs. "Eu entrei sem setup"',
    crossCheckWith: ['EMO-09'],
  },
  {
    id: 'EMO-12',
    dimension: 'emotional',
    subDimension: 'locus',
    type: 'open',
    text: 'Se eu observasse você operando por uma semana sem você saber, o que eu veria que você talvez não admita?',
    minChars: 50,
    aiRubric: 'IA busca: profundidade de auto-conhecimento, honestidade, blind spots reconhecidos. Pergunta projetiva — dificulta gaming porque não tem "resposta certa" óbvia.',
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
    aiRubric: 'IA busca: trigger (FOMO, revenge, overconfidence), consequência, aprendizado',
    crossCheckWith: ['FIN-01'],
  },
  {
    id: 'FIN-07',
    dimension: 'financial',
    subDimension: 'loss_management',
    type: 'open',
    text: 'Conte em detalhe sobre seu pior período (drawdown). Como começou, o que você fez, e como parou?',
    minChars: 50,
    aiRubric: 'IA busca: decisão deliberada vs. acidental, reflexão honesta, agency',
    crossCheckWith: ['FIN-02'],
  },
  {
    id: 'FIN-08',
    dimension: 'financial',
    subDimension: 'loss_management',
    type: 'open',
    text: 'Complete a frase: "Para mim, tomar um loss é..."',
    minChars: 50,
    aiRubric: 'IA busca: aceitação ("custo do negócio") vs. aversão ("inaceitável") vs. negação ("evitável"). Pergunta projetiva — formato de completar frase reduz racionalização.',
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
    aiRubric: 'IA busca: systematic vs. discretionary vs. intuitive; presença de checklist; hesitação',
    crossCheckWith: ['OPE-01'],
  },
  {
    id: 'OPE-07',
    dimension: 'operational',
    subDimension: 'strategy_fit',
    type: 'open',
    text: 'Quando sua estratégia passa por um período ruim (2-3 semanas sem resultado), o que você faz?',
    minChars: 50,
    aiRubric: 'IA busca: resiliência vs. strategy-hopping; uso de dados vs. reação emocional',
    crossCheckWith: ['OPE-03'],
  },
  {
    id: 'OPE-08',
    dimension: 'operational',
    subDimension: 'tracking',
    type: 'open',
    text: 'Qual é a coisa que mais atrapalha seu trading no dia a dia? Não o mercado — algo sobre VOCÊ ou sua rotina.',
    minChars: 50,
    aiRubric: 'IA busca: auto-consciência, honestidade, capacidade de identificar friction points',
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
    aiRubric: 'IA busca: consciência de evolução, mudanças concretas vs. vagas, direction of change',
    crossCheckWith: [],
  },
  {
    id: 'EXP-06',
    dimension: 'experience',
    subDimension: 'edge_articulation',
    type: 'open',
    text: 'Se alguém te perguntasse "por que VOCÊ ganha dinheiro no mercado?" — o que responderia?',
    minChars: 50,
    aiRubric: 'IA busca: capacidade de articular edge; "meu edge é..." (claro) vs. "eu sou bom em..." (vago) vs. "não sei" (honesto). Pergunta de Stage 3+: quem não consegue responder está provavelmente em Stage 1-2.',
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
