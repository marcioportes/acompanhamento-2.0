/**
 * OpenConversationsNotice.jsx — aviso na Etapa 8 do fechamento (#497).
 *
 * Lista os trades do ciclo com conversa de feedback em aberto (Revisado / Dúvida).
 * Só avisa: o selo segue liberado, e a conversa continua possível depois dele.
 * `onOpenTrade` ausente (mentor no painel dele) → sem o atalho "Abrir".
 */

import React from 'react';
import { MessageCircle, ArrowRight } from 'lucide-react';
import { fmtDayMonth } from '../../utils/cycleClosure/openConversations';

const STATUS_TEXT = {
  REVIEWED: 'Revisado — falta você encerrar',
  QUESTION: 'Dúvida — aguardando o mentor',
};

export default function OpenConversationsNotice({ trades = [], onOpenTrade }) {
  if (!trades.length) return null;
  const n = trades.length;

  return (
    <div className="glass-card p-6 border border-amber-500/40 bg-amber-500/5" data-testid="open-conversations-notice">
      <div className="flex items-start gap-3">
        <MessageCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-amber-100 mb-1">
            {n === 1
              ? '1 trade deste ciclo ainda tem conversa em aberto'
              : `${n} trades deste ciclo ainda têm conversa em aberto`}
          </h4>
          <p className="text-xs text-slate-400 mb-3">
            Você pode selar mesmo assim — depois do selo, a conversa continua liberada; só os dados do trade ficam travados.
          </p>
          <ul className={`space-y-1 ${n > 5 ? 'max-h-48 overflow-y-auto pr-1' : ''}`}>
            {trades.map((t) => (
              <li key={t.id} className="flex items-center gap-3 text-xs bg-slate-800/40 rounded-lg px-3 py-2">
                <span className="font-mono text-slate-300 w-12 flex-shrink-0">{fmtDayMonth(t.date)}</span>
                <span className="font-mono text-slate-200 w-20 flex-shrink-0 truncate">{t.ticker || '—'}</span>
                <span className="flex-1 text-slate-400 truncate">{STATUS_TEXT[t.status] || t.status}</span>
                {onOpenTrade && (
                  <button
                    type="button"
                    onClick={() => onOpenTrade(t)}
                    className="flex items-center gap-1 text-amber-300 hover:text-amber-200 flex-shrink-0"
                  >
                    Abrir <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
