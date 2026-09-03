/**
 * McDistribution.jsx — a distribuição real da projeção do próximo ciclo.
 *
 * Issue #418. Substitui o `McHistogram` inline do Step6Adjust, que desenhava 17
 * barras com altura derivada do ÍNDICE da barra (`Math.abs(i - bars/2)`) e
 * carregava o comentário "Distribuição estilizada — não temos os outcomes
 * brutos". Os outcomes sempre existiram; agora o motor devolve `histogram`.
 *
 * SVG e não divs porque as marcações verticais (zero, p10/p50/p90) precisam de
 * posição em coordenada de VALOR, não de índice de barra.
 */

import React from 'react';

// Uma unidade de viewBox por bin: elimina aritmética de escala no eixo x.
const VB_HEIGHT = 100;

export default function McDistribution({ histogram, p10, p50, p90, ariaSummary }) {
  if (!histogram || !Array.isArray(histogram.counts) || histogram.counts.length === 0) return null;

  const { bins, counts, min, max, binWidth } = histogram;
  const maxCount = counts.reduce((m, c) => (c > m ? c : m), 0);
  if (!maxCount) return null;

  // Posição de um valor no eixo x do viewBox. Distribuição colapsada num ponto
  // (binWidth 0, pool homogêneo) não tem escala — nada a marcar.
  const xOf = (v) => {
    if (!(binWidth > 0) || typeof v !== 'number' || !Number.isFinite(v)) return null;
    return ((v - min) / (max - min)) * bins;
  };

  const zeroX = min < 0 && max > 0 ? xOf(0) : null;
  const marks = [['p10', p10], ['p50', p50], ['p90', p90]]
    .map(([label, v]) => [label, xOf(v)])
    .filter(([, x]) => x !== null);

  return (
    <svg
      viewBox={`0 0 ${bins} ${VB_HEIGHT}`}
      preserveAspectRatio="none"
      className="w-full h-20"
      role="img"
      aria-label={ariaSummary || 'Distribuição dos cenários simulados para o próximo ciclo'}
    >
      {counts.map((c, i) => {
        // Bin vazio não renderiza — é o que faz a assimetria e a cauda
        // aparecerem. O desenho anterior forçava altura mínima em toda barra.
        if (!c) return null;
        const h = (c / maxCount) * VB_HEIGHT;
        const center = min + (i + 0.5) * binWidth;
        const cls = center < 0 ? 'fill-red-500/60' : 'fill-sky-500/70';
        return <rect key={i} x={i + 0.1} y={VB_HEIGHT - h} width={0.8} height={h} className={cls} />;
      })}

      {/* vectorEffect: sob preserveAspectRatio="none" a espessura sairia
          esticada no eixo x e fina no y. */}
      {zeroX !== null && (
        <line
          x1={zeroX} x2={zeroX} y1={0} y2={VB_HEIGHT}
          className="stroke-slate-400/70" strokeWidth={1} vectorEffect="non-scaling-stroke"
        />
      )}
      {marks.map(([label, x]) => (
        <line
          key={label}
          x1={x} x2={x} y1={VB_HEIGHT * 0.72} y2={VB_HEIGHT}
          className={label === 'p50' ? 'stroke-slate-200/80' : 'stroke-slate-500/70'}
          strokeWidth={1} strokeDasharray={label === 'p50' ? undefined : '3 3'}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}
