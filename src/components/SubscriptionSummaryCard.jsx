/**
 * SubscriptionSummaryCard
 * @description Card semaforo de assinaturas para o dashboard do mentor
 * @see version.js para versão do produto
 *
 * CHANGELOG:
 * - 1.1.0: Integração com useSubscriptions — dados reais do Firestore (issue #094)
 * - 1.0.0: Card inicial com mock data (issue #094)
 */

import { CreditCard, CheckCircle, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import { useSubscriptions } from '../hooks/useSubscriptions';

const SubscriptionSummaryCard = ({ onNavigate }) => {
  const { summary, loading } = useSubscriptions();
  const { active, expiringSoon, overdue } = summary;

  if (loading) {
    return (
      <div className="glass-card p-4 flex items-center justify-center h-[140px]">
        <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div
      onClick={onNavigate}
      className="glass-card p-4 cursor-pointer hover:border-slate-600 transition-all group"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-blue-400" />
          <h3 className="text-sm font-semibold text-white">Assinaturas</h3>
        </div>
        <span className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors">
          Ver detalhes →
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {/* Ativos */}
        <div className="text-center">
          <div className="w-8 h-8 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-1">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-lg font-bold text-emerald-400">{active}</p>
          <p className="text-[10px] text-slate-500">Ativos</p>
        </div>

        {/* Vencendo */}
        <div className="text-center">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-1 ${
            expiringSoon > 0 ? 'bg-amber-500/15' : 'bg-slate-800'
          }`}>
            <Clock className={`w-4 h-4 ${expiringSoon > 0 ? 'text-amber-400' : 'text-slate-600'}`} />
          </div>
          <p className={`text-lg font-bold ${expiringSoon > 0 ? 'text-amber-400' : 'text-slate-600'}`}>{expiringSoon}</p>
          <p className="text-[10px] text-slate-500">Vencendo</p>
        </div>

        {/* Inadimplentes */}
        <div className="text-center">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-1 ${
            overdue > 0 ? 'bg-red-500/15' : 'bg-slate-800'
          }`}>
            <AlertTriangle className={`w-4 h-4 ${overdue > 0 ? 'text-red-400' : 'text-slate-600'}`} />
          </div>
          <p className={`text-lg font-bold ${overdue > 0 ? 'text-red-400' : 'text-slate-600'}`}>{overdue}</p>
          <p className="text-[10px] text-slate-500">Inadimplentes</p>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionSummaryCard;
