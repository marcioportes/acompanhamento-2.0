/**
 * StudentsListTab.jsx
 *
 * Aba "Alunos" da SubscriptionsPage (caminho α de #263). Lista 100% dos
 * /students sem filtro do classifyStudent — inclui órfãos, fantasmas, ex-alunos
 * e VIPs. Permite ao mentor regularizar registros via drawer master/detail.
 *
 * Filtros: Todos / Com Auth / Sem Auth / Bloqueados / Sem sub.
 * Tabela compacta: avatar · nome+email · planos ativos · estado · click → drawer.
 */

import React, { useMemo, useState } from 'react';
import { Search, X, UserCheck, UserX, Lock, AlertCircle, Pencil } from 'lucide-react';
import { lacksAuthUser, getAccessStatus, ACCESS_STATUS_CONFIG } from '../../utils/studentClassify';
import StudentDetailDrawer from './StudentDetailDrawer';
import { formatWhatsappDisplay } from '../../utils/whatsappValidation';

const ENDED = new Set(['cancelled', 'expired']);

const planLabel = (plan) => plan === 'self_service' ? 'Espelho' : plan === 'alpha' ? 'Alpha' : plan === 'vip' ? 'VIP' : plan;
const planPill = (plan) => {
  if (plan === 'alpha') return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
  if (plan === 'self_service') return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
  if (plan === 'vip') return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
};

export default function StudentsListTab({ students, subscriptions, loading }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | withAuth | noAuth | blocked | noSub
  // Drawer guarda só o id; o student renderizado é derivado de students[] (real-time),
  // pra que mudanças via callable (bloqueio, edit) reflitam no drawer sem fechar/reabrir.
  const [selectedId, setSelectedId] = useState(null);

  // subs ativas por studentId (não-cancelled/expired)
  const activeSubsByStudent = useMemo(() => {
    const map = new Map();
    for (const sub of subscriptions ?? []) {
      if (ENDED.has(sub.status)) continue;
      const arr = map.get(sub.studentId) ?? [];
      arr.push(sub);
      map.set(sub.studentId, arr);
    }
    return map;
  }, [subscriptions]);

  const enriched = useMemo(() => {
    return (students ?? []).map((s) => {
      const subs = activeSubsByStudent.get(s.id) ?? [];
      const plans = [...new Set(subs.map((x) => x.plan).filter(Boolean))];
      return {
        ...s,
        _hasAuth: !lacksAuthUser(s),
        _accessStatus: getAccessStatus(s),
        _isBlocked: Boolean(s.loginBlocked),
        _activeSubs: subs,
        _activePlans: plans,
      };
    });
  }, [students, activeSubsByStudent]);

  const counts = useMemo(() => ({
    all: enriched.length,
    withAuth: enriched.filter((s) => s._hasAuth).length,
    noAuth: enriched.filter((s) => !s._hasAuth).length,
    blocked: enriched.filter((s) => s._isBlocked).length,
    noSub: enriched.filter((s) => s._activeSubs.length === 0).length,
  }), [enriched]);

  const filtered = useMemo(() => {
    let list = enriched;
    if (filter === 'withAuth') list = list.filter((s) => s._hasAuth);
    else if (filter === 'noAuth') list = list.filter((s) => !s._hasAuth);
    else if (filter === 'blocked') list = list.filter((s) => s._isBlocked);
    else if (filter === 'noSub') list = list.filter((s) => s._activeSubs.length === 0);

    const term = search.trim().toLowerCase();
    if (term) {
      list = list.filter((s) => (
        (s.name ?? '').toLowerCase().includes(term)
        || (s.email ?? '').toLowerCase().includes(term)
        || (s.whatsappNumber ?? '').includes(term)
        || s.id.toLowerCase().includes(term)
      ));
    }
    return list;
  }, [enriched, filter, search]);

  if (loading) {
    return <p className="text-slate-500 text-sm">Carregando alunos…</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros + busca */}
      <div className="flex flex-col gap-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por nome, email, celular ou id..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-9 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-white hover:bg-slate-700/50 rounded-md transition-colors"
              aria-label="Limpar busca"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[
            { value: 'all',      label: 'Todos',         count: counts.all },
            { value: 'withAuth', label: 'Com Auth',      count: counts.withAuth },
            { value: 'noAuth',   label: 'Sem Auth',      count: counts.noAuth },
            { value: 'blocked',  label: 'Bloqueados',    count: counts.blocked },
            { value: 'noSub',    label: 'Sem sub ativa', count: counts.noSub },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors ${
                filter === f.value
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-slate-700/30'
              }`}
            >
              {f.label}
              <span className="text-[10px] opacity-70">({f.count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tabela */}
      <div className="glass-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Nenhum aluno bate com o filtro.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-800/50">
                <th className="px-4 py-2 text-left font-semibold">Nome</th>
                <th className="px-4 py-2 text-left font-semibold">Contato</th>
                <th className="px-4 py-2 text-left font-semibold">Plano(s) ativo(s)</th>
                <th className="px-4 py-2 text-left font-semibold">Estado</th>
                <th className="px-4 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const accessCfg = ACCESS_STATUS_CONFIG[s._accessStatus];
                return (
                  <tr
                    key={s.id}
                    onClick={() => setSelectedId(s.id)}
                    className="border-b border-slate-800/30 hover:bg-slate-800/30 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {s._hasAuth
                          ? <UserCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" title="Tem Auth" />
                          : <UserX className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" title="Sem Auth (não passou pelo ritual)" />}
                        <span className="text-sm text-white">
                          {s.name || <span className="italic text-slate-500">(sem nome)</span>}
                        </span>
                        {s._isBlocked && <Lock className="w-3 h-3 text-red-400" title="Login bloqueado" />}
                        {s._activeSubs.length === 0 && (
                          <AlertCircle className="w-3 h-3 text-amber-400" title="Sem sub ativa — possível órfão" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-slate-400">
                      <div className="font-mono truncate max-w-[220px]">{s.email || <span className="italic text-slate-500">(sem email)</span>}</div>
                      {s.whatsappNumber && <div className="text-slate-500 mt-0.5">{formatWhatsappDisplay(s.whatsappNumber)}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {s._activePlans.length === 0 ? (
                        <span className="text-[11px] italic text-slate-500">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {s._activePlans.map((p) => (
                            <span key={p} className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium border ${planPill(p)}`}>
                              {planLabel(p)}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${accessCfg.pill}`}>
                        {s._isBlocked ? 'login bloqueado' : accessCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Pencil className="w-3.5 h-3.5 text-slate-500 inline-block" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <div className="px-4 py-2 text-[11px] text-slate-500 border-t border-slate-800/50">
          {filtered.length} de {enriched.length} aluno{enriched.length === 1 ? '' : 's'}
        </div>
      </div>

      {/* Drawer compartilhado — student derivado de students[] real-time */}
      {selectedId && (() => {
        const live = (students ?? []).find((s) => s.id === selectedId);
        if (!live) return null;
        return (
          <StudentDetailDrawer
            student={live}
            subscriptions={subscriptions}
            onClose={() => setSelectedId(null)}
            onAfterDelete={() => setSelectedId(null)}
          />
        );
      })()}
    </div>
  );
}
