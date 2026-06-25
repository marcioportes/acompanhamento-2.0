/**
 * swotStyle.js — eixos do estilo da SWOT semanal (#262), para a UI do mentor.
 *
 * Espelha functions/_shared/swotPromptBuilder.js: tom/foco/profundidade, escala 1..3,
 * neutro = 2. O builder server-side é a autoridade do prompt; aqui só labels/UX.
 */

export const SWOT_STYLE_DEFAULT = { tone: 2, focus: 2, depth: 2 };

export const SWOT_STYLE_AXES = [
  {
    key: 'tone',
    label: 'Tom',
    low: 'Direto',
    mid: 'Equilibrado',
    high: 'Acolhedor',
    help: 'Quão franco vs. encorajador é o texto.',
  },
  {
    key: 'focus',
    label: 'Foco',
    low: 'Comportamental',
    mid: 'Equilibrado',
    high: 'Técnico',
    help: 'Ênfase em execução emocional vs. performance técnica.',
  },
  {
    key: 'depth',
    label: 'Profundidade',
    low: 'Conciso',
    mid: 'Padrão',
    high: 'Detalhado',
    help: 'Quantidade de itens e detalhamento por quadrante.',
  },
];

export const labelForValue = (axis, v) => (v === 1 ? axis.low : v === 3 ? axis.high : axis.mid);

// Normaliza um swotStyle vindo do Firestore para a escala válida (defaults neutros).
export const normalizeSwotStyle = (style) => {
  const out = { ...SWOT_STYLE_DEFAULT };
  if (style && typeof style === 'object') {
    for (const k of ['tone', 'focus', 'depth']) {
      if ([1, 2, 3].includes(style[k])) out[k] = style[k];
    }
  }
  return out;
};
