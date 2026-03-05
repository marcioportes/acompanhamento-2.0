/**
 * GaugeChart
 * @version 7.0.0 (v1.17.0)
 * @description Wrapper do react-d3-speedometer para progresso bidirecional.
 *   Escala: [-stopVal ... 0 ... +goalVal]
 *   Segmentos: vermelho (loss) → verde (gain)
 *   Needle aponta para o P&L atual.
 *
 * DEPENDÊNCIA: npm install react-d3-speedometer
 *
 * USAGE:
 *   <GaugeChart pnl={463} goalVal={1600} stopVal={1200} fmt={fmt} />
 */

import ReactSpeedometer from 'react-d3-speedometer';

const fmtK = (v) => {
  const a = Math.abs(v || 0);
  if (a >= 1e6) return `${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${(a / 1e3).toFixed(a % 1e3 === 0 ? 0 : 1)}k`;
  return a.toFixed(0);
};

/**
 * @param {number} pnl - P&L atual
 * @param {number} goalVal - Meta absoluta
 * @param {number} stopVal - Stop absoluto
 * @param {Function} [fmt] - Currency formatter
 * @param {string} [className]
 */
const GaugeChart = ({
  pnl = 0,
  goalVal = 0,
  stopVal = 0,
  fmt,
  className = '',
}) => {
  // Garantir valores mínimos para a escala
  const safeStop = Math.max(stopVal, 1);
  const safeGoal = Math.max(goalVal, 1);

  // Escala: de -stopVal até +goalVal
  const minVal = -safeStop;
  const maxVal = safeGoal;

  // Clamp o valor dentro da escala (com margem de 10%)
  const clampedValue = Math.max(minVal * 1.1, Math.min(maxVal * 1.1, pnl));

  // Segmentos: vermelho escuro → vermelho → amarelo → verde → verde escuro
  // Com parada customizada no zero
  const segmentStops = [minVal, minVal * 0.5, 0, maxVal * 0.5, maxVal];
  const segmentColors = ['#dc2626', '#f97316', '#eab308', '#84cc16', '#10b981'];

  // Labels customizadas — 4 segmentos (stops.length - 1)
  const segmentLabels = [
    { text: `-${fmtK(safeStop)}`, position: 'OUTSIDE', color: '#ef4444', fontSize: '10px' },
    { text: '0', position: 'OUTSIDE', color: '#64748b', fontSize: '10px' },
    { text: '', position: 'OUTSIDE', color: 'transparent' },
    { text: `+${fmtK(safeGoal)}`, position: 'OUTSIDE', color: '#10b981', fontSize: '10px' },
  ];

  // Texto central: valor formatado + percentual
  const pct = pnl >= 0
    ? (safeGoal > 0 ? Math.round((pnl / safeGoal) * 100) : 0)
    : (safeStop > 0 ? Math.round((Math.abs(pnl) / safeStop) * 100) : 0);
  const pnlText = fmt ? fmt(pnl) : `${pnl >= 0 ? '+' : ''}${fmtK(pnl)}`;
  const valueText = `${pnlText}  (${pct}% ${pnl >= 0 ? 'meta' : 'stop'})`;

  return (
    <div className={`w-full flex justify-center ${className}`}>
      <ReactSpeedometer
        forceRender={true}
        minValue={minVal}
        maxValue={maxVal}
        value={clampedValue}
        customSegmentStops={segmentStops}
        segmentColors={segmentColors}
        customSegmentLabels={segmentLabels}
        currentValueText={valueText}
        needleColor="#e2e8f0"
        needleTransitionDuration={800}
        needleTransition="easeElastic"
        needleHeightRatio={0.7}
        ringWidth={20}
        textColor="#94a3b8"
        valueTextFontSize="11px"
        valueTextFontWeight="bold"
        labelFontSize="9px"
        width={220}
        height={140}
        paddingHorizontal={5}
        paddingVertical={5}
      />
    </div>
  );
};

export default GaugeChart;
