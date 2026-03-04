/**
 * ExtractEvents
 * @version 1.0.0 (v1.16.0)
 * @description Painel de eventos do extrato — compliance, emocional, state machine.
 *   Extraído do PlanLedgerExtract para modularização.
 */

import {
  Trophy, Skull, AlertTriangle, Flame, Zap,
  ShieldOff, ShieldAlert, Scale, Shield
} from 'lucide-react';

const fmtDate = (d) => { if (!d) return '-'; const [y, m, dd] = d.split('-'); return `${dd}/${m}`; };

const getEventIcon = (type) => {
  switch (type) {
    case 'GOAL_HIT': return <Trophy className="w-3.5 h-3.5 text-emerald-400" />;
    case 'STOP_HIT': return <Skull className="w-3.5 h-3.5 text-red-400" />;
    case 'TILT_DETECTED': case 'TILT': return <Flame className="w-3.5 h-3.5 text-orange-400" />;
    case 'REVENGE_DETECTED': case 'REVENGE': return <Zap className="w-3.5 h-3.5 text-red-400" />;
    case 'STATUS_CRITICAL': return <AlertTriangle className="w-3.5 h-3.5 text-red-400" />;
    case 'RO_FORA': return <ShieldOff className="w-3.5 h-3.5 text-amber-400" />;
    case 'RR_FORA': return <Scale className="w-3.5 h-3.5 text-amber-400" />;
    case 'NO_STOP': return <ShieldAlert className="w-3.5 h-3.5 text-red-400" />;
    case 'CYCLE_GOAL_HIT': return <Trophy className="w-3.5 h-3.5 text-emerald-400" />;
    case 'CYCLE_STOP_HIT': return <Skull className="w-3.5 h-3.5 text-red-400" />;
    default: return <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />;
  }
};

const getEventStyle = (type) => {
  switch (type) {
    case 'GOAL_HIT': case 'CYCLE_GOAL_HIT': return 'bg-emerald-500/10 border-emerald-500/30';
    case 'STOP_HIT': case 'CYCLE_STOP_HIT': return 'bg-red-500/10 border-red-500/30';
    case 'TILT_DETECTED': case 'TILT': return 'bg-orange-500/10 border-orange-500/30';
    case 'REVENGE_DETECTED': case 'REVENGE': return 'bg-red-500/10 border-red-500/30';
    case 'STATUS_CRITICAL': return 'bg-red-500/10 border-red-500/30';
    case 'RO_FORA': case 'RR_FORA': return 'bg-amber-500/10 border-amber-500/30';
    case 'NO_STOP': return 'bg-red-500/10 border-red-500/30';
    default: return 'bg-yellow-500/10 border-yellow-500/30';
  }
};

/**
 * @param {Array} events - Eventos da state machine + compliance + emocional
 */
const ExtractEvents = ({ events }) => {
  if (!events || events.length === 0) return null;

  return (
    <div className="p-4 border-t border-slate-800 bg-slate-800/20 max-h-36 overflow-y-auto">
      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <Shield className="w-3.5 h-3.5" /> Eventos ({events.length})
      </h4>
      <div className="space-y-1.5">
        {events.map((evt, i) => (
          <div key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs ${getEventStyle(evt.type)}`}>
            {getEventIcon(evt.type)}
            <span className="text-slate-500 font-mono">{fmtDate(evt.date)} {evt.time || ''}</span>
            <span className="text-slate-300">{evt.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ExtractEvents;
