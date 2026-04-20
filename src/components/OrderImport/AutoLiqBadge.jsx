/**
 * AutoLiqBadge.jsx
 * @version 1.0.0 (v1.37.0 — issue #156 Fase C)
 * @description Badge visual compacto para operações com AutoLiq detectado.
 *   Sinaliza evento de sistema (liquidação forçada da corretora) — não é decisão
 *   do aluno. Usado no ConversationalOpCard quando classification === 'autoliq'
 *   e em telas que listam operações com classificação persistida.
 *
 * Prerrogativa de descarte do aluno é preservada no fluxo que consome o badge —
 * o badge só informa, não decide.
 */

import { AlertTriangle } from 'lucide-react';
import DebugBadge from '../DebugBadge';

/**
 * @param {Object} props
 * @param {string} [props.label] — override do texto (default: "Evento de sistema — AutoLiq detectado")
 * @param {boolean} [props.compact] — reduz padding/tamanho da fonte para uso em listagens densas
 * @param {boolean} [props.withDebugBadge] — renderiza DebugBadge embedded (default: false; ConversationalOpCard já renderiza um)
 */
const AutoLiqBadge = ({
  label = 'Evento de sistema — AutoLiq detectado',
  compact = false,
  withDebugBadge = false,
}) => {
  const padding = compact ? 'px-1.5 py-0.5' : 'px-2 py-1';
  const fontSize = compact ? 'text-[10px]' : 'text-xs';

  return (
    <>
      <span
        role="status"
        aria-label="AutoLiq detectado"
        className={`inline-flex items-center gap-1 ${padding} rounded border bg-red-500/10 text-red-400 border-red-500/30 ${fontSize} font-mono`}
        data-testid="autoliq-badge"
      >
        <AlertTriangle className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        {label}
      </span>
      {withDebugBadge && <DebugBadge component="AutoLiqBadge" embedded />}
    </>
  );
};

export default AutoLiqBadge;
