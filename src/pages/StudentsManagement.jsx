/**
 * StudentsManagement
 * @version 3.1.0
 * @description Lista de alunos com chips Alpha/Espelho derivados de student.accessTier.
 *              Row clicável → dashboard via View As (só se aluno tem email).
 *
 * CHANGELOG:
 * - 3.1.0: Hipótese 3 — universo = todos students; Alpha = accessTier==='alpha';
 *          Espelho = todo o resto (leads, ex, self_service, sem accessTier).
 *          Sem cruzar com subscriptions. Click bloqueado se email==null.
 * - 3.0.0: Filtro Alpha/Espelho + click→dashboard. Limpeza N+1 trades + perfil emocional inline.
 * - 2.1.0: StudentEmotionalCard por aluno ativo (Fase 1.4.0)
 * - 2.0.0: View As Student, indicador de erro de email
 */

import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../firebase';
import {
  UserPlus, Mail, CheckCircle, Clock, Users, Loader2, RefreshCw,
  AlertTriangle, Phone, Check, X, ChevronRight,
} from 'lucide-react';
import { validateWhatsappNumber, formatWhatsappDisplay } from '../utils/whatsappValidation';
import DebugBadge from '../components/DebugBadge';
import AssessmentToggle from '../components/Onboarding/AssessmentToggle';
import AddStudentModal from '../components/Students/AddStudentModal';

// Bucket binário derivado do accessTier do student (mantido por checkSubscriptions CF).
// Alpha = tem dashboard. Espelho = todo o resto (lead, ex, self_service ativo, sem sub, etc).
const tierOf = (s) => (s?.accessTier === 'alpha' ? 'alpha' : 'espelho');

const TIER_LABELS = { alpha: 'Mentoria Alpha', espelho: 'Espelho' };
const TIER_BADGE_CLASS = {
  alpha: 'bg-purple-500/15 text-purple-400',
  espelho: 'bg-cyan-500/15 text-cyan-400',
};

/**
 * @param {Function} onViewAsStudent - Callback para View As Student
 */
const StudentsManagement = ({ onViewAsStudent }) => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [resending, setResending] = useState(null);
  const [editingWhatsapp, setEditingWhatsapp] = useState(null);
  const [whatsappInput, setWhatsappInput] = useState('');
  const [whatsappError, setWhatsappError] = useState('');
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);
  const [tierFilter, setTierFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);

  const functions = getFunctions();

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

  const filteredStudents =
    tierFilter === 'all' ? students : students.filter((s) => tierOf(s) === tierFilter);

  const flashSuccess = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 5000);
  };

  // Callbacks consumidos por AddStudentModal — retornam {ok, message}.
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

  const handleResendInvite = async (email) => {
    setResending(email);
    try {
      const resendInvite = httpsCallable(functions, 'resendStudentInvite');
      await resendInvite({ email });
      setSuccess('Email reenviado!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Erro ao reenviar: ' + err.message);
    } finally { setResending(null); }
  };

  const handleWhatsappEdit = (student) => {
    setEditingWhatsapp(student.id);
    setWhatsappInput(student.whatsappNumber ?? '');
    setWhatsappError('');
  };

  const handleWhatsappSave = async (studentId) => {
    const result = validateWhatsappNumber(whatsappInput);
    if (!result.valid) {
      setWhatsappError(result.error);
      return;
    }
    setSavingWhatsapp(true);
    try {
      await updateDoc(doc(db, 'students', studentId), {
        whatsappNumber: result.sanitized,
      });
      setEditingWhatsapp(null);
      setWhatsappInput('');
      setWhatsappError('');
    } catch (err) {
      setWhatsappError('Erro ao salvar: ' + err.message);
    } finally {
      setSavingWhatsapp(false);
    }
  };

  const handleWhatsappCancel = () => {
    setEditingWhatsapp(null);
    setWhatsappInput('');
    setWhatsappError('');
  };

  // Sem email no doc do student não há Auth user — não tem dashboard pra entrar.
  const canViewAs = (student) => Boolean(student?.email);

  const handleViewAs = (student) => {
    if (!canViewAs(student) || !onViewAsStudent) return;
    onViewAsStudent({
      uid: student.uid || student.id,
      email: student.email,
      name: student.name,
    });
  };

  const totalCount = students.length;
  const alphaCount = students.filter((s) => tierOf(s) === 'alpha').length;
  const espelhoCount = totalCount - alphaCount;
  const pendingCount = students.filter((s) => s.status === 'pending').length;

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>;
  }

  const tierChips = [
    { value: 'all',     label: 'Todos',          count: totalCount },
    { value: 'alpha',   label: 'Mentoria Alpha', count: alphaCount },
    { value: 'espelho', label: 'Espelho',        count: espelhoCount },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto pb-20">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-white flex items-center gap-3">
            <Users className="w-7 h-7 text-blue-400" />Alunos
          </h1>
          <p className="text-slate-400 mt-1">Lista de alunos Alpha e Espelho · clique para entrar no dashboard</p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium flex-shrink-0"
        >
          <UserPlus className="w-4 h-4" /> Novo aluno
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="glass-card p-4 text-center"><p className="text-2xl font-bold text-white">{totalCount}</p><p className="text-xs text-slate-400">Total</p></div>
        <div className="glass-card p-4 text-center"><p className="text-2xl font-bold text-purple-400">{alphaCount}</p><p className="text-xs text-slate-400">Alpha</p></div>
        <div className="glass-card p-4 text-center"><p className="text-2xl font-bold text-cyan-400">{espelhoCount}</p><p className="text-xs text-slate-400">Espelho</p></div>
        <div className="glass-card p-4 text-center"><p className="text-2xl font-bold text-yellow-400">{pendingCount}</p><p className="text-xs text-slate-400">Pendentes</p></div>
      </div>

      <div className="glass-card p-3 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-slate-500 w-16 flex-shrink-0">Plano</span>
          {tierChips.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setTierFilter(f.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors ${tierFilter === f.value ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-slate-700/30'}`}
            >
              {f.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${tierFilter === f.value ? 'bg-blue-500/30' : 'bg-slate-700/50'}`}>{f.count}</span>
            </button>
          ))}
        </div>
      </div>

      {success && <div className="mb-4 p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm flex items-center gap-2"><CheckCircle className="w-4 h-4" />{success}</div>}
      {error && <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>}

      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-slate-800/50 flex items-center justify-between">
          <h3 className="font-semibold text-white">Alunos Cadastrados</h3>
          <p className="text-xs text-slate-500">{filteredStudents.length} resultado{filteredStudents.length !== 1 ? 's' : ''}</p>
        </div>
        {filteredStudents.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <Mail className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>{students.length === 0 ? 'Nenhum aluno cadastrado' : 'Nenhum aluno neste filtro'}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/50">
            {filteredStudents.map((s) => {
              const tier = tierOf(s);
              const clickable = canViewAs(s);
              return (
                <div
                  key={s.id}
                  role={clickable ? 'button' : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  onClick={clickable ? () => handleViewAs(s) : undefined}
                  onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleViewAs(s); } } : undefined}
                  className={`p-4 transition-colors ${clickable ? 'hover:bg-slate-800/30 cursor-pointer focus:outline-none focus:bg-slate-800/30' : 'opacity-80'}`}
                  title={clickable ? 'Clique para entrar no dashboard deste aluno' : 'Sem email — não tem dashboard'}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${s.status === 'active' ? 'bg-gradient-to-br from-emerald-500 to-green-600' : 'bg-gradient-to-br from-slate-600 to-slate-700'}`}>
                        {(s.name || s.email).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-white">{s.name || '-'}</p>
                        <p className="text-sm text-slate-500">{s.email || <span className="italic text-slate-600">sem email</span>}</p>
                        <div onClick={(e) => e.stopPropagation()}>
                          {editingWhatsapp === s.id ? (
                            <div className="flex items-center gap-1.5 mt-1">
                              <Phone className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                              <input
                                type="text"
                                value={whatsappInput}
                                onChange={(e) => { setWhatsappInput(e.target.value); setWhatsappError(''); }}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleWhatsappSave(s.id); if (e.key === 'Escape') handleWhatsappCancel(); }}
                                placeholder="+55 11 99999-9999"
                                className="bg-slate-800 border border-slate-600 rounded px-2 py-0.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none w-40"
                                autoFocus
                                disabled={savingWhatsapp}
                              />
                              <button onClick={() => handleWhatsappSave(s.id)} disabled={savingWhatsapp} className="p-0.5 text-emerald-400 hover:text-emerald-300" title="Salvar">
                                {savingWhatsapp ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                              </button>
                              <button onClick={handleWhatsappCancel} className="p-0.5 text-slate-500 hover:text-red-400" title="Cancelar">
                                <X className="w-3 h-3" />
                              </button>
                              {whatsappError && <span className="text-xs text-red-400">{whatsappError}</span>}
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleWhatsappEdit(s)}
                              className="flex items-center gap-1 mt-1 text-xs text-slate-500 hover:text-emerald-400 transition-colors"
                              title="Editar WhatsApp"
                            >
                              <Phone className="w-3 h-3" />
                              {s.whatsappNumber ? formatWhatsappDisplay(s.whatsappNumber) : 'Adicionar WhatsApp'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <span className={`px-2 py-1 rounded-lg text-[11px] font-medium ${TIER_BADGE_CLASS[tier]}`}>
                        {TIER_LABELS[tier]}
                      </span>

                      <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${s.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                        {s.status === 'active' ? <><CheckCircle className="w-3 h-3" />Ativo</> : <><Clock className="w-3 h-3" />Pendente</>}
                      </div>

                      {s.emailError && (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400" title={s.emailError}>
                          <AlertTriangle className="w-3 h-3" />Erro Email
                        </div>
                      )}

                      <AssessmentToggle
                        studentId={s.id}
                        currentValue={s.requiresAssessment}
                        onboardingStatus={s.onboardingStatus}
                      />

                      {s.status === 'pending' && s.email && (
                        <button onClick={() => handleResendInvite(s.email)} disabled={resending === s.email} className="p-2 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg" title="Reenviar email">
                          {resending === s.email ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        </button>
                      )}

                      {clickable && <ChevronRight className="w-4 h-4 text-slate-600" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-6 text-xs text-slate-500">
        <div className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-emerald-400" /><span>Já configurou senha</span></div>
        <div className="flex items-center gap-2"><Clock className="w-3 h-3 text-yellow-400" /><span>Aguardando configurar senha</span></div>
        <div className="flex items-center gap-2"><AlertTriangle className="w-3 h-3 text-red-400" /><span>Erro no envio de email</span></div>
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
