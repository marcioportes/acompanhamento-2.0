/**
 * StudentsManagement
 * @version 4.1.0
 * @description Gestão de alunos com 3 buckets: Alpha, Espelho, Trial (subdividido
 *              em Trial·Alpha e Trial·Espelho). Quem não tem sub ativa OU é VIP
 *              não aparece nesta tela.
 *
 * CHANGELOG:
 * - 4.1.0: Buckets reduzidos para alpha/espelho/trial. Classificação pela sub
 *          ativa mais recente (não pelo accessTier). Lead/Ex/VIP saíram.
 * - 4.0.0: Tabela (vs cards). 6 chips. Stats Alpha/Espelho/VIP/Vencendo ≤7d.
 * - 3.1.0: Alpha/Espelho via accessTier; row clicável → View As.
 * - 3.0.0: Filtro Alpha/Espelho + click→dashboard. Limpeza N+1 trades.
 */

import { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../firebase';
import {
  UserPlus, Mail, Users, Loader2, RefreshCw, AlertTriangle, ChevronRight,
} from 'lucide-react';
import { formatWhatsappDisplay } from '../utils/whatsappValidation';
import DebugBadge from '../components/DebugBadge';
import AssessmentToggle from '../components/Onboarding/AssessmentToggle';
import AddStudentModal from '../components/Students/AddStudentModal';
import { useSubscriptions } from '../hooks/useSubscriptions';
import { classifyStudent, isExpiringSoon, tierGroup, TIER_CONFIG } from '../utils/studentClassify';

const StudentsManagement = ({ onViewAsStudent }) => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [resending, setResending] = useState(null);
  const [tierFilter, setTierFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);

  const functions = getFunctions();
  const { subscriptions, loading: subsLoading } = useSubscriptions();

  useEffect(() => {
    const q = query(collection(db, 'students'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setStudents(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

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

  const counts = useMemo(() => {
    const c = { all: managedStudents.length, alpha: 0, espelho: 0, trial: 0, 'sem-plano': 0 };
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

  const createStudentFromModal = async ({ name, email, celular }) => {
    try {
      const createStudent = httpsCallable(functions, 'createStudent');
      const { data: result } = await createStudent({ email, name });
      if (celular && result?.uid) {
        await updateDoc(doc(db, 'students', result.uid), { whatsappNumber: celular });
      }
      flashSuccess('Aluno criado! Email de configuração enviado.');
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err.message || 'Erro ao criar aluno' };
    }
  };

  const useExistingFromModal = async (existing, { email, celular }) => {
    try {
      const updates = { updatedAt: new Date() };
      if (email && !existing.email) updates.email = email;
      if (celular && (existing.whatsappNumber ?? '') !== celular) updates.whatsappNumber = celular;
      if (Object.keys(updates).length > 1) {
        await updateDoc(doc(db, 'students', existing.id), updates);
        flashSuccess(`${existing.name ?? 'Aluno'}: dados completados.`);
      } else {
        flashSuccess(`${existing.name ?? 'Aluno'} já tem esses dados — nada a alterar.`);
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err.message || 'Erro ao atualizar' };
    }
  };

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
    // Aparece só quando há alguém órfão de plano (criado mas sem sub atribuída,
    // ou todas as subs canceladas). Permite o mentor agir.
    ...(counts['sem-plano'] > 0
      ? [{ value: 'sem-plano', label: 'Sem plano', count: counts['sem-plano'] }]
      : []),
  ];

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto pb-20">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-white flex items-center gap-3">
            <Users className="w-7 h-7 text-blue-400" />Alunos
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            Cadastro mestre · Alpha (com dashboard), Espelho, VIP, leads e ex-alunos.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium flex-shrink-0"
        >
          <UserPlus className="w-4 h-4" /> Novo aluno
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
                  <th className="text-left font-semibold px-4 py-3">Celular</th>
                  <th className="text-left font-semibold px-4 py-3">Email</th>
                  <th className="text-left font-semibold px-4 py-3">Status</th>
                  <th className="text-right font-semibold px-4 py-3 w-1">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/30">
                {filteredStudents.map((s) => {
                  const bucket = studentBucket.get(s.id);
                  const tier = TIER_CONFIG[bucket];
                  if (!tier) return null;
                  const isAlphaBucket = bucket === 'alpha' || bucket === 'trial-alpha';
                  const clickable = canViewAs(s);
                  const isPending = s.status === 'pending';
                  return (
                    <tr
                      key={s.id}
                      role={clickable ? 'button' : undefined}
                      tabIndex={clickable ? 0 : undefined}
                      onClick={clickable ? () => handleViewAs(s) : undefined}
                      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleViewAs(s); } } : undefined}
                      className={`transition-colors ${clickable ? 'hover:bg-slate-800/30 cursor-pointer focus:outline-none focus:bg-slate-800/30' : 'opacity-80'}`}
                      title={clickable ? 'Clique para entrar no dashboard deste aluno' : 'Sem email — não tem dashboard'}
                    >
                      <td className="px-4 py-3 font-medium text-white">
                        {s.name || <span className="italic text-slate-500">(sem nome)</span>}
                        {s.emailError && (
                          <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-red-400" title={s.emailError}>
                            <AlertTriangle className="w-3 h-3" /> erro email
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                        {s.whatsappNumber ? formatWhatsappDisplay(s.whatsappNumber) : <span className="italic text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {s.email || <span className="italic text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${tier.pill}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${tier.dot}`} />
                          {tier.label}
                        </span>
                        {isPending && (
                          <span className="ml-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-yellow-500/15 text-yellow-300 border border-yellow-500/30">
                            pendente
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
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
                          {clickable && <ChevronRight className="w-4 h-4 text-slate-600" />}
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

      {showAddModal && (
        <AddStudentModal
          students={students}
          onCreate={createStudentFromModal}
          onUseExisting={useExistingFromModal}
          onClose={() => setShowAddModal(false)}
        />
      )}

      <DebugBadge component="StudentsManagement" />
    </div>
  );
};

export default StudentsManagement;
