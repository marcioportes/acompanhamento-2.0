/**
 * src/utils/maturityEngine/constants.js
 *
 * Constantes do motor de maturidade 4D × 5 stages (issue #119).
 *
 * Task 03: STAGE_BASES, STAGE_NAMES.
 * Task 04: GATES_BY_TRANSITION (catálogo literal da §3.1 D9).
 * Task 05: STAGE_WINDOWS, COMPOSITE_WEIGHTS, ENGINE_VERSION.
 */

// Pontuação base por stage atual (§3.1 D3). Componente principal de M.
export const STAGE_BASES = {
  1: 0,
  2: 20,
  3: 40,
  4: 60,
  5: 80,
};

// PT-BR — INV-06 aplicada a labels de UI. Consistente com BaselineReport.jsx
// e com profileClassifier.js (faixas de experience stage). Backend mantém
// identificadores numéricos (1..5) — tradução é só de apresentação.
export const STAGE_NAMES = {
  1: 'Caos',
  2: 'Reativo',
  3: 'Metódico',
  4: 'Profissional',
  5: 'Maestria',
};

// Labels curtos usados em telas estreitas (mobile) e layout de barra compacta.
// Consumido pelo MaturityProgressionCard (§3.1 D13). Backend não consome.
export const STAGE_NAMES_SHORT = {
  1: 'Caos',
  2: 'Reat.',
  3: 'Métod.',
  4: 'Prof.',
  5: 'Maestr.',
};

/**
 * Catálogo de gates por transição (§3.1 D9 literal).
 *
 * Ordem preservada conforme tabela do control file — determinística para UI.
 * Chaves: `${stageAtual}-${stageProximo}`. Stage 5 (Mastery) não tem transição.
 *
 * Schema de cada gate:
 *   { id, label, dim, metric, op, threshold, friendlyLabel, unit, whatIs, howTo }
 *
 * Campos pedagógicos (R2.B11):
 *   - friendlyLabel: nome humano (sem sigla técnica) — usado no header do card
 *   - unit: '%' | 'R' | 'pts' | 'meses' | 'semanas' | '' — pra renderizar valor
 *   - whatIs: 1 linha PT-BR explicando o conceito ao aluno
 *   - howTo: 1 frase com ação concreta pra atingir
 */
export const GATES_BY_TRANSITION = {
  '1-2': [
    {
      id: 'maxdd-under-20', label: 'MaxDD < 20%',
      friendlyLabel: 'Queda máxima do capital abaixo de 20%', unit: '%',
      whatIs: 'A maior queda que seu capital teve no período. Mede até onde você foi pra trás antes de recuperar.',
      howTo: 'Respeitar o stop diário e o stop do ciclo. Um trade ruim deixa de virar 3 quando você para no plano.',
      dim: 'fin', metric: 'maxDDPercent', op: '<=', threshold: 20,
    },
    {
      id: 'rule-compliance-80', label: 'Compliance ≥ 80%',
      friendlyLabel: 'Disciplina (regras respeitadas) em 80% dos trades', unit: '%',
      whatIs: 'Quantos trades terminaram dentro das regras pré-definidas (risco máximo, RR alvo, stop).',
      howTo: 'Antes de mandar a ordem, conferir: SL definido? risco dentro do plano? RR ≥ alvo? Três cliques.',
      dim: 'op', metric: 'complianceRate', op: '>=', threshold: 80,
    },
    {
      id: 'emotional-out-of-fragile', label: 'Emocional ≥ 30',
      friendlyLabel: 'Sair da faixa frágil (score emocional ≥ 30)', unit: 'pts',
      whatIs: 'Mede sua resposta emocional ao trading. Abaixo de 30 = frágil, reativo às oscilações.',
      howTo: 'Diário emocional pré-trade. Pausa de 15min após qualquer dia com tilt. Pular trade quando não estiver pronto.',
      dim: 'emo', metric: 'E', op: '>=', threshold: 30,
    },
    {
      id: 'basic-journal', label: 'Journal em 50%+ dos trades',
      friendlyLabel: 'Anotar contexto em pelo menos metade dos trades', unit: '%',
      whatIs: 'Quantos trades têm nota no diário com o porquê da entrada e como você se sentia.',
      howTo: 'Uma frase por trade já basta: "entrei porque X, estava sentindo Y". Sem nota = sem aprendizado depois.',
      dim: 'op', metric: 'journalRate', op: '>=', threshold: 0.50,
    },
    {
      id: 'stop-usage', label: 'Stop em 80%+ dos trades',
      friendlyLabel: 'Stop-loss definido em 80% dos trades', unit: '%',
      whatIs: 'Quantos trades começaram com SL claro. Sem SL = sem limite de perda.',
      howTo: 'Stop é commit pré-trade: define antes de mandar a ordem. Não mudar depois.',
      dim: 'fin', metric: 'stopUsageRate', op: '>=', threshold: 0.80,
    },
    {
      id: 'plan-linked-trades', label: 'Plan-linked ≥ 70%',
      friendlyLabel: 'Pelo menos 70% dos trades atrelados a um plano', unit: '%',
      whatIs: 'Trade fora de plano = decisão impulsiva. Plan-linked = você sabia o que estava fazendo antes de entrar.',
      howTo: 'Selecionar o plano sempre que registrar trade. Trades soltos viram exceção, não regra.',
      dim: 'op', metric: 'planAdherence', op: '>=', threshold: 70,
    },
    {
      id: 'rule-violation-rate-30', label: 'Padrões de risco ≤ 30%',
      friendlyLabel: 'Padrões comportamentais em no máximo 30% dos trades', unit: '%',
      whatIs: 'Fração dos seus trades com algum padrão de risco (revenge, overtrading, sub-sizing…). Quanto menor, mais limpo o processo.',
      howTo: 'Cada card de Comportamento diz o que corrigir no trade. Corrija um padrão por vez: a janela rola, os trades ruins saem, os limpos entram e a taxa cai.',
      dim: 'op', metric: 'ruleViolationRate', op: '<=', threshold: 0.30,
    },
  ],
  '2-3': [
    {
      id: 'emotional-55', label: 'Emocional ≥ 55',
      friendlyLabel: 'Score emocional acima da faixa reativa (≥ 55)', unit: 'pts',
      whatIs: 'Acima de 55 você já não reage por impulso na maioria das situações.',
      howTo: 'Manter pausa após losses. Não operar dias em que percebe tilt antes do mercado abrir.',
      dim: 'emo', metric: 'E', op: '>=', threshold: 55,
    },
    {
      id: 'financial-solid', label: 'Financial ≥ 70 (SOLID)',
      friendlyLabel: 'Score financeiro sólido (≥ 70)', unit: 'pts',
      whatIs: 'Combina drawdown controlado, payoff positivo e consistência de resultado.',
      howTo: 'Foco na gestão de risco antes de buscar performance. Drawdown abaixo do stop, payoff acima de 1.',
      dim: 'fin', metric: 'F', op: '>=', threshold: 70,
    },
    {
      id: 'operational-65', label: 'Operacional ≥ 65',
      friendlyLabel: 'Score operacional médio (≥ 65)', unit: 'pts',
      whatIs: 'Mede aderência ao plano, qualidade de execução e disciplina nas ordens.',
      howTo: 'Compliance, journal e plan-linked acima do mínimo. Execução consistente.',
      dim: 'op', metric: 'O', op: '>=', threshold: 65,
    },
    {
      id: 'strategy-8-weeks', label: '8 semanas sem trocar estratégia',
      friendlyLabel: 'Manter a mesma estratégia por 8 semanas', unit: 'semanas',
      whatIs: 'Trocar de estratégia toda hora = nunca acumular dados pra avaliar edge. Constância testa o sistema.',
      howTo: 'Só mudar estratégia depois de fechar ciclo com avaliação clara. Não trocar no calor do prejuízo.',
      dim: 'op', metric: 'strategyConsWks', op: '>=', threshold: 8,
    },
    {
      id: 'journal-90', label: 'Journal ≥ 90%',
      friendlyLabel: 'Anotar contexto em 90% dos trades', unit: '%',
      whatIs: 'Quase todos os trades com nota. Base sólida pra padrões emergirem.',
      howTo: 'Mesma regra: 1 frase. Setup, sentimento, decisão.',
      dim: 'op', metric: 'journalRate', op: '>=', threshold: 0.90,
    },
    {
      id: 'compliance-95', label: 'Compliance ≥ 95%',
      friendlyLabel: 'Disciplina muito alta (≥ 95% dos trades dentro das regras)', unit: '%',
      whatIs: 'Quase zero violações. Mostra que regras são compromisso, não sugestão.',
      howTo: 'Gate na entrada: app barra se RO > limite ou RR < alvo. Quebrar regra = fechar plataforma.',
      dim: 'op', metric: 'complianceRate', op: '>=', threshold: 95,
    },
    {
      id: 'winrate-45', label: 'Win rate ≥ 45%',
      friendlyLabel: 'Taxa de acerto (vitórias) acima de 45%', unit: '%',
      whatIs: 'Quantos % dos trades terminaram positivos. Sozinho não basta — precisa olhar junto com o payoff.',
      howTo: 'Foco em setups com edge testado. Sair só por gatilho de saída, não por medo.',
      dim: 'fin', metric: 'winRate', op: '>=', threshold: 45,
    },
    {
      id: 'payoff-1_2', label: 'Payoff ≥ 1.2',
      friendlyLabel: 'Ganho médio 1,2× maior que perda média', unit: '',
      whatIs: 'Vitória vale R$X, derrota vale R$Y. Payoff = X/Y. Acima de 1,2 = ganhos compensam perdas com folga.',
      howTo: 'Deixar vencedores rodarem até o alvo. Cortar perdedores rápido no SL — não esticar.',
      dim: 'fin', metric: 'payoff', op: '>=', threshold: 1.2,
    },
    {
      id: 'rule-violation-rate-15', label: 'Padrões de risco ≤ 15%',
      friendlyLabel: 'Padrões comportamentais em no máximo 15% dos trades', unit: '%',
      whatIs: 'Fração dos seus trades com algum padrão de risco. Na faixa metódica, o processo fica consistente — poucos lapsos.',
      howTo: 'Os padrões recorrentes (revenge, overtrading) são os que mais pesam. Atacar os de severidade Alta primeiro derruba a taxa mais rápido.',
      dim: 'op', metric: 'ruleViolationRate', op: '<=', threshold: 0.15,
    },
  ],
  '3-4': [
    {
      id: 'emotional-75', label: 'Emocional ≥ 75',
      friendlyLabel: 'Score emocional metódico (≥ 75)', unit: 'pts',
      whatIs: 'Faixa onde decisões são fundamentalmente racionais, com regulação consistente.',
      howTo: 'Rotina de pré-trade firme. Sair imediatamente quando perceber tilt — sem racionalizar "mais um trade".',
      dim: 'emo', metric: 'E', op: '>=', threshold: 75,
    },
    {
      id: 'financial-fortified', label: 'Financial ≥ 85 (FORTIFIED)',
      friendlyLabel: 'Score financeiro forte (≥ 85)', unit: 'pts',
      whatIs: 'Drawdown pequeno, payoff alto, consistência semanal. Gestão de risco em outro nível.',
      howTo: 'Reduzir size em sequências negativas. Aumentar só quando há margem clara (Kelly Quarter).',
      dim: 'fin', metric: 'F', op: '>=', threshold: 85,
    },
    {
      id: 'operational-80', label: 'Operacional ≥ 80',
      friendlyLabel: 'Score operacional alto (≥ 80)', unit: 'pts',
      whatIs: 'Execução praticamente sem ruído — quase tudo dentro do plano.',
      howTo: 'Compliance ≥ 95%, journal ≥ 95%, zero stop tampering. Execução é ofício, não tentativa.',
      dim: 'op', metric: 'O', op: '>=', threshold: 80,
    },
    {
      id: 'strategy-12-months', label: '12 meses sem trocar estratégia',
      friendlyLabel: 'Manter a mesma estratégia por 12 meses', unit: 'meses',
      whatIs: 'Edge se prova com ciclos longos. 12 meses cobrem regimes diferentes — boom, correção, lateral.',
      howTo: 'Refinar parâmetros sim, trocar paradigma não. Mudança de estratégia exige fundamentação documentada.',
      dim: 'op', metric: 'strategyConsMonths', op: '>=', threshold: 12,
    },
    {
      id: 'advanced-metrics', label: 'MEP/MEN/Sharpe rastreados',
      friendlyLabel: 'Métricas avançadas (MEP/MEN/Sharpe) sendo registradas', unit: '',
      whatIs: 'MEP = quanto o trade chegou a render no melhor momento. MEN = quanto chegou a perder. Sharpe = estabilidade do retorno. Trader profissional acompanha esses 3.',
      howTo: 'Importar dados de ordens (CSV completo). MEP e MEN saem direto das execuções. Sharpe é cálculo automático.',
      dim: 'op', metric: 'advancedMetricsPresent', op: '==', threshold: true,
    },
    {
      id: 'compliance-100', label: 'Compliance = 100% nos últimos 100',
      friendlyLabel: 'Zero violações nos últimos 100 trades', unit: '%',
      whatIs: 'Disciplina total numa janela grande. Nenhuma exceção, nenhuma "só dessa vez".',
      howTo: 'Gates no app barram entrada fora do plano. Mentor revisa qualquer violação imediatamente.',
      dim: 'op', metric: 'complianceRate100', op: '>=', threshold: 100,
    },
    {
      id: 'winrate-55', label: 'Win rate ≥ 55%',
      friendlyLabel: 'Taxa de acerto acima de 55%', unit: '%',
      whatIs: 'Mais da metade dos trades positivos. Sinal forte de edge, especialmente combinado com payoff alto.',
      howTo: 'Foco em qualidade de setup. Pular dias sem oportunidade clara — não forçar entradas.',
      dim: 'fin', metric: 'winRate', op: '>=', threshold: 55,
    },
    {
      id: 'payoff-2', label: 'Payoff ≥ 2.0',
      friendlyLabel: 'Ganho médio 2× maior que perda média', unit: '',
      whatIs: 'Cada R$1 perdido foi compensado por R$2 ganho. Trader profissional tem essa razão como base.',
      howTo: 'Alvo escalonado (saída parcial). Stop curto na entrada. Trail dinâmico após pegar metade do alvo.',
      dim: 'fin', metric: 'payoff', op: '>=', threshold: 2.0,
    },
    {
      id: 'maxdd-5', label: 'MaxDD ≤ 5%',
      friendlyLabel: 'Queda máxima do capital até 5%', unit: '%',
      whatIs: 'Capital nunca caiu mais que 5% no período. Margem de segurança grande pra continuar operando com clareza.',
      howTo: 'Stop diário em 1-2%. Stop do ciclo em 5%. Reduzir size em sequências negativas.',
      dim: 'fin', metric: 'maxDDPercent', op: '<=', threshold: 5,
    },
    {
      id: 'sharpe-1_2', label: 'Sharpe mensal ≥ 1.2',
      friendlyLabel: 'Estabilidade do retorno mensal (Sharpe ≥ 1.2)', unit: '',
      whatIs: 'Sharpe mede retorno por unidade de risco. ≥ 1.2 = ganhos consistentes, não dependem de meses de sorte.',
      howTo: 'Reduzir variância: tamanho de posição uniforme, evitar trades fora do setup base, manter rotina.',
      dim: 'fin', metric: 'monthlySharpe', op: '>=', threshold: 1.2,
    },
    // Issue #208 — gates comportamentais de execução. Métrica `null` quando
    // <30 trades com order data linked (DEC-AUTO-208-03 — sample insuficiente
    // → METRIC_UNAVAILABLE, não promove e não rebaixa, DEC-020 preservada).
    {
      id: 'no-stop-tampering', label: 'Sem stop tampering',
      friendlyLabel: 'Nunca mexer no stop depois de abrir o trade', unit: '',
      whatIs: 'Stop tampering = alterar o SL no meio do trade. Mostra que o limite pré-trade não estava firme — emoção dominou.',
      howTo: 'Stop é commit pré-trade: define antes da entrada e nunca move pra longe. Trail só pra perto quando trade está positivo.',
      dim: 'op', metric: 'stopTamperingCount', op: '==', threshold: 0,
    },
    {
      id: 'no-chase', label: 'Sem chase reentry',
      friendlyLabel: 'Não perseguir o preço após sair', unit: '',
      whatIs: 'Chase reentry = reentrar logo após stop, perseguindo o movimento que escapou. Sinal de FOMO, não de setup.',
      howTo: 'Após stop, aguardar 15min antes de considerar novo trade no mesmo ativo. Novo setup, nova decisão.',
      dim: 'op', metric: 'chaseCount', op: '==', threshold: 0,
    },
    {
      id: 'disciplined-sizing', label: 'Sizing de stop disciplinado',
      friendlyLabel: 'Não reduzir size do stop por desconforto', unit: '',
      whatIs: 'Sair de uma posição parcial só porque está incomodando = decisão emocional, não técnica.',
      howTo: 'Saída parcial só por trigger pré-definido (chegou no alvo 1, mudou contexto técnico). Nunca por ansiedade.',
      dim: 'op', metric: 'partialStopCount', op: '==', threshold: 0,
    },
    {
      id: 'rule-violation-rate-5', label: 'Padrões de risco ≤ 5%',
      friendlyLabel: 'Padrões comportamentais em no máximo 5% dos trades', unit: '%',
      whatIs: 'Quase nenhum trade com padrão de risco — disciplina de processo nível profissional.',
      howTo: 'Aqui o que sobra são lapsos pontuais. Revisar o Confronto Emocional dos poucos trades marcados fecha o gap.',
      dim: 'op', metric: 'ruleViolationRate', op: '<=', threshold: 0.05,
    },
  ],
  '4-5': [
    {
      id: 'emotional-85', label: 'Emocional ≥ 85 (SAGE)',
      friendlyLabel: 'Score emocional sage (≥ 85)', unit: 'pts',
      whatIs: 'Faixa de mestria emocional — equanimidade real, não esforço pra "manter a calma".',
      howTo: 'Rotina de meditação/respiração. Trabalho continuo de identificação dos próprios padrões emocionais.',
      dim: 'emo', metric: 'E', op: '>=', threshold: 85,
    },
    {
      id: 'financial-90', label: 'Financial ≥ 90',
      friendlyLabel: 'Score financeiro de elite (≥ 90)', unit: 'pts',
      whatIs: 'Gestão de risco em nível institucional. Drawdown pequeno mesmo em regimes adversos.',
      howTo: 'Sizing por Kelly Quarter. Hedge quando há concentração. Caixa preservado pra oportunidades.',
      dim: 'fin', metric: 'F', op: '>=', threshold: 90,
    },
    {
      id: 'payoff-2_5', label: 'Payoff ≥ 2.5',
      friendlyLabel: 'Ganho médio 2,5× maior que perda média', unit: '',
      whatIs: 'Cada vitória vale 2,5 derrotas em valor. Pode até ter WR < 50% e ainda ser muito lucrativo.',
      howTo: 'Alvo escalonado mais agressivo. Trail apenas quando o trade já pagou o risco. Stop curto.',
      dim: 'fin', metric: 'payoff', op: '>=', threshold: 2.5,
    },
    {
      id: 'winrate-55-stable', label: 'Win rate ≥ 55% em 100+ trades',
      friendlyLabel: 'Acerto ≥ 55% sustentado em pelo menos 100 trades', unit: '%',
      whatIs: 'Consistência estatística numa amostra grande. Não é sorte, é edge real.',
      howTo: 'Manter o setup que funciona, recusar trades fora dele. Volume vem da paciência.',
      dim: 'fin', metric: 'winRate', op: '>=', threshold: 55,
    },
    {
      id: 'maxdd-3', label: 'MaxDD ≤ 3%',
      friendlyLabel: 'Queda máxima do capital até 3%', unit: '%',
      whatIs: 'Capital nunca caiu mais que 3%. Performance institucional.',
      howTo: 'Stop diário em 1%. Pausa imediata após dois losses consecutivos. Hedge em regime adverso.',
      dim: 'fin', metric: 'maxDDPercent', op: '<=', threshold: 3,
    },
    {
      id: 'cv-low', label: 'CV consistência < 0.5',
      friendlyLabel: 'Coeficiente de variação dos retornos < 0.5', unit: '',
      whatIs: 'CV mede dispersão dos retornos mensais. Abaixo de 0,5 = retornos previsíveis, sem meses excepcionais que disfarçam meses ruins.',
      howTo: 'Sizing uniforme. Setup único e refinado. Operação mecânica nos critérios objetivos.',
      dim: 'fin', metric: 'cv', op: '<', threshold: 0.5,
    },
    {
      id: 'zero-tilt-revenge', label: 'Zero tilt/revenge 90 dias',
      friendlyLabel: 'Zero evento de tilt ou vingança em 90 dias', unit: '',
      whatIs: 'Nenhum episódio emocional registrado em 3 meses. Estabilidade absoluta.',
      howTo: 'Pausa antes que tilt se instale (após qualquer dia ruim). Não retomar até reset emocional completo.',
      dim: 'emo', metric: 'tiltRevengeCount', op: '==', threshold: 0,
    },
    {
      id: 'annual-return-15', label: 'Retorno anualizado ≥ 15%',
      friendlyLabel: 'Retorno anualizado de pelo menos 15%', unit: '%',
      whatIs: 'Retorno por ano calculado da curva real. Acima de 15% supera índices passivos com folga.',
      howTo: 'Sair de ciclos lucrativos preservando ganho — não devolver. Reinvestir com Kelly conservador.',
      dim: 'fin', metric: 'annualizedReturn', op: '>=', threshold: 15,
    },
    {
      id: 'sharpe-1_5', label: 'Sharpe anual ≥ 1.5',
      friendlyLabel: 'Sharpe anual ≥ 1.5 (retorno ajustado a risco de elite)', unit: '',
      whatIs: 'Sharpe ≥ 1.5 = retorno alto pra cada unidade de risco. Hedge fund de respeito tem essa faixa.',
      howTo: 'Sustentar drawdown baixo e retorno consistente simultaneamente. Volatilidade controlada é o caminho.',
      dim: 'fin', metric: 'annualSharpe', op: '>=', threshold: 1.5,
    },
    {
      id: 'rule-violation-rate-1', label: 'Padrões de risco ≤ 1%',
      friendlyLabel: 'Padrões comportamentais em no máximo 1% dos trades', unit: '%',
      whatIs: 'Processo praticamente sem lapsos — execução desacoplada da emoção (perfil Mastery).',
      howTo: 'Manutenção: o motor sinaliza qualquer recaída na hora; a janela rolando preserva a taxa perto de zero.',
      dim: 'op', metric: 'ruleViolationRate', op: '<=', threshold: 0.01,
    },
  ],
};

// §3.1 D1 — janela rolling por stage. W = max(últimos minTrades, últimos minDays).
// floorTrades é o piso mínimo para sparseSample=false (confidence sai de LOW).
export const STAGE_WINDOWS = {
  1: { minTrades: 20, minDays: 30, floorTrades: 5 },
  2: { minTrades: 30, minDays: 45, floorTrades: 5 },
  3: { minTrades: 50, minDays: 60, floorTrades: 5 },
  4: { minTrades: 80, minDays: 90, floorTrades: 5 },
  5: { minTrades: 100, minDays: 90, floorTrades: 5 },
};

// §3.1 D2 — pesos do score composto (E+F+O+M = 1).
export const COMPOSITE_WEIGHTS = {
  emotional: 0.25,
  financial: 0.25,
  operational: 0.20,
  maturity: 0.30,
};

// Versão do engine — gravada em snapshots (Fase B).
export const ENGINE_VERSION = '1.43.0-engine-a';
