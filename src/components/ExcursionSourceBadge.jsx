/**
 * ExcursionSourceBadge.jsx — issue #187
 *
 * Badge compacto que indica a proveniência dos campos MEP/MEN em um trade.
 *   manual      → cinza   (aluno digitou)
 *   profitpro   → emerald (parser CSV ProfitPro)
 *   yahoo       → blue    (CF de enrichment via Yahoo Finance 1m)
 *   unavailable → amber   (broker não exporta + Yahoo fora da janela 7d)
 *   null        → null    (sem badge — trade sem dado nem tentativa)
 */

const STYLES = {
  manual: {
    label: 'manual',
    cls: 'bg-slate-700/60 text-slate-300 border-slate-600/50',
    title: 'MEP/MEN preenchidos manualmente pelo aluno',
  },
  profitpro: {
    label: 'profitpro',
    cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    title: 'MEP/MEN extraídos do CSV ProfitPro Performance',
  },
  yahoo: {
    label: 'yahoo',
    cls: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    title: 'MEP/MEN calculados via Yahoo Finance 1m OHLC (broker sem MEP/MEN nativo)',
  },
  unavailable: {
    label: 'indisponível',
    cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    title: 'MEP/MEN não disponíveis — broker não exportou e trade fora da janela 7d do Yahoo. Preencha manualmente se quiser progredir no gate Stage 3→4',
  },
};

export default function ExcursionSourceBadge({ source }) {
  if (!source || !STYLES[source]) return null;
  const { label, cls, title } = STYLES[source];
  return (
    <span
      className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border font-medium ${cls}`}
      title={title}
    >
      {label}
    </span>
  );
}

export { STYLES as EXCURSION_BADGE_STYLES };
