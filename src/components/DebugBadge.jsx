/**
 * DebugBadge
 * @description Badge de identificação visual para debug em produção
 *   Compacto por padrão, expande ao clicar mostrando info detalhada
 * @see version.js para versão do produto
 * 
 * USO:
 *   import DebugBadge from '../components/DebugBadge';
 *   <DebugBadge component="NomeDaPagina" />
 * 
 * REGRA: Toda tela/página nova ou modificada DEVE incluir este badge
 */

import { useState } from 'react';
import VERSION from '../version';

const DebugBadge = ({ component, embedded = false }) => {
  const [expanded, setExpanded] = useState(false);

  const buildDate = VERSION.build
    ? `${VERSION.build.slice(6,8)}/${VERSION.build.slice(4,6)}/${VERSION.build.slice(0,4)}`
    : '-';

  const positionClass = embedded
    ? 'relative mt-1 flex justify-end pr-2 pb-1 opacity-50 select-none cursor-pointer'
    : `fixed bottom-2 right-2 z-50 select-none cursor-pointer ${expanded ? '' : 'opacity-60 hover:opacity-100'}`;

  return (
    <div
      className={positionClass}
      onClick={() => setExpanded(!expanded)}
    >
      {expanded ? (
        <div className="bg-slate-900/95 border border-slate-700 rounded-lg p-3 text-xs font-mono shadow-xl backdrop-blur-sm min-w-[240px]">
          <div className="text-slate-300 font-semibold mb-2 text-[13px] flex items-center justify-between">
            <span>🔍 Debug Info</span>
            <span className="text-[11px] text-slate-500 hover:text-slate-300">✕</span>
          </div>
          <div className="space-y-1.5 text-[12px]">
            <div className="flex justify-between">
              <span className="text-slate-500">Componente</span>
              <span className="text-blue-400 font-semibold">{component}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Produto</span>
              <span className="text-emerald-400 font-semibold">{VERSION.display}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Build</span>
              <span className="text-slate-300">{VERSION.build}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Data Build</span>
              <span className="text-slate-300">{buildDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">SemVer</span>
              <span className="text-slate-300">{VERSION.full}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900/80 border border-slate-700/50 rounded px-2.5 py-1 text-[11px] font-mono text-slate-500 hover:text-slate-300 hover:border-slate-600 transition-all">
          {component} • {VERSION.display}
        </div>
      )}
    </div>
  );
};

export default DebugBadge;
