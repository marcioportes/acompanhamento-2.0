/**
 * DebugBadge
 * @description Badge discreto de identificação visual para debug em produção
 *   Exibe nome do componente + versão do produto no canto inferior direito
 * @see version.js para versão do produto
 * 
 * USO:
 *   import DebugBadge from '../components/DebugBadge';
 *   <DebugBadge component="NomeDaPagina" />
 * 
 * REGRA: Toda tela/página nova ou modificada DEVE incluir este badge
 */

import VERSION from '../version';

const DebugBadge = ({ component }) => (
  <div className="fixed bottom-1 right-1 text-[9px] font-mono text-slate-700 opacity-30 hover:opacity-100 transition-opacity pointer-events-none z-50 select-none">
    {component} • {VERSION.display}+{VERSION.build}
  </div>
);

export default DebugBadge;
