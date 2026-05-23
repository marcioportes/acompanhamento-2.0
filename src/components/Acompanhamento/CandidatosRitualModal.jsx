/**
 * CandidatosRitualModal.jsx
 *
 * Modal central que lista alunos candidatos ao ritual de acesso à plataforma:
 * têm sub Alpha ou Espelho ativa (status='active', pagamento em dia) ou trial
 * no prazo (status='trial' — vencidos viram 'expired' automaticamente em
 * useSubscriptions v1.56.6), mas ainda não passaram pelo ritual de registro.
 * Overdue NÃO entra: não registramos quem está devendo.
 *
 * Mentor seleciona um aluno → callable createStudent em modo PROMOTE move o
 * doc + subs + payments pra /students/{authUid} e dispara email de senha.
 *
 * Issue #263 — DEC-AUTO-263-13.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { X, UserPlus, Loader2, AlertTriangle, Check, Mail } from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAccessStatus } from '../../utils/studentClassify';

export default function CandidatosRitualModal({ students, subscriptions, onClose, onAfterRitual, onOpenDrawer }) {
  const [running, setRunning] = useState(null);    // studentId em execução
  const [done, setDone] = useState(new Set());     // studentIds já ritualizados nesta sessão
  const [error, setError] = useState('');
  const [planFilter, setPlanFilter] = useState('all'); // 'all' | 'alpha' | 'self_service'
  // Estado real do Auth user por email — fonte da verdade vs heurística por id.
  // Carregado em batch via callable getInviteStatusBatch.
  const [authStatusByEmail, setAuthStatusByEmail] = useState({}); // email → { authExists, authUid }
  const [loadingAuth, setLoadingAuth] = useState(true);

  const candidatos = useMemo(() => {
    const subsByStudent = new Map();
    for (const sub of subscriptions ?? []) {
      const arr = subsByStudent.get(sub.studentId) ?? [];
      arr.push(sub);
      subsByStudent.set(sub.studentId, arr);
    }

    const list = [];
    for (const s of students ?? []) {
      if (done.has(s.id)) continue;
      // Candidato a Registro = aluno SEM Auth user (nunca foi registrado).
      // Definição alinhada 2026-05-11: quem tem Auth mas não logou é
      // "Aguardando 1º login" — não candidato. Filtro real (via batch
      // getInviteStatusBatch) aplicado abaixo depois que batch carrega.
      // Aqui filtro só por "não fez 1º login" como pré-seleção; o batch
      // depois remove os que já têm Auth.
      if (getAccessStatus(s) === 'active') continue;
      const subs = subsByStudent.get(s.id) ?? [];
      const elegivel = subs.find(
        (sub) =>
          (sub.plan === 'alpha' || sub.plan === 'self_service') &&
          (sub.status === 'active' || sub.status === 'trial')
      );
      if (!elegivel) continue;
      const hasEmail = Boolean(s.email && String(s.email).trim());
      list.push({ student: s, sub: elegivel, hasEmail });
    }

    list.sort((a, b) => (a.student.name ?? '').localeCompare(b.student.name ?? ''));
    return list;
  }, [students, subscriptions, done]);

  // Filtra os pré-selecionados removendo quem JÁ tem Auth (= já registrado).
  // Source of truth: getInviteStatusBatch. Durante loading, mostra a lista
  // bruta — após batch chegar, refina pra exclusivos sem Auth.
  const candidatosSemAuth = useMemo(() => {
    if (loadingAuth) return candidatos;
    return candidatos.filter(({ student, hasEmail }) => {
      if (!hasEmail) return true; // sem email = obviamente sem Auth
      const k = student.email.trim().toLowerCase();
      return !authStatusByEmail[k]?.authExists;
    });
  }, [candidatos, authStatusByEmail, loadingAuth]);

  // Consulta Auth real em batch ao montar / quando candidatos mudam.
  // Substitui heurística `lacksAuthUser` por verdade absoluta do Firebase Auth.
  useEffect(() => {
    const emails = candidatos
      .map(({ student, hasEmail }) => hasEmail ? student.email.trim().toLowerCase() : null)
      .filter(Boolean);
    if (emails.length === 0) {
      setAuthStatusByEmail({});
      setLoadingAuth(false);
      return;
    }
    setLoadingAuth(true);
    const fns = getFunctions();
    const batchCheck = httpsCallable(fns, 'getInviteStatusBatch');
    batchCheck({ emails })
      .then((res) => {
        setAuthStatusByEmail(res.data?.result ?? {});
      })
      .catch((err) => {
        console.warn('[CandidatosRitualModal] getInviteStatusBatch falhou', err);
        setAuthStatusByEmail({});
      })
      .finally(() => setLoadingAuth(false));
  }, [candidatos]);

  // Contagem por plano (em cima da lista efetiva de candidatos sem Auth)
  const counts = useMemo(() => {
    const c = { all: candidatosSemAuth.length, alpha: 0, self_service: 0 };
    for (const { sub } of candidatosSemAuth) {
      if (sub.plan === 'alpha') c.alpha += 1;
      else if (sub.plan === 'self_service') c.self_service += 1;
    }
    return c;
  }, [candidatosSemAuth]);

  const candidatosFiltered = useMemo(() => {
    if (planFilter === 'all') return candidatosSemAuth;
    return candidatosSemAuth.filter(({ sub }) => sub.plan === planFilter);
  }, [candidatosSemAuth, planFilter]);

  const handleStart = useCallback(async ({ student, sub }) => {
    setRunning(student.id);
    setError('');
    try {
      const fns = getFunctions();
      const createStudent = httpsCallable(fns, 'createStudent');
      await createStudent({
        studentId: student.id,
        email: student.email.trim(),
        name: student.name?.trim() || student.email.split('@')[0],
      });
      setDone((prev) => {
        const next = new Set(prev);
        next.add(student.id);
        return next;
      });
      onAfterRitual?.(student);
    } catch (err) {
      setError(`${student.name || student.email}: ${err.message || 'erro ao iniciar ritual'}`);
    } finally {
      setRunning(null);
    }
  }, [onAfterRitual]);

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[55]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-label="Candidatos ao ritual"
        className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none"
      >
        <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col pointer-events-auto">
          {/* Header */}
          <header className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Candidatos a Registro</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Alpha ou Espelho · ativo ou trial · ainda sem Auth na plataforma
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded transition-colors"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </header>

          {/* Filtros por plano */}
          {candidatosSemAuth.length > 0 && (
            <div className="px-3 py-2 border-b border-slate-800/50 flex items-center gap-1.5">
              {[
                { value: 'all',          label: 'Todos',   count: counts.all },
                { value: 'alpha',        label: 'Alpha',   count: counts.alpha },
                { value: 'self_service', label: 'Espelho', count: counts.self_service },
              ].map((f) => (
                <button
                  key={f.value}
                  onClick={() => setPlanFilter(f.value)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] transition-colors ${
                    planFilter === f.value
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-slate-700/30'
                  }`}
                >
                  {f.label}
                  <span className="text-[9px] opacity-70">({f.count})</span>
                </button>
              ))}
            </div>
          )}

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-2 py-2">
            {loadingAuth ? (
              <div className="px-4 py-12 text-center text-sm text-slate-500">
                <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin text-blue-400" />
                Verificando Auth dos candidatos...
              </div>
            ) : candidatosFiltered.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-slate-500">
                <Check className="w-8 h-8 mx-auto mb-2 text-emerald-500/60" />
                {candidatosSemAuth.length === 0
                  ? 'Nenhum candidato a registro no momento — todos os assinantes Alpha/Espelho já têm Auth na plataforma.'
                  : `Nenhum candidato ${planFilter === 'alpha' ? 'Alpha' : 'Espelho'} no momento.`}
              </div>
            ) : (
              <ul className="divide-y divide-slate-800/50">
                {candidatosFiltered.map(({ student, sub, hasEmail }) => {
                  const isRunning = running === student.id;
                  const isAlpha = sub.plan === 'alpha';
                  const planLabel = isAlpha ? 'Alpha' : 'Espelho';
                  const planPill = isAlpha
                    ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                    : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
                  // Alpha = mandatório usar plataforma (registrar é prioritário).
                  // Espelho = opcional (escolha do aluno; sem urgência).
                  const urgencyBar = isAlpha ? 'border-l-2 border-l-orange-500/60' : 'border-l-2 border-l-transparent';
                  const handleOpenDrawer = () => {
                    if (onOpenDrawer) {
                      onOpenDrawer(student);
                      onClose?.();
                    }
                  };
                  // Modal só lista candidatos SEM Auth (filtrado via batch),
                  // então ação é simples:
                  //   sem email → "Cadastrar email" (drawer)
                  //   com email → "Registrar" (callable createStudent)
                  // Reenvio pra quem tem Auth+sem 1ºlogin vive no drawer, não aqui.
                  const action = hasEmail ? 'register' : 'open-drawer';
                  return (
                    <li key={student.id} className={`px-3 py-3 flex items-center justify-between gap-3 hover:bg-slate-800/30 rounded-lg ${urgencyBar}`}>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-white truncate">
                            {student.name || <span className="italic text-slate-500">(sem nome)</span>}
                          </p>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium border ${planPill}`}>
                            {planLabel}
                          </span>
                          {sub.status === 'trial' && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium border bg-amber-500/15 text-amber-300 border-amber-500/30">
                              Trial
                            </span>
                          )}
                          {isAlpha ? (
                            <span className="text-[9px] text-orange-400/80">prioritário</span>
                          ) : (
                            <span className="text-[9px] text-slate-600">opcional</span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 font-mono truncate">
                          {hasEmail ? student.email : <span className="italic text-yellow-400/80">sem email — cadastrar antes de registrar</span>}
                        </p>
                      </div>
                      {action === 'register' && (
                        <button
                          onClick={() => handleStart({ student, sub })}
                          disabled={isRunning || running != null}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                          title="Criar Auth + enviar email de definição de senha"
                        >
                          {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                          Registrar
                        </button>
                      )}
                      {action === 'open-drawer' && (
                        <button
                          onClick={handleOpenDrawer}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-300 border border-yellow-600/40 rounded-lg text-xs font-semibold transition-colors flex-shrink-0"
                          title="Abrir drawer pra cadastrar email"
                        >
                          <Mail className="w-3.5 h-3.5" /> Cadastrar email
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {error && (
              <div className="mx-2 mt-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {error}
              </div>
            )}

            {done.size > 0 && (
              <p className="px-4 py-2 text-[11px] text-emerald-400">
                ✓ {done.size} aluno{done.size > 1 ? 's' : ''} ritualizado{done.size > 1 ? 's' : ''} nesta sessão.
              </p>
            )}
          </div>

          {/* Footer */}
          <footer className="px-5 py-3 border-t border-slate-800 text-[11px] text-slate-500">
            {candidatos.length > 0 && (
              <span>{candidatos.length} candidato{candidatos.length > 1 ? 's' : ''} aguardando</span>
            )}
          </footer>
        </div>
      </div>
    </>
  );
}
