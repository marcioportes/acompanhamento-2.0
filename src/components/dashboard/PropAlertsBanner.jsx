/**
 * PropAlertsBanner
 * @version 1.0.0 (v1.27.0)
 * @description Banner persistente no topo do dashboard quando há alertas
 *   vermelhos (DD_NEAR, ACCOUNT_BUST, DAILY_LOSS_HIT) em contas PROP.
 *   Não dismissível. Mentor e aluno veem.
 *
 * Ref: issue #134 Fase B, epic #52
 */

import { AlertTriangle, Shield } from 'lucide-react';
import VERSION from '../../version';

const PropAlertsBanner = ({ dangerAlerts, firmName, productName }) => {
  if (!dangerAlerts || dangerAlerts.length === 0) return null;

  return (
    <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-3.5 h-3.5 text-red-400" />
            <span className="text-xs font-bold text-red-400 uppercase tracking-wider">
              Alerta Prop Firm
            </span>
            {(firmName || productName) && (
              <span className="text-xs text-red-400/60">
                — {firmName}{productName ? ` ${productName}` : ''}
              </span>
            )}
          </div>
          <div className="space-y-1">
            {dangerAlerts.map((alert, i) => (
              <p key={i} className="text-sm text-red-300">{alert.text}</p>
            ))}
          </div>
        </div>
      </div>
      {/* DebugBadge embedded */}
      <div className="text-right opacity-50 text-[10px] font-mono text-slate-600 select-none mt-1">
        PropAlertsBanner • {VERSION.display}
      </div>
    </div>
  );
};

export default PropAlertsBanner;
