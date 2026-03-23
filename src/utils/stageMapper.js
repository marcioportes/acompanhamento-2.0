/**
 * stageMapper.js
 * 
 * Prepara payload de evidências para diagnóstico de stage pela IA (DEC-021).
 * 
 * O stage NÃO é calculado por fórmula aritmética. Os 6 inputs (EXP-01 a EXP-06)
 * são evidências que a IA usa para diagnosticar em qual dos 5 estágios de maturidade
 * (Chaos → Reactive → Methodical → Professional → Mastery) o trader se encontra.
 * 
 * A CF `generateAssessmentReport` recebe este payload + as descrições dos estágios
 * como rubrica e retorna o stage diagnosticado com justificativa.
 * 
 * @version 1.0.0 — CHUNK-09 Fase A
 */

import { getOptionScore, QUESTION_MAP } from './assessmentQuestions.js';

// ============================================================
// STAGE DESCRIPTIONS (do trader_evolution_framework Parte 5)
// Usadas como rubrica para a IA diagnosticar o stage.
// ============================================================

export const STAGE_RUBRIC = {
  1: {
    label: 'CHAOS',
    typicalMonths: '0-6 meses',
    characteristics: [
      'Sem estratégia definida; experimenta tudo',
      'Trades baseados em FOMO, tips, ou feeling',
      'Journal inconsistente ou inexistente',
      'Drawdowns imprevisíveis; recuperação por sorte',
    ],
    behavioralIndicators: [
      'Strategy changes weekly',
      'Violates risk rules regularly (>30%)',
      'Blames market, not self',
      'No post-trade analysis',
    ],
    metrics: {
      winRate: '<40%',
      avgRatio: '<1.0',
      maxDrawdown: '>20%',
      ruleViolations: '>30%',
    },
    scoreRange: '<30',
  },
  2: {
    label: 'REACTIVE',
    typicalMonths: '6-18 meses',
    characteristics: [
      'Embrião de sistema; regras soltas',
      'Mudança de estratégia lenta (mensal)',
      'Journal básico (datas, entradas, saídas; sem análise)',
      'Reações imediatas a perdas; ajustes ad-hoc',
      'Começa a reconhecer padrões próprios de erro',
    ],
    behavioralIndicators: [
      'Mantém estratégia por 3-4 semanas, depois muda se "não funciona"',
      'Journaling presente mas superficial',
      'Reconhece alguns padrões; repetição inconsistente',
      'Risk rules existem mas violadas sob stress (10-20%)',
    ],
    metrics: {
      winRate: '45-50%',
      avgRatio: '1.0-1.2',
      maxDrawdown: '12-18%',
      ruleViolations: '10-20%',
    },
    scoreRange: '30-50',
  },
  3: {
    label: 'METHODICAL',
    typicalMonths: '18-24+ meses',
    characteristics: [
      'Sistema definido, documentado, testado (backtest ou 3+ months live)',
      'Estratégia estável; ajustes apenas por dados',
      'Journal completo: entrada, exit, emoções, análise',
      'Reconhece triggers emocionais; implementa guardrails',
      'Win rate vs. R:R consciente; otimiza ratio',
    ],
    behavioralIndicators: [
      'Mantém estratégia por 6+ meses; ajustes baseados em stats',
      'Daily journal with emotional tracking',
      'Identifica e evita 3+ padrões recorrentes',
      'Risk rules violation <5% of trades',
    ],
    metrics: {
      winRate: '50-60%',
      avgRatio: '1.5-2.5+',
      maxDrawdown: '5-12%',
      ruleViolations: '<5%',
    },
    scoreRange: '50-75',
  },
  4: {
    label: 'PROFESSIONAL',
    typicalMonths: '24-60 meses',
    characteristics: [
      'Sistema robusto; testado em múltiplos market conditions',
      'Diversificação: múltiplas estratégias ou timeframes',
      'Advanced journaling: MFE/MAE, Sharpe ratio, edge identification',
      'Emoção sob controle; raramente viola rules',
      'Dados dirigem decisões; atua como gestor de capital próprio',
    ],
    behavioralIndicators: [
      'Estratégia estável por 1+ anos; ajustes estratégicos apenas',
      'Advanced metrics tracking; predictive analysis',
      'Identifica e quantifica edge; conhece vencedor % vs. esperado',
      'Zero rule violations; automated guardrails',
    ],
    metrics: {
      winRate: '55-70%',
      avgRatio: '2.0-3.5+',
      maxDrawdown: '<5%',
      ruleViolations: '<1%',
    },
    scoreRange: '75-90',
  },
  5: {
    label: 'MASTERY',
    typicalMonths: '60+ meses',
    characteristics: [
      'Múltiplos livros de estratégias; cross-asset proficiency',
      'Systematic coaching capacity; documenta aprendizados',
      'Emoção desacoplada de outcome; foco obsessivo em processo',
      'Contribui knowledge back (mentoring, writing, research)',
      'Adaptação ao mercado sem mudança de core principles',
    ],
    behavioralIndicators: [
      'Trading quase como "breathing"; executada sem stress',
      'Documentação de pesquisa; contínua inovação dentro framework',
      'Zero emotional trading incidents',
      'Scaling: capital cresce, strategy estável, multiple income streams',
    ],
    metrics: {
      winRate: '55-75%',
      avgRatio: '2.5-4.0+',
      maxDrawdown: '<3%',
      ruleViolations: '~0%',
    },
    scoreRange: '90-100',
  },
};

// ============================================================
// EVIDENCE EXTRACTION
// ============================================================

/**
 * Extrai evidências das respostas de experiência (EXP-01 a EXP-06).
 * 
 * @param {Array} responses - Todas as respostas do aluno
 * @returns {Object} Evidências estruturadas para diagnóstico
 */
export function extractExperienceEvidence(responses) {
  const rMap = {};
  for (const r of responses) {
    if (r.questionId?.startsWith('EXP-')) {
      rMap[r.questionId] = r;
    }
  }

  const evidence = {
    // EXP-01: Tempo de experiência
    timeline: {
      questionId: 'EXP-01',
      score: null,
      selectedText: null,
    },
    // EXP-02: Mudanças de estratégia
    strategyStability: {
      questionId: 'EXP-02',
      score: null,
      selectedText: null,
    },
    // EXP-03: Identificação de erros
    metacognition: {
      questionId: 'EXP-03',
      score: null,
      selectedText: null,
    },
    // EXP-04: Métricas acompanhadas
    analyticalSophistication: {
      questionId: 'EXP-04',
      score: null,
      selectedText: null,
    },
    // EXP-05: Evolução recente (aberta)
    evolutionAwareness: {
      questionId: 'EXP-05',
      aiScore: null,
      aiClassification: null,
      text: null,
    },
    // EXP-06: Articulação de edge (aberta)
    edgeArticulation: {
      questionId: 'EXP-06',
      aiScore: null,
      aiClassification: null,
      text: null,
    },
  };

  // Fechadas: extrair score + texto da opção selecionada
  for (const [key, field] of [
    ['EXP-01', 'timeline'],
    ['EXP-02', 'strategyStability'],
    ['EXP-03', 'metacognition'],
    ['EXP-04', 'analyticalSophistication'],
  ]) {
    const resp = rMap[key];
    if (resp && resp.type === 'closed') {
      evidence[field].score = getOptionScore(key, resp.selectedOption);
      const question = QUESTION_MAP[key];
      if (question) {
        const opt = question.options.find((o) => o.id === resp.selectedOption);
        evidence[field].selectedText = opt ? opt.text : null;
      }
    }
  }

  // Abertas: extrair aiScore + texto
  for (const [key, field] of [
    ['EXP-05', 'evolutionAwareness'],
    ['EXP-06', 'edgeArticulation'],
  ]) {
    const resp = rMap[key];
    if (resp && resp.type === 'open') {
      evidence[field].aiScore = resp.aiScore ?? null;
      evidence[field].aiClassification = resp.aiClassification ?? null;
      evidence[field].text = resp.text ?? null;
    }
  }

  return evidence;
}

// ============================================================
// PAYLOAD FOR CF
// ============================================================

/**
 * Prepara payload completo para a CF `generateAssessmentReport` diagnosticar o stage.
 * 
 * A CF recebe:
 * - evidence: dados estruturados das 6 perguntas EXP
 * - rubric: descrição dos 5 estágios (para o prompt da IA)
 * - otherDimensionScores: scores já calculados das outras dimensões (contexto)
 * 
 * @param {Array} responses - Todas as respostas do aluno
 * @param {Object} otherScores - { emotional, financial, operational } já calculados
 * @returns {Object} Payload pronto para a CF
 */
export function prepareStagePayload(responses, otherScores = {}) {
  const evidence = extractExperienceEvidence(responses);

  return {
    evidence,
    rubric: STAGE_RUBRIC,
    context: {
      emotionalScore: otherScores.emotional?.score ?? null,
      emotionalProfile: otherScores.emotional
        ? (otherScores.emotional.score >= 85 ? 'SAGE'
          : otherScores.emotional.score >= 65 ? 'LEARNER'
          : otherScores.emotional.score >= 50 ? 'DEVELOPING'
          : 'FRAGILE')
        : null,
      financialScore: otherScores.financial?.score ?? null,
      operationalScore: otherScores.operational?.score ?? null,
    },
    instructions: `Dado as evidências das 6 perguntas de experiência e os scores das outras dimensões, 
diagnostique em qual dos 5 estágios de maturidade (1-CHAOS, 2-REACTIVE, 3-METHODICAL, 4-PROFESSIONAL, 5-MASTERY) 
este trader se encontra. Use pattern-matching com as características e indicadores de cada estágio.

Regras:
- Tempo (EXP-01) é condição necessária mas NÃO suficiente. 5 anos com zero metacognição não é Stage 4.
- Strategy stability (EXP-02) é o indicador mais discriminante entre stages.
- Edge articulation (EXP-06) é assinatura de Stage 3+. Quem não articula está provavelmente em 1-2.
- Um aluno com emocional FRAGILE dificilmente está em Stage 3+ independente do tempo.
- Em caso de sinais conflitantes, priorize o indicador mais fraco (cap conservador).

Retorne JSON: { "stage": number, "confidence": number (0-1), "justification": string, "keySignals": string[] }`,
  };
}
