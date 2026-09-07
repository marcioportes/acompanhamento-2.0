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
import PageHeader from '../components/ui/PageHeader';
import PageBody from '../components/ui/PageBody';
import StatTile from '../components/ui/StatTile';
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
    <>
      <PageHeader
        titulo="Acompanhamento"
        icone={Users}
        contexto="Workspace do mentor · Alpha e Espelho com dashboard ativo."
        acoes={(
          <button
            type="button"
            onClick={() => setShowCandidatos(true)}
            disabled={candidatosCount === 0}
            className="inline-flex items-center gap-2 px-3 h-8 text-[12px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              borderRadius: 'var(--r-sm)',
              border: '1px solid var(--accent-line)',
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
            }}
            title={candidatosCount === 0 ? 'Nenhum candidato no momento' : 'Alunos com Alpha/Espelho em dia que ainda não estão na plataforma'}
          >
            <UserPlus className="w-3.5 h-3.5" strokeWidth={1.75} /> Candidatos a Registro
            {candidatosCount > 0 && <span className="tabular font-semibold">{candidatosCount}</span>}
          </button>
        )}
      />

    <PageBody className="max-w-6xl mx-auto">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <StatTile valor={counts.alpha} rotulo="Alpha" />
        <StatTile valor={counts.espelho} rotulo="Espelho" />
        <StatTile valor={counts.trial} rotulo="Trial" />
        <StatTile
          valor={counts.expiringSoon}
          rotulo="Vencendo ≤7d"
          tom={counts.expiringSoon > 0 ? 'atencao' : 'neutro'}
        />
      </div>

      {/* Filtro por plano — segmented control, o mesmo padrão das abas do mentor. */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="eyebrow flex-shrink-0">Plano</span>
        <div
          className="inline-flex items-center gap-0.5 p-0.5"
          style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r)' }}
        >
          {tierChips.map((f) => {
            const active = tierFilter === f.value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => setTierFilter(f.value)}
                className="flex items-center gap-1.5 px-3 h-7 text-[12px] whitespace-nowrap transition-colors"
                style={{
                  borderRadius: 'var(--r-sm)',
                  background: active ? 'var(--surface-3)' : 'transparent',
                  color: active ? 'var(--ink)' : 'var(--ink-3)',
                  fontWeight: active ? 600 : 400,
                }}
              >
                {f.label}
                <span className="text-[11px] tabular" style={{ color: 'var(--ink-4)' }}>{f.count}</span>
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
        <div className="panel-head">
          <h3 className="panel-title">Alunos cadastrados</h3>
          <p className="meta tabular">{filteredStudents.length} resultado{filteredStudents.length !== 1 ? 's' : ''}</p>
        </div>

        {filteredStudents.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <Mail className="w-6 h-6 mx-auto mb-2" strokeWidth={1.5} style={{ color: 'var(--ink-4)' }} />
            <p className="text-[13px]" style={{ color: 'var(--ink-3)' }}>
              {managedStudents.length === 0 ? 'Nenhum aluno na gestão' : 'Nenhum aluno neste filtro'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase" style={{ letterSpacing: '0.06em', color: 'var(--ink-4)' }}>
                  <th className="text-left font-semibold px-3 py-2" style={{ borderBottom: '1px solid var(--line)' }}>Nome</th>
                  <th className="text-left font-semibold px-3 py-2 whitespace-nowrap" style={{ borderBottom: '1px solid var(--line)' }}>Celular</th>
                  <th className="text-left font-semibold px-3 py-2" style={{ borderBottom: '1px solid var(--line)' }}>Email</th>
                  <th className="text-left font-semibold px-3 py-2 whitespace-nowrap" style={{ borderBottom: '1px solid var(--line)' }}>Status</th>
                  <th className="text-right font-semibold px-3 py-2 whitespace-nowrap" style={{ borderBottom: '1px solid var(--line)' }}>Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--line)' }}>
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
                  // Filete lateral só para o que exige ato: bloqueio e candidato
                  // Alpha. Candidato Espelho já se declara na etiqueta — listra em
                  // doze de doze linhas não distingue ninguém, só risca a tabela.
                  const filete = isBlocked
                    ? 'var(--neg)'
                    : (isCandidato && isAlphaBucket) ? 'var(--warn)' : null;
                  return (
                    <tr
                      key={s.id}
                      className="transition-colors hover:bg-[var(--surface-2)]"
                      style={filete ? { boxShadow: `inset 2px 0 0 ${filete}` } : undefined}
                    >
                      <td className="px-3 py-2.5 font-medium" style={{ color: 'var(--ink)' }}>
                        <div className="flex items-center gap-2 flex-wrap">
                          {isBlocked && (
                            <span title="Login bloqueado" style={{ color: 'var(--neg)' }}>
                              <Lock className="w-3.5 h-3.5" strokeWidth={1.75} />
                            </span>
                          )}
                          <span>{s.name || <span className="italic" style={{ color: 'var(--ink-4)' }}>(sem nome)</span>}</span>
                          {isCandidato && (
                            <span className="chip" title="Candidato — sem Auth user, registrar via lápis">
                              <span className="chip-dot" style={{ background: isAlphaBucket ? 'var(--warn)' : 'var(--ink-4)' }} />
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
                      <td className="px-3 py-2.5" style={{ color: 'var(--ink-2)' }}>
                        {s.email || <span className="italic text-slate-600">—</span>}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <span className={tier.pill}>
                            <span className="chip-dot" style={{ background: tier.cor }} />
                            {tier.label}
                          </span>
                          <span className={accessCfg.pill} title="Acesso à plataforma">
                            <span className="chip-dot" style={{ background: accessCfg.cor }} />
                            {accessCfg.label}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1">
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
                              className="icon-btn"
                              title="Reenviar email"
                            >
                              {resending === s.email ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.75} />}
                            </button>
                          )}
                          <button
                            onClick={() => setEditingStudentId(s.id)}
                            className="icon-btn"
                            title="Editar aluno"
                            aria-label={`Editar ${s.name || s.email || 'aluno'}`}
                          >
                            <Pencil className="w-3.5 h-3.5" strokeWidth={1.75} />
                          </button>
                          {canEnterDashboard ? (
                            <button
                              onClick={() => handleViewAs(s)}
                              className="icon-btn"
                              title="Entrar no dashboard deste aluno"
                              aria-label={`Entrar no dashboard de ${s.name || s.email}`}
                            >
                              <Eye className="w-3.5 h-3.5" strokeWidth={1.75} />
                            </button>
                          ) : (
                            <span className="icon-btn opacity-30 cursor-not-allowed" title="Sem email — não tem dashboard">
                              <Eye className="w-3.5 h-3.5" strokeWidth={1.75} />
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
    </PageBody>
    </>
  );
};

export default StudentsManagement;
