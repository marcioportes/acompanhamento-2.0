/**
 * ContactsSection — issue #237 F4
 *
 * Seção empilhada acima da tabela de Assinaturas em SubscriptionsPage.
 * Renderiza a collection canônica `contacts/` (cadastro mestre) com:
 *  - Stats (total, alpha, espelho, lead, ex, VIP, sem-email)
 *  - Filtros por status + busca textual
 *  - Tabela com nome, celular, email, status, origem
 *
 * Sem ações de write nesta v1 — modais e botões em próxima fase.
 * Linhas Alpha sem email recebem destaque (⚠ pendente — student não materializado).
 */

import { useMemo, useState } from 'react';
import { Users, Search, AlertCircle, Crown } from 'lucide-react';
import { useContacts } from '../../hooks/useContacts';
import DebugBadge from '../DebugBadge';

const STATUS_LABELS = {
  lead: 'Lead',
  espelho: 'Espelho',
  alpha: 'Alpha',
  ex: 'Ex',
};

const STATUS_THEME = {
  lead: 'amber',
  espelho: 'blue',
  alpha: 'emerald',
  ex: 'slate',
};

function formatPhone(e164) {
  if (!e164 || typeof e164 !== 'string') return '—';
  // +5521997118900 → +55 21 99711-8900
  if (e164.startsWith('+55') && e164.length === 14) {
    return `+55 ${e164.slice(3, 5)} ${e164.slice(5, 10)}-${e164.slice(10)}`;
  }
  if (e164.startsWith('+55') && e164.length === 13) {
    return `+55 ${e164.slice(3, 5)} ${e164.slice(5, 9)}-${e164.slice(9)}`;
  }
  if (e164.startsWith('+1') && e164.length === 12) {
    return `+1 (${e164.slice(2, 5)}) ${e164.slice(5, 8)}-${e164.slice(8)}`;
  }
  return e164;
}

function formatVencimento(subscription) {
  if (!subscription) return '—';
  if (subscription.isVIP) return '★ VIP';
  if (!subscription.endsAt) return 'sem prazo';
  const d = subscription.endsAt;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((d.getTime() - today.getTime()) / 86400000);
  const br = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
  if (diff < 0) return `${br} (vencido)`;
  if (diff <= 7) return `${br} · ${diff}d ⚠`;
  return `${br} · ${diff}d`;
}

const ContactsSection = () => {
  const { contacts, loading, error } = useContacts();
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const stats = useMemo(() => {
    const out = { total: contacts.length, lead: 0, espelho: 0, alpha: 0, ex: 0, vip: 0, alphaNoEmail: 0 };
    for (const c of contacts) {
      if (c.status && out[c.status] !== undefined) out[c.status] += 1;
      if (c.subscription?.isVIP) out.vip += 1;
      if (c.status === 'alpha' && !c.email) out.alphaNoEmail += 1;
    }
    return out;
  }, [contacts]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return contacts.filter((c) => {
      if (statusFilter === 'vip') {
        if (!c.subscription?.isVIP) return false;
      } else if (statusFilter !== 'all' && c.status !== statusFilter) {
        return false;
      }
      if (term) {
        const hay = [c.nome, c.nameNormalized, c.email, c.celular].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [contacts, statusFilter, search]);

  if (error) {
    return (
      <div className="glass-card p-6 mb-6 border border-red-500/30 bg-red-500/5">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
          <div>
            <h3 className="text-red-400 font-semibold">Erro ao carregar contacts</h3>
            <p className="text-sm text-slate-400 mt-1">{error.message}</p>
          </div>
        </div>
        <DebugBadge component="ContactsSection" />
      </div>
    );
  }

  return (
    <div className="glass-card p-6 mb-8">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 flex items-center justify-center">
            <Users className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Contacts</h2>
            <p className="text-xs text-slate-400">Cadastro mestre — {stats.total} pessoas</p>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar nome, celular, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-2 rounded-xl bg-slate-800/50 border border-slate-700/50 text-sm text-white w-64 focus:outline-none focus:border-indigo-500/50"
          />
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {[
          { key: 'all', label: 'Todos', count: stats.total },
          { key: 'alpha', label: 'Alpha', count: stats.alpha },
          { key: 'espelho', label: 'Espelho', count: stats.espelho },
          { key: 'lead', label: 'Lead', count: stats.lead },
          { key: 'ex', label: 'Ex', count: stats.ex },
          { key: 'vip', label: 'VIP', count: stats.vip },
        ].map((f) => {
          const active = statusFilter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors ${
                active
                  ? 'bg-indigo-500/25 text-indigo-300 border border-indigo-500/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent'
              }`}
            >
              {f.label}
              <span className={`px-1.5 py-0.5 rounded-full ${active ? 'bg-indigo-500/40' : 'bg-slate-700/50'}`}>
                {f.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Alpha sem email warning */}
      {stats.alphaNoEmail > 0 && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-sm text-amber-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>
            <strong>{stats.alphaNoEmail}</strong> {stats.alphaNoEmail === 1 ? 'Alpha sem email' : 'Alphas sem email'} —
            student/{`{uid}`} não foi materializado. Adicione email pela edição do contact pra criar acesso.
          </span>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-slate-500 text-sm">Carregando contacts...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm">Nenhum contact corresponde aos filtros.</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-700/30">
          <table className="w-full">
            <thead className="bg-slate-800/30">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs uppercase tracking-wider text-slate-500 font-semibold">Nome</th>
                <th className="text-left px-4 py-2.5 text-xs uppercase tracking-wider text-slate-500 font-semibold">Celular</th>
                <th className="text-left px-4 py-2.5 text-xs uppercase tracking-wider text-slate-500 font-semibold">Email</th>
                <th className="text-left px-4 py-2.5 text-xs uppercase tracking-wider text-slate-500 font-semibold">Status</th>
                <th className="text-left px-4 py-2.5 text-xs uppercase tracking-wider text-slate-500 font-semibold">Vencimento</th>
                <th className="text-left px-4 py-2.5 text-xs uppercase tracking-wider text-slate-500 font-semibold">Origem</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const theme = STATUS_THEME[c.status] ?? 'slate';
                const alphaPending = c.status === 'alpha' && !c.email;
                return (
                  <tr
                    key={c.id}
                    className={`border-t border-slate-700/20 hover:bg-indigo-500/5 ${alphaPending ? 'bg-amber-500/5' : ''}`}
                  >
                    <td className="px-4 py-2.5 text-sm text-white font-medium">
                      <div className="flex items-center gap-2">
                        {c.nome}
                        {alphaPending && (
                          <span className="text-xs text-amber-400/80" title="Alpha sem email">⚠</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-400 font-mono">{formatPhone(c.celular)}</td>
                    <td className="px-4 py-2.5 text-sm text-slate-400">
                      {c.email ?? <span className="italic text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-sm">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border bg-${theme}-500/15 text-${theme}-300 border-${theme}-500/30`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full bg-${theme}-400`} />
                        {STATUS_LABELS[c.status] ?? c.status}
                      </span>
                      {c.subscription?.isVIP && (
                        <span className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30">
                          <Crown className="w-3 h-3" />
                          VIP
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-400 font-mono">{formatVencimento(c.subscription)}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500 italic">{c.source ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-500 mt-3">
        Triplo match (nome / celular / email) bloqueia duplicatas. Linhas com ⚠ marcam Alpha sem email — student não foi materializado.
      </p>

      <DebugBadge component="ContactsSection" />
    </div>
  );
};

export default ContactsSection;
