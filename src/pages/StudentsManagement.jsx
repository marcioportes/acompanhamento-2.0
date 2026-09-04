/**
 * StudentsManagement (Acompanhamento)
 * @version 4.2.0
 * @description Workspace do mentor sobre alunos Alpha + Espelho com dashboard
 *              ativo. 3 buckets: Alpha, Espelho, Trial (subdividido em
 *              Trial·Alpha e Trial·Espelho). Quem não tem sub ativa OU é VIP
 *              não aparece. Cadastro de aluno vive em Assinaturas — esta tela
 *              não cria, apenas acompanha.
 *
 * CHANGELOG:
 * - 4.2.0: Sidebar/título "Alunos" → "Acompanhamento" (DEC-AUTO-263-03).
 *          Botão "+ Novo aluno" e AddStudentModal removidos — cadastro só
 *          em Assinaturas (DEC-AUTO-263-04). Issue #263.
 * - 4.1.0: Buckets reduzidos para alpha/espelho/trial. Classificação pela sub
 *          ativa mais recente (não pelo accessTier). Lead/Ex/VIP saíram.
 * - 4.0.0: Tabela (vs cards). 6 chips. Stats Alpha/Espelho/VIP/Vencendo ≤7d.
 * - 3.1.0: Alpha/Espelho via accessTier; row clicável → View As.
 * - 3.0.0: Filtro Alpha/Espelho + click→dashboard. Limpeza N+1 trades.
 */

import { useState, useMemo, useEffect } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  Mail, Users, Loader2, RefreshCw, AlertTriangle, Eye, Pencil, UserPlus, Lock,
} from 'lucide-react';
import { formatWhatsappDisplay } from '../utils/whatsappValidation';
import DebugBadge from '../components/DebugBadge';
import AssessmentToggle from '../components/Onboarding/AssessmentToggle';
import StudentDetailDrawer from '../components/Students/StudentDetailDrawer';
import CandidatosRitualModal from '../components/Acompanhamento/CandidatosRitualModal';
import { useStudents } from '../hooks/useStudents';
import { useSubscriptions } from '../hooks/useSubscriptions';
import {
  classifyStudent, isExpiringSoon, tierGroup, TIER_CONFIG,
  getAccessStatus, ACCESS_STATUS_CONFIG, lacksAuthUser,
} from '../utils/studentClassify';

const StudentsManagement = ({ onViewAsStudent }) => {
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [resending, setResending] = useState(null);
  const [tierFilter, setTierFilter] = useState('all');
  // editingStudent é DERIVADO de students[] (real-time) via id — quando o
  // callable muda algo (loginBlocked, accessStatus, etc.), o drawer reflete
  // automaticamente. Snapshot direto causava UI desatualizada.
  const [editingStudentId, setEditingStudentId] = useState(null);
  const [showCandidatos, setShowCandidatos] = useState(false);

  const functions = getFunctions();
  const { students, loading } = useStudents();
  const { subscriptions, loading: subsLoading } = useSubscriptions();
  // Estado real do Auth user por email — fonte da verdade pra
  // "candidato a registro = sem Auth". Carregado em batch via callable.
  const [authStatusByEmail, setAuthStatusByEmail] = useState({});

  useEffect(() => {
    const emails = (students ?? [])
      .map((s) => s.email?.trim().toLowerCase())
      .filter(Boolean);
    if (emails.length === 0) return;
    const batchCheck = httpsCallable(functions, 'getInviteStatusBatch');
    batchCheck({ emails })
      .then((res) => setAuthStatusByEmail(res.data?.result ?? {}))
      .catch((err) => console.warn('[StudentsManagement] getInviteStatusBatch', err));
  }, [students, functions]);

  // Helper: aluno tem Auth user real (verdade do Firebase Auth, não heurística).
  // Sem email → false; com email → consulta batch result.
  const hasAuth = (s) => {
    const k = s?.email?.trim?.()?.toLowerCase?.();
    if (!k) return false;
    return Boolean(authStatusByEmail[k]?.authExists);
  };

  // Student do drawer DERIVADO da lista real-time — atualiza automaticamente
  // após callable de bloqueio/registro/edit.
  const editingStudent = useMemo(
    () => editingStudentId ? (students.find((s) => s.id === editingStudentId) ?? null) : null,
    [students, editingStudentId]
  );

  // Subs por studentId.
  const subsByStudent = useMemo(() => {
    const map = new Map();
    for (const sub of subscriptions ?? []) {
      const arr = map.get(sub.studentId) ?? [];
      arr.push(sub);
      map.set(sub.studentId, arr);
    }
    return map;
  }, [subscriptions]);

  // Bucket por aluno (alpha | espelho | trial-alpha | trial-espelho | null).
  const studentBucket = useMemo(() => {
    const map = new Map();
    for (const s of students) {
      map.set(s.id, classifyStudent(s, subsByStudent.get(s.id) ?? []));
    }
    return map;
  }, [students, subsByStudent]);

  // Universo da tela: só quem cabe na gestão (bucket !== null).
  const managedStudents = useMemo(
    () => students.filter((s) => studentBucket.get(s.id) !== null),
    [students, studentBucket]
  );

  const candidatosCount = useMemo(() => {
    let n = 0;
    for (const s of students) {
      // Candidato a Registro = aluno SEM Auth user (= nunca foi registrado
      // na plataforma) + sub Alpha/Espelho ativa OU trial no prazo.
      // Quem tem Auth mas não logou ainda é "Aguardando 1º login" — caso
      // do Convidado, não candidato. Definição alinhada 2026-05-11.
      if (hasAuth(s)) continue;
      const subs = subsByStudent.get(s.id) ?? [];
      const ok = subs.some(
        (sub) => (sub.plan === 'alpha' || sub.plan === 'self_service')
          && (sub.status === 'active' || sub.status === 'trial')
      );
      if (ok) n += 1;
    }
    return n;
  }, [students, subsByStudent, authStatusByEmail]);

  const counts = useMemo(() => {
    const c = { all: managedStudents.length, alpha: 0, espelho: 0, trial: 0 };
    for (const s of managedStudents) {
      const g = tierGroup(studentBucket.get(s.id));
      if (g && c[g] !== undefined) c[g] += 1;
    }
    let expiringSoon = 0;
    for (const sub of subscriptions ?? []) {
      if (isExpiringSoon(sub)) expiringSoon += 1;
    }
    return { ...c, expiringSoon };
  }, [managedStudents, studentBucket, subscriptions]);

  const filteredStudents = useMemo(() => {
    if (tierFilter === 'all') return managedStudents;
    return managedStudents.filter((s) => tierGroup(studentBucket.get(s.id)) === tierFilter);
  }, [managedStudents, studentBucket, tierFilter]);

  const flashSuccess = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 5000); };

  const handleResendInvite = async (email, ev) => {
    ev?.stopPropagation();
    if (!email) return;
    setResending(email);
    try {
      const resendInvite = httpsCallable(functions, 'resendStudentInvite');
      await resendInvite({ email });
      flashSuccess('Email reenviado!');
    } catch (err) {
      setError('Erro ao reenviar: ' + err.message);
    } finally {
      setResending(null);
    }
  };

  const canViewAs = (student) => Boolean(student?.email);

  const handleViewAs = (student) => {
    if (!canViewAs(student) || !onViewAsStudent) return;
    onViewAsStudent({
      uid: student.uid || student.id,
      email: student.email,
      name: student.name,
    });
  };

  if (loading || subsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  const tierChips = [
    { value: 'all',       label: 'Todos',          count: counts.all },
    { value: 'alpha',     label: 'Mentoria Alpha', count: counts.alpha },
    { value: 'espelho',   label: 'Espelho',        count: counts.espelho },
    { value: 'trial',     label: 'Trial',          count: counts.trial },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto pb-20">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-white flex items-center gap-3">
            <Users className="w-7 h-7 text-blue-400" />Acompanhamento
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            Workspace do mentor · Alpha e Espelho com dashboard ativo.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCandidatos(true)}
          disabled={candidatosCount === 0}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors flex-shrink-0"
          title={candidatosCount === 0 ? 'Nenhum candidato no momento' : 'Alunos com Alpha/Espelho em dia que ainda não estão na plataforma'}
        >
          <UserPlus className="w-4 h-4" /> Candidatos a Registro
          {candidatosCount > 0 && (
            <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-white/20 rounded-full text-[11px] font-semibold">
              {candidatosCount}
            </span>
          )}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="glass-card p-4">
          <p className="text-2xl font-bold text-purple-400 font-mono">{counts.alpha}</p>
          <p className="text-[11px] uppercase tracking-wider text-slate-500 mt-1">Alpha</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-2xl font-bold text-cyan-400 font-mono">{counts.espelho}</p>
          <p className="text-[11px] uppercase tracking-wider text-slate-500 mt-1">Espelho</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-2xl font-bold text-amber-400 font-mono">{counts.trial}</p>
          <p className="text-[11px] uppercase tracking-wider text-slate-500 mt-1">Trial</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-2xl font-bold text-yellow-400 font-mono">{counts.expiringSoon}</p>
          <p className="text-[11px] uppercase tracking-wider text-slate-500 mt-1">Vencendo ≤7d</p>
        </div>
      </div>

      {/* Chips de filtro — 3 buckets visíveis (Trial agrega trial-alpha + trial-espelho) */}
      <div className="glass-card p-3 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-slate-500 w-16 flex-shrink-0">Plano</span>
          {tierChips.map((f) => {
            const active = tierFilter === f.value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => setTierFilter(f.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors border ${active ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border-slate-700/30'}`}
              >
                {f.label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? 'bg-blue-500/30' : 'bg-slate-700/50'}`}>{f.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Toasts */}
      {success && <div className="mb-4 p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm">{success}</div>}
      {error && <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>}

      {/* Tabela */}
      <div className="glass-card overflow-hidden">
        <div className="px-4 py-2 border-b border-slate-800/50 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Alunos cadastrados</h3>
          <p className="text-xs text-slate-500">{filteredStudents.length} resultado{filteredStudents.length !== 1 ? 's' : ''}</p>
        </div>

        {filteredStudents.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <Mail className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>{managedStudents.length === 0 ? 'Nenhum aluno na gestão' : 'Nenhum aluno neste filtro'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800/50 text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="text-left font-semibold px-4 py-3">Nome</th>
                  <th className="text-left font-semibold px-4 py-3 whitespace-nowrap">Celular</th>
                  <th className="text-left font-semibold px-4 py-3">Email</th>
                  <th className="text-left font-semibold px-4 py-3 whitespace-nowrap">Status</th>
                  <th className="text-right font-semibold px-4 py-3 whitespace-nowrap">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/30">
                {filteredStudents.map((s) => {
                  const bucket = studentBucket.get(s.id);
                  const tier = TIER_CONFIG[bucket];
                  if (!tier) return null;
                  const isAlphaBucket = bucket === 'alpha' || bucket === 'trial-alpha';
                  const canEnterDashboard = canViewAs(s);
                  const access = getAccessStatus(s);
                  const accessCfg = ACCESS_STATUS_CONFIG[access];
                  const isPending = access === 'pending';
                  // Candidato a Registro = aluno sem Auth user (nunca foi
                  // registrado na plataforma). Quem tem Auth mas firstLoginAt=null
                  // é "Aguardando 1º login" (chip vem do accessStatus='pending'
                  // já renderizado). Definição alinhada 2026-05-11.
                  const isCandidato = !hasAuth(s);
                  const isBlocked = Boolean(s.loginBlocked);
                  // Borda lateral: candidato Alpha = laranja (urgente);
                  // candidato Espelho = amarelo (neutro); bloqueado = vermelho.
                  const sideBorder = isBlocked
                    ? 'border-l-2 border-l-red-500/60'
                    : isCandidato
                      ? (isAlphaBucket ? 'border-l-2 border-l-orange-500/60' : 'border-l-2 border-l-yellow-500/40')
                      : 'border-l-2 border-l-transparent';
                  return (
                    <tr
                      key={s.id}
                      className={`transition-colors hover:bg-slate-800/20 ${sideBorder}`}
                    >
                      <td className="px-4 py-3 font-medium text-white">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isCandidato && (
                            <span title="Candidato — sem Auth user, registrar via lápis" className="text-yellow-400">
                              <UserPlus className="w-3.5 h-3.5" />
                            </span>
                          )}
                          {isBlocked && (
                            <span title="Login bloqueado" className="text-red-400">
                              <Lock className="w-3.5 h-3.5" />
                            </span>
                          )}
                          <span>{s.name || <span className="italic text-slate-500">(sem nome)</span>}</span>
                          {isCandidato && (
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium border ${
                              isAlphaBucket
                                ? 'bg-orange-500/15 text-orange-300 border-orange-500/30'
                                : 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30'
                            }`}>
                              Candidato{isAlphaBucket ? ' · prioritário' : ''}
                            </span>
                          )}
                        </div>
                        {s.emailError && (
                          <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-red-400" title={s.emailError}>
                            <AlertTriangle className="w-3 h-3" /> erro email
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-400 font-mono text-xs whitespace-nowrap">
                        {s.whatsappNumber ? formatWhatsappDisplay(s.whatsappNumber) : <span className="italic text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {s.email || <span className="italic text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${tier.pill}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${tier.dot}`} />
                            {tier.label}
                          </span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] ${accessCfg.pill}`}
                            title="Acesso à plataforma"
                          >
                            {accessCfg.label}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {(isAlphaBucket || isPending) && (
                            <AssessmentToggle
                              studentId={s.id}
                              currentValue={s.requiresAssessment}
                              onboardingStatus={s.onboardingStatus}
                            />
                          )}
                          {isPending && s.email && (
                            <button
                              onClick={(e) => handleResendInvite(s.email, e)}
                              disabled={resending === s.email}
                              className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded"
                              title="Reenviar email"
                            >
                              {resending === s.email ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                            </button>
                          )}
                          <button
                            onClick={() => setEditingStudentId(s.id)}
                            className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded"
                            title="Editar aluno"
                            aria-label={`Editar ${s.name || s.email || 'aluno'}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {canEnterDashboard ? (
                            <button
                              onClick={() => handleViewAs(s)}
                              className="p-1.5 text-slate-500 hover:text-purple-400 hover:bg-purple-500/10 rounded"
                              title="Entrar no dashboard deste aluno"
                              aria-label={`Entrar no dashboard de ${s.name || s.email}`}
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          ) : (
                            <span
                              className="p-1.5 text-slate-700 cursor-not-allowed"
                              title="Sem email — não tem dashboard"
                            >
                              <Eye className="w-4 h-4" />
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingStudent && (
        <StudentDetailDrawer
          student={editingStudent}
          subscriptions={subscriptions}
          onClose={() => setEditingStudentId(null)}
          onAfterDelete={() => flashSuccess('Aluno removido.')}
        />
      )}

      {showCandidatos && (
        <CandidatosRitualModal
          students={students}
          subscriptions={subscriptions}
          onClose={() => setShowCandidatos(false)}
          onAfterRitual={(s) => flashSuccess(`Ritual iniciado: ${s.name || s.email}.`)}
          onOpenDrawer={(s) => setEditingStudentId(s.id)}
        />
      )}

      <DebugBadge component="StudentsManagement" />
    </div>
  );
};

export default StudentsManagement;
