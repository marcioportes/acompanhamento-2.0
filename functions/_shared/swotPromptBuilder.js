/**
 * swotPromptBuilder.js — builder de prompt da SWOT semanal customizável (#262, metade-semanal).
 *
 * Puro (sem firebase-*): recebe o `swotStyle` do mentor (mentorConfig/{uid}.swotStyle)
 * e devolve as diretivas que modulam o SYSTEM prompt da generateWeeklySwot — tom, foco
 * e profundidade. Estilo global por mentor (MVP). Eixos neutros (=2) não adicionam nada
 * (retrocompatível com o prompt atual).
 *
 * swotStyle = { tone: 1|2|3, focus: 1|2|3, depth: 1|2|3 }
 *   tone : 1 direto/franco   · 2 equilibrado · 3 acolhedor/encorajador
 *   focus: 1 comportamental   · 2 equilibrado · 3 técnico/performance
 *   depth: 1 conciso          · 2 padrão      · 3 detalhado
 */

const SWOT_STYLE_AXES = ['tone', 'focus', 'depth'];
const SWOT_STYLE_DEFAULT = { tone: 2, focus: 2, depth: 2 };

/** Garante {tone,focus,depth} ∈ {1,2,3}; valores inválidos caem no neutro (2). */
const clampSwotStyle = (style) => {
  const out = { ...SWOT_STYLE_DEFAULT };
  if (style && typeof style === 'object') {
    for (const axis of SWOT_STYLE_AXES) {
      const v = style[axis];
      if (v === 1 || v === 2 || v === 3) out[axis] = v;
    }
  }
  return out;
};

const DIRECTIVES = {
  tone: {
    1: 'TOM: direto e franco. Aponte problemas sem suavizar; vá ao ponto, sem rodeios.',
    3: 'TOM: acolhedor e encorajador. Reconheça o esforço e o progresso antes de apontar correções.',
  },
  focus: {
    1: 'FOCO: priorize o comportamento e a execução emocional (tilt, revenge, hesitação, disciplina) acima das métricas de performance.',
    3: 'FOCO: priorize a performance técnica (RR, win rate, gestão de risco, qualidade dos setups) acima do lado emocional.',
  },
  depth: {
    1: 'PROFUNDIDADE: seja conciso — no máximo 2 itens por quadrante, frases curtas e cirúrgicas.',
    3: 'PROFUNDIDADE: seja detalhado — 3 a 4 itens por quadrante, nomeando o mecanismo específico observado em cada um.',
  },
};

/**
 * Diretivas (linhas de instrução) para os eixos não-neutros do estilo.
 * @param {Object} style — swotStyle (será clampado)
 * @returns {string[]}
 */
const buildStyleDirectives = (style) => {
  const s = clampSwotStyle(style);
  const lines = [];
  for (const axis of SWOT_STYLE_AXES) {
    const d = DIRECTIVES[axis]?.[s[axis]];
    if (d) lines.push(d);
  }
  return lines;
};

/**
 * Compõe o SYSTEM prompt base com o bloco de estilo do mentor. Quando todos os eixos
 * são neutros, retorna o base intacto (sem ruído).
 * @param {string} baseSystemPrompt
 * @param {Object} style
 * @returns {string}
 */
const buildStyledSystemPrompt = (baseSystemPrompt, style) => {
  const directives = buildStyleDirectives(style);
  if (directives.length === 0) return baseSystemPrompt;
  return `${baseSystemPrompt}

ESTILO DEFINIDO PELO MENTOR (respeite à risca, sem alterar o schema de saída):
- ${directives.join('\n- ')}`;
};

module.exports = {
  SWOT_STYLE_AXES,
  SWOT_STYLE_DEFAULT,
  clampSwotStyle,
  buildStyleDirectives,
  buildStyledSystemPrompt,
};
