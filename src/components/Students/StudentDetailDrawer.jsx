/**
 * StudentDetailDrawer.jsx
 *
 * Drawer master/detail compartilhado entre Acompanhamento e Assinaturas
 * (caminho α de #263). Permite:
 *   - Editar nome / celular / email (email read-only quando accessStatus='active')
 *   - Gerenciar acesso à plataforma (reenviar convite, bloquear/desbloquear login)
 *   - Ver histórico de assinaturas (todas, incl. canceladas/expiradas) com
 *     pagamentos no formato (c) híbrido — header sub atual em destaque,
 *     abaixo lista flat por data desc com chip de origem.
 *   - Excluir o aluno (hard delete cascateado via callable deleteStudent).
 *
 * Issue #263 — DEC-AUTO-263-07/08/12 + caminho α (drawer compartilhado).
 *
 * @version 1.1.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X, Loader2, Trash2, RefreshCw, AlertTriangle, Save,
  CreditCard, ExternalLink, Lock, Unlock, UserPlus,
} from 'lucide-react';
import { doc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../../firebase';
import { getAccessStatus, ACCESS_STATUS_CONFIG, lacksAuthUser } from '../../utils/studentClassify';
import { formatWhatsappDisplay } from '../../utils/whatsappValidation';

const formatBR = (date) => {
  if (!date) return '—';
  const d = date instanceof Date ? date : (date.toDate ? date.toDate() : new Date(date));
  if (Number.isNaN(d?.getTime?.())) return '—';
  return d.toLocaleDateString('pt-BR');
};

const formatBRL = (cents, currency = 'BRL') => {
  if (cents == null || Number.isNaN(Number(cents))) return '—';
  return Number(cents).toLocaleString('pt-BR', { style: 'currency', currency });
};

export default function StudentDetailDrawer({ student, subscriptions, onClose, onAfterDelete }) {
  const [name, setName] = useState(student?.name ?? '');
  const [whatsappNumber, setWhatsappNumber] = useState(student?.whatsappNumber ?? '');
  const [email, setEmail] = useState(student?.email ?? '');
  const [saving, setSaving] = useState(false);
  const [resending, setResending] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [togglingBlock, setTogglingBlock] = useState(false);
  const [confirmingBlockToggle, setConfirmingBlockToggle] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const isBlocked = Boolean(student?.loginBlocked);
  const noAuth = student ? lacksAuthUser(student) : false;
  const [paymentsBySub, setPaymentsBySub] = useState({});
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const accessStatus = getAccessStatus(student);
  const accessCfg = ACCESS_STATUS_CONFIG[accessStatus];

  const studentSubs = useMemo(
    () => (subscriptions ?? []).filter((s) => s.studentId === student?.id),
    [subscriptions, student?.id]
  );

  // Carrega pagamentos de todas as subs do aluno (cold-load — sem listener
  // realtime; basta um snapshot ao abrir).
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setPaymentsLoading(true);
      const acc = {};
      for (const sub of studentSubs) {
        try {
          const snap = await getDocs(collection(db, 'students', student.id, 'subscriptions', sub.id, 'payments'));
          acc[sub.id] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        } catch (e) {
          acc[sub.id] = [];
        }
      }
      if (!cancelled) {
        setPaymentsBySub(acc);
        setPaymentsLoading(false);
      }
    };
    if (student?.id) load();
    return () => { cancelled = true; };
  }, [student?.id, studentSubs]);

  const flashSuccess = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 4000); };

  const dirty = (
    name !== (student?.name ?? '')
    || whatsappNumber !== (student?.whatsappNumber ?? '')
    || email !== (student?.email ?? '')
  );

  const handleSave = useCallback(async () => {
    if (!dirty) return;
    setSaving(true);
    setError('');
    try {
      const updates = {};
      if (name !== (student?.name ?? '')) updates.name = name.trim();
      if (whatsappNumber !== (student?.whatsappNumber ?? '')) updates.whatsappNumber = whatsappNumber.trim() || null;
      if (email !== (student?.email ?? '')) updates.email = email.trim().toLowerCase() || null;
      await updateDoc(doc(db, 'students', student.id), updates);
      flashSuccess('Alterações salvas.');
    } catch (err) {
      setError(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }, [dirty, name, whatsappNumber, email, student]);

  const handleToggleBlock = useCallback(async () => {
    setConfirmingBlockToggle(false);
    setTogglingBlock(true);
    setError('');
    try {
      const fns = getFunctions();
      const setBlocked = httpsCallable(fns, 'setStudentLoginBlocked');
      await setBlocked({ uid: student.id, blocked: !isBlocked });
      flashSuccess(isBlocked ? 'Login desbloqueado.' : 'Login bloqueado.');
    } catch (err) {
      setError(err.message || 'Erro ao alterar status de login');
    } finally {
      setTogglingBlock(false);
    }
  }, [student?.id, isBlocked]);

  const handleResend = useCallback(async () => {
    if (!email) return;
    setResending(true);
    setError('');
    try {
      const fns = getFunctions();
      const resend = httpsCallable(fns, 'resendStudentInvite');
      await resend({ email: email.trim() });
      flashSuccess('Convite reenviado.');
    } catch (err) {
      setError(err.message || 'Erro ao reenviar');
    } finally {
      setResending(false);
    }
  }, [email]);

  // Elegibilidade pra registro: sem Auth + sub Alpha/Espelho ativa ou trial.
  // Email NÃO é pré-requisito — pode ser cadastrado durante o ritual.
  const eligibleSub = useMemo(() => {
    if (!noAuth) return null;
    return studentSubs.find(
      (s) => (s.plan === 'alpha' || s.plan === 'self_service')
        && (s.status === 'active' || s.status === 'trial')
    ) ?? null;
  }, [noAuth, studentSubs]);

  const handleRegister = useCallback(async () => {
    if (!eligibleSub) return;
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError('Cadastre um email no campo acima antes de registrar.');
      return;
    }
    setRegistering(true);
    setError('');
    try {
      // Salva alterações pendentes do form antes (nome/celular/email) — assim
      // o doc fica em sincronia com o que vai pro Auth.
      if (dirty) {
        const updates = {};
        if (name !== (student?.name ?? '')) updates.name = name.trim();
        if (whatsappNumber !== (student?.whatsappNumber ?? '')) updates.whatsappNumber = whatsappNumber.trim() || null;
        if (email !== (student?.email ?? '')) updates.email = trimmedEmail || null;
        await updateDoc(doc(db, 'students', student.id), updates);
      }
      const fns = getFunctions();
      const create = httpsCallable(fns, 'createStudent');
      await create({
        studentId: student.id,
        email: trimmedEmail,
        name: (name?.trim()) || trimmedEmail.split('@')[0],
      });
      flashSuccess('Aluno registrado. Email de definição de senha enviado.');
      onClose?.();
    } catch (err) {
      setError(err.message || 'Erro ao registrar');
    } finally {
      setRegistering(false);
    }
  }, [eligibleSub, student, email, name, whatsappNumber, dirty, onClose]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    setError('');
    try {
      const fns = getFunctions();
      const del = httpsCallable(fns, 'deleteStudent');
      await del({ uid: student.id, email: student.email });
      onAfterDelete?.();
      onClose?.();
    } catch (err) {
      setError(err.message || 'Erro ao excluir');
      setDeleting(false);
    }
  }, [student, onAfterDelete, onClose]);

  if (!student) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[55]"
        onClick={onClose}
      />
      {/* Drawer — z-[60] pra ficar acima do DebugBadge (z-50) */}
      <aside
        role="dialog"
        aria-label={`Editar aluno ${student.name || student.email || ''}`}
        className="fixed top-0 right-0 h-full w-full sm:w-[480px] bg-slate-900 border-l border-slate-800 shadow-2xl z-[60] flex flex-col"
      >
        {/* Header */}
        <header className="px-5 py-4 border-b border-slate-800 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-white truncate">
              {student.name || <span className="italic text-slate-500">(sem nome)</span>}
            </h2>
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${accessCfg.pill}`}>
                {accessCfg.label}
              </span>
              {student.email && (
                <span className="text-[11px] text-slate-500 font-mono truncate">{student.email}</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded transition-colors flex-shrink-0"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Body — scroll */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">

          {/* Form */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Dados do aluno</h3>
            <label className="block">
              <span className="text-[11px] text-slate-500">Nome</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50"
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-slate-500">Celular</span>
              <input
                type="text"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="+55 21 99888-7766"
                className="mt-1 w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-blue-500/50"
              />
              {whatsappNumber && (
                <span className="text-[10px] text-slate-500 mt-1 inline-block">
                  Display: {formatWhatsappDisplay(whatsappNumber)}
                </span>
              )}
            </label>
            <label className="block">
              <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
                Email
                {accessStatus === 'active' && (
                  <span className="text-[9px] text-slate-600 normal-case">· validado, não editável</span>
                )}
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={accessStatus === 'active'}
                title={accessStatus === 'active' ? 'Email validado pelo Firebase Auth no 1º login — não pode ser alterado' : ''}
                className={`mt-1 w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500/50 ${
                  accessStatus === 'active'
                    ? 'text-slate-500 cursor-not-allowed'
                    : 'text-white'
                }`}
              />
            </label>
          </section>

          {/* Acesso à plataforma — info + bloqueio de login (DEC-AUTO-263-12).
              Aluno aqui já está na plataforma (ou em ritual via lista de
              candidatos). Disparo do ritual mora no botão "Candidatos ao
              ritual" do header da tela, não aqui. */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Acesso à plataforma
              </h3>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                isBlocked
                  ? 'bg-red-500/15 text-red-300 border border-red-500/30'
                  : accessCfg.pill
              }`}>
                {isBlocked ? 'login bloqueado' : accessCfg.label}
              </span>
            </div>

            {/* Candidato: sem Auth, com sub Alpha/Espelho ativa/trial → registrar */}
            {noAuth && (
              <div className={`rounded-lg p-3 border ${
                eligibleSub ? 'bg-blue-500/5 border-blue-500/30' : 'bg-slate-800/40 border-slate-700/50'
              }`}>
                {eligibleSub ? (
                  <div className="space-y-2">
                    <p className="text-sm text-slate-200">
                      Aluno candidato à plataforma — sub <strong>{eligibleSub.plan === 'alpha' ? 'Alpha' : 'Espelho'}</strong>
                      {eligibleSub.status === 'trial' ? ' (trial)' : ''} ativa, sem Auth user.
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {!email.trim()
                        ? 'Cadastre o email no campo acima — o ritual vai criar Auth com esse email e enviar definição de senha.'
                        : 'Click registra: cria Auth com o email atual, envia email de definição de senha, move o doc pro novo UID preservando subs e pagamentos. Alterações pendentes são salvas automaticamente.'}
                    </p>
                    <button
                      onClick={handleRegister}
                      disabled={registering || !email.trim()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title={!email.trim() ? 'Cadastre um email antes de registrar' : ''}
                    >
                      {registering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                      Registrar na plataforma
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-slate-300">Aluno sem Auth user na plataforma.</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Sem assinatura Alpha/Espelho ativa ou trial — cadastre em Assinaturas → Nova Assinatura.
                    </p>
                  </div>
                )}
              </div>
            )}

            {accessStatus === 'active' && (
              <p className="text-sm text-slate-300">
                Aluno fez 1º login.
                {student.firstLoginAt && <span className="text-slate-500"> Em {formatBR(student.firstLoginAt)}.</span>}
              </p>
            )}
            {accessStatus === 'pending' && (
              <div className="space-y-2">
                <p className="text-sm text-slate-300">Convite enviado, aguardando 1º login.</p>
                <button
                  onClick={handleResend}
                  disabled={resending || !email}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-300 border border-yellow-600/40 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                >
                  {resending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Reenviar convite
                </button>
              </div>
            )}

            {/* Bloqueio de login: caso típico = inadimplência. Aplicável só a
                aluno que JÁ tem Auth (passou pelo ritual). */}
            {accessStatus !== 'none' && (
              <div className={`rounded-lg p-3 border ${
                isBlocked
                  ? 'bg-red-500/5 border-red-500/30'
                  : 'bg-slate-800/40 border-slate-700/50'
              }`}>
                {confirmingBlockToggle ? (
                  <div className="space-y-2">
                    <p className="text-sm text-slate-200">
                      {isBlocked
                        ? 'Desbloquear login? Aluno volta a poder entrar na plataforma.'
                        : 'Bloquear login? Aluno deixa de conseguir entrar na plataforma até desbloquear (caso típico: inadimplência).'}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setConfirmingBlockToggle(false)}
                        className="px-2.5 py-1 text-[11px] rounded bg-white/5 text-slate-400 hover:bg-white/10"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleToggleBlock}
                        disabled={togglingBlock}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] rounded border ${
                          isBlocked
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                            : 'bg-red-500/20 text-red-300 border-red-500/40 hover:bg-red-500/30'
                        } disabled:opacity-50`}
                      >
                        {togglingBlock
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : isBlocked
                            ? <Unlock className="w-3 h-3" />
                            : <Lock className="w-3 h-3" />}
                        {isBlocked ? 'Confirmar desbloqueio' : 'Confirmar bloqueio'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-slate-300">
                        {isBlocked ? 'Login bloqueado' : 'Login liberado'}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {isBlocked
                          ? 'Aluno não consegue entrar na plataforma.'
                          : 'Bloqueie em caso de inadimplência ou suspensão.'}
                      </p>
                    </div>
                    <button
                      onClick={() => setConfirmingBlockToggle(true)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        isBlocked
                          ? 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-600/40'
                          : 'bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-600/40'
                      }`}
                    >
                      {isBlocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                      {isBlocked ? 'Desbloquear login' : 'Bloquear login'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Histórico — layout (c) híbrido: sub atual em destaque + lista flat
              de pagamentos por data com chip de origem (DEC-AUTO-263-G5). */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Acesso e cobrança
            </h3>

            {(() => {
              if (studentSubs.length === 0) {
                return <p className="text-sm text-slate-500 italic">Sem assinaturas registradas.</p>;
              }

              const ENDED = new Set(['cancelled', 'expired']);
              const sortedSubs = [...studentSubs].sort((a, b) => {
                const da = a.renewalDate?.toDate?.()?.getTime?.() ?? a.trialEndsAt?.toDate?.()?.getTime?.() ?? 0;
                const dbb = b.renewalDate?.toDate?.()?.getTime?.() ?? b.trialEndsAt?.toDate?.()?.getTime?.() ?? 0;
                return dbb - da;
              });
              const currentSub = sortedSubs.find((s) => !ENDED.has(s.status)) ?? sortedSubs[0];
              const historicalSubs = sortedSubs.filter((s) => s !== currentSub);

              const planChip = (plan) => {
                if (plan === 'alpha') return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
                if (plan === 'self_service') return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
                if (plan === 'vip') return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
                return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
              };
              const planLabel = (plan) => plan === 'self_service' ? 'Espelho' : plan === 'alpha' ? 'Alpha' : plan === 'vip' ? 'VIP' : plan;

              const subSummary = (sub) => {
                const dateStr = sub.startDate ? formatBR(sub.startDate) : '';
                const endStr = sub.renewalDate ? formatBR(sub.renewalDate) : sub.trialEndsAt ? formatBR(sub.trialEndsAt) : '';
                return endStr ? `${dateStr}–${endStr}` : dateStr;
              };

              // Flat de pagamentos com referência à sub de origem
              const allPayments = [];
              for (const sub of sortedSubs) {
                for (const p of paymentsBySub[sub.id] ?? []) {
                  allPayments.push({ ...p, _sub: sub });
                }
              }
              allPayments.sort((a, b) => {
                const da = a.date?.toDate?.()?.getTime?.() ?? new Date(a.date ?? 0).getTime();
                const dbb = b.date?.toDate?.()?.getTime?.() ?? new Date(b.date ?? 0).getTime();
                return dbb - da;
              });

              return (
                <>
                  {/* Sub atual em destaque */}
                  <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${planChip(currentSub.plan)}`}>
                          {planLabel(currentSub.plan)}
                        </span>
                        {currentSub.type === 'trial' && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium border bg-amber-500/15 text-amber-300 border-amber-500/30">
                            Trial
                          </span>
                        )}
                        <span className={`text-[10px] uppercase tracking-wide ${
                          currentSub.status === 'active' ? 'text-emerald-400'
                            : currentSub.status === 'overdue' ? 'text-red-400'
                            : currentSub.status === 'trial' ? 'text-amber-400'
                            : currentSub.status === 'cancelled' ? 'text-red-500/70'
                            : currentSub.status === 'expired' ? 'text-slate-500'
                            : 'text-slate-400'
                        }`}>
                          {currentSub.status}
                        </span>
                      </div>
                      {currentSub.amount != null && (
                        <span className="text-xs text-slate-300 font-mono whitespace-nowrap">
                          {formatBRL(currentSub.amount, currentSub.currency)}
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 text-[11px] text-slate-500">
                      {currentSub.startDate && <>desde {formatBR(currentSub.startDate)}</>}
                      {currentSub.renewalDate && <> · próximo vencimento {formatBR(currentSub.renewalDate)}</>}
                      {currentSub.trialEndsAt && <> · trial até {formatBR(currentSub.trialEndsAt)}</>}
                    </div>
                  </div>

                  {/* Subs históricas (resumo de chips) */}
                  {historicalSubs.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      <span className="text-[10px] uppercase tracking-wide text-slate-600">Histórico</span>
                      {historicalSubs.map((sub) => (
                        <span
                          key={sub.id}
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium border ${planChip(sub.plan)} opacity-70`}
                          title={`${planLabel(sub.plan)} · ${sub.status} · ${subSummary(sub)}`}
                        >
                          {planLabel(sub.plan)}
                          <span className="text-[8px] opacity-70">{sub.status}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Pagamentos flat por data desc com chip de origem */}
                  <div className="border-t border-slate-700/50 pt-3 mt-2">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase text-slate-500 mb-2">
                      <CreditCard className="w-3 h-3" /> Histórico de pagamentos
                    </div>
                    {paymentsLoading ? (
                      <p className="text-[11px] text-slate-500 italic">Carregando…</p>
                    ) : allPayments.length === 0 ? (
                      <p className="text-[11px] text-slate-500 italic">Sem pagamentos registrados.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {allPayments.map((p) => (
                          <li key={`${p._sub.id}-${p.id}`} className="flex items-center justify-between gap-2 text-[11px]">
                            <span className="text-slate-400 w-20 flex-shrink-0">{formatBR(p.date)}</span>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium border flex-shrink-0 ${planChip(p._sub.plan)} opacity-80`}>
                              {planLabel(p._sub.plan)}
                            </span>
                            <span className="font-mono text-slate-300 flex-1 text-right">
                              {formatBRL(p.amount, p.currency ?? p._sub.currency)}
                            </span>
                            {p.receiptUrl && (
                              <a
                                href={p.receiptUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-0.5 flex-shrink-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                recibo <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              );
            })()}
          </section>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {error}
            </div>
          )}
          {success && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs">
              {success}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="px-5 py-3 border-t border-slate-800 flex items-center justify-between gap-3 bg-slate-900/80">
          <div>
            {confirmingDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-red-300">Excluir definitivo?</span>
                <button
                  onClick={() => setConfirmingDelete(false)}
                  className="px-2 py-1 text-[11px] rounded bg-white/5 text-slate-400 hover:bg-white/10"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] rounded bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30 disabled:opacity-50"
                >
                  {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  Confirmar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Excluir aluno
              </button>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Salvar
          </button>
        </footer>
      </aside>
    </>
  );
}
