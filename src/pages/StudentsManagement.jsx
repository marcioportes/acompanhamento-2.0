/**
 * StudentsManagement
 * @version 2.1.0
 * @description Gerenciamento de alunos com View As, indicador erro email, perfil emocional
 * 
 * CHANGELOG:
 * - 2.1.0: StudentEmotionalCard por aluno ativo (Fase 1.4.0)
 * - 2.0.0: View As Student, indicador de erro de email
 */

import { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { UserPlus, Mail, CheckCircle, Clock, Users, AlertCircle, Loader2, RefreshCw, Eye, AlertTriangle, Brain, Phone, Check, X } from 'lucide-react';
import { validateWhatsappNumber, formatWhatsappDisplay } from '../utils/whatsappValidation';
import StudentEmotionalCard from '../components/StudentEmotionalCard';
import DebugBadge from '../components/DebugBadge';
import AssessmentToggle from '../components/Onboarding/AssessmentToggle';
import { useEmotionalProfile } from '../hooks/useEmotionalProfile';
import { useComplianceRules } from '../hooks/useComplianceRules';
import { useSubscriptions } from '../hooks/useSubscriptions';
import { normalizeName, normalizeEmail } from '../utils/contactsNormalizer';

/**
 * @param {Function} onViewAsStudent - Callback para View As Student
 */
const StudentsManagement = ({ onViewAsStudent }) => {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newCelular, setNewCelular] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [adding, setAdding] = useState(false);
  const [resending, setResending] = useState(null);
  const [studentTrades, setStudentTrades] = useState({}); // { email: trades[] }
  const [editingWhatsapp, setEditingWhatsapp] = useState(null); // studentId being edited
  const [whatsappInput, setWhatsappInput] = useState('');
  const [whatsappError, setWhatsappError] = useState('');
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);

  const functions = getFunctions();
  const { detectionConfig, statusThresholds } = useComplianceRules();
  const { subscriptions } = useSubscriptions();
  const alphaStudentIds = new Set(
    (subscriptions ?? []).filter(s => s.plan === 'alpha' && s.status !== 'cancelled').map(s => s.studentId)
  );

  useEffect(() => {
    const q = query(collection(db, 'students'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setStudents(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Carregar trades dos alunos ativos para perfil emocional
  useEffect(() => {
    const activeStudents = students.filter(s => s.status === 'active');
    if (activeStudents.length === 0) return;

    const unsubscribes = activeStudents.map(s => {
      const q = query(collection(db, 'trades'), where('studentEmail', '==', s.email));
      return onSnapshot(q, (snap) => {
        const trades = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setStudentTrades(prev => ({ ...prev, [s.email]: trades }));
      });
    });

    return () => unsubscribes.forEach(u => u());
  }, [students]);

  // Busca de proximidade — match por nome (exato/contém), email ou últimos 8 dígitos do celular
  // Sugestões live — busca apenas entre alunos Alpha (esta tela só lista Alpha).
  // Match: nome exato/contém substring, email exato, ou últimos 8 dígitos do celular.
  const suggestions = useMemo(() => {
    const tName = normalizeName(newName);
    const tEmail = normalizeEmail(newEmail);
    const tPhoneTail = String(newCelular ?? '').replace(/\D/g, '').slice(-8);
    if (!tName && !tEmail && !tPhoneTail) return [];
    const universe = students.filter(s => alphaStudentIds.has(s.id));
    const matches = [];
    for (const s of universe) {
      const sName = normalizeName(s.name ?? '');
      const sEmail = normalizeEmail(s.email ?? '');
      const sPhoneTail = String(s.whatsappNumber ?? '').replace(/\D/g, '').slice(-8);
      const reasons = [];
      if (tName && sName) {
        if (sName === tName) reasons.push('nome exato');
        else if (sName.includes(tName) || tName.includes(sName)) reasons.push('nome similar');
      }
      if (tEmail && sEmail && sEmail === tEmail) reasons.push('email');
      if (tPhoneTail && sPhoneTail && tPhoneTail === sPhoneTail) reasons.push('celular');
      if (reasons.length) matches.push({ student: s, reasons });
    }
    return matches.slice(0, 8);
  }, [newName, newEmail, newCelular, students, alphaStudentIds]);

  const emailDuplicate = suggestions.some(({ reasons }) => reasons.includes('email'));

  // Não toca nome, plano, pagamento, status. Só preenche email (se vazio) e celular (se diferente).
  const useExistingStudent = async (existing) => {
    setError(''); setSuccess('');
    const email = newEmail.trim().toLowerCase();
    const celular = newCelular.trim();
    setAdding(true);
    try {
      const updates = { updatedAt: new Date() };
      if (email && !existing.email) updates.email = email;
      if (celular && (existing.whatsappNumber ?? '') !== celular) updates.whatsappNumber = celular;
      if (Object.keys(updates).length > 1) {
        await updateDoc(doc(db, 'students', existing.id), updates);
        setSuccess(`${existing.name ?? 'Aluno'}: dados completados.`);
      } else {
        setSuccess(`${existing.name ?? 'Aluno'} já tem esses dados — nada a alterar.`);
      }
      setNewEmail(''); setNewName(''); setNewCelular('');
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.message || 'Erro ao atualizar');
    } finally { setAdding(false); }
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    const email = newEmail.trim().toLowerCase();
    const name = newName.trim();
    const celular = newCelular.trim();
    if (!email) { setError('Email obrigatório'); return; }
    if (!email.includes('@')) { setError('Email inválido'); return; }
    if (emailDuplicate) { setError('Email já existe — selecione um aluno na lista acima para atualizar/migrar plano'); return; }

    setAdding(true);
    try {
      const createStudent = httpsCallable(functions, 'createStudent');
      const { data: result } = await createStudent({ email, name });
      if (celular && result?.uid) {
        await updateDoc(doc(db, 'students', result.uid), { whatsappNumber: celular });
      }
      setNewEmail(''); setNewName(''); setNewCelular('');
      setSuccess('Aluno criado! Email de configuração enviado.');
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.message || 'Erro ao criar aluno');
    } finally { setAdding(false); }
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

  const handleViewAs = (student, focusTab = null) => {
    if (onViewAsStudent) {
      onViewAsStudent({
        uid: student.uid || student.id,
        email: student.email,
        name: student.name,
        focusTab, // B3: 'emotional' para abrir perfil emocional diretamente
      });
    }
  };

  const alphaStudents = students.filter(s => alphaStudentIds.has(s.id));
  const activeCount = alphaStudents.filter(s => s.status === 'active').length;
  const pendingCount = alphaStudents.filter(s => s.status === 'pending').length;
  const errorCount = alphaStudents.filter(s => s.emailError).length;

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>;

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-display font-bold text-white flex items-center gap-3">
          <Users className="w-7 h-7 text-blue-400" />Gerenciar Alunos
        </h1>
        <p className="text-slate-400 mt-1">Cadastre alunos - eles receberão email para configurar senha</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="glass-card p-4 text-center"><p className="text-2xl font-bold text-white">{alphaStudents.length}</p><p className="text-xs text-slate-400">Total Alpha</p></div>
        <div className="glass-card p-4 text-center"><p className="text-2xl font-bold text-emerald-400">{activeCount}</p><p className="text-xs text-slate-400">Ativos</p></div>
        <div className="glass-card p-4 text-center"><p className="text-2xl font-bold text-yellow-400">{pendingCount}</p><p className="text-xs text-slate-400">Pendentes</p></div>
        <div className="glass-card p-4 text-center"><p className="text-2xl font-bold text-red-400">{errorCount}</p><p className="text-xs text-slate-400">Erro Email</p></div>
      </div>

      {success && <div className="mb-4 p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm flex items-center gap-2"><CheckCircle className="w-4 h-4" />{success}</div>}

      <form onSubmit={handleAddStudent} className="glass-card p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <input type="text" placeholder="Nome" value={newName} onChange={(e) => setNewName(e.target.value)} className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none" />
          <input type="email" placeholder="Email do aluno *" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none" />
          <input type="text" placeholder="Celular (+5521...)" value={newCelular} onChange={(e) => setNewCelular(e.target.value)} className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none" />
          <button type="submit" disabled={adding} className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium disabled:opacity-50">
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}Adicionar
          </button>
        </div>
        {suggestions.length > 0 && (
          <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <div className="flex items-center gap-2 text-amber-400 text-sm font-medium mb-2">
              <AlertTriangle className="w-4 h-4" />
              {suggestions.length} aluno{suggestions.length > 1 ? 's' : ''} semelhante{suggestions.length > 1 ? 's' : ''}:
            </div>
            <div className="space-y-2">
              {suggestions.map(({ student, reasons }) => (
                <div key={student.id} className="flex items-center justify-between gap-2 p-2 bg-slate-800/50 rounded">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{student.name ?? '(sem nome)'}</p>
                    <p className="text-xs text-slate-400 truncate">
                      {student.email ?? '(sem email)'}
                      {student.whatsappNumber && ` · ${formatWhatsappDisplay(student.whatsappNumber)}`}
                    </p>
                    <p className="text-[10px] text-amber-400 mt-0.5">match: {reasons.join(', ')}</p>
                  </div>
                  <button type="button" onClick={() => useExistingStudent(student)} disabled={adding} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg disabled:opacity-50 flex-shrink-0">
                    Usar este
                  </button>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              {emailDuplicate
                ? 'Email já existe — selecione um aluno acima para atualizar/migrar plano.'
                : 'Se não for nenhum, clique em Adicionar para criar novo.'}
            </p>
          </div>
        )}
        {error && <div className="mt-3 flex items-center gap-2 text-red-400 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
      </form>

      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-slate-800/50"><h3 className="font-semibold text-white">Alunos Cadastrados</h3></div>
        {students.length === 0 ? (
          <div className="p-8 text-center text-slate-500"><Mail className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>Nenhum aluno cadastrado</p></div>
        ) : (
          <div className="divide-y divide-slate-800/50">
            {students.filter(s => alphaStudentIds.has(s.id)).map(s => (
              <div key={s.id} className="p-4 hover:bg-slate-800/30">
                <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${s.status === 'active' ? 'bg-gradient-to-br from-emerald-500 to-green-600' : 'bg-gradient-to-br from-slate-600 to-slate-700'}`}>
                    {(s.name || s.email).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-white">{s.name || '-'}</p>
                    <p className="text-sm text-slate-500">{s.email}</p>
                    {/* WhatsApp inline — issue #123 */}
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
                <div className="flex items-center gap-3">
                  {/* Status Badge */}
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${s.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                    {s.status === 'active' ? <><CheckCircle className="w-3 h-3" />Ativo</> : <><Clock className="w-3 h-3" />Pendente</>}
                  </div>
                  
                  {/* Erro de Email Badge */}
                  {s.emailError && (
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400" title={s.emailError}>
                      <AlertTriangle className="w-3 h-3" />Erro Email
                    </div>
                  )}
                  
                  {/* Assessment Toggle (CHUNK-09) */}
                  <AssessmentToggle
                    studentId={s.id}
                    currentValue={s.requiresAssessment}
                    onboardingStatus={s.onboardingStatus}
                  />

                  {/* Botão View As Student (só para ativos) */}
                  {s.status === 'active' && onViewAsStudent && (
                    <button 
                      onClick={() => handleViewAs(s)} 
                      className="p-2 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg" 
                      title="Visualizar como este aluno"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}

                  {/* B3: Botão Perfil Emocional (só para ativos com trades) */}
                  {s.status === 'active' && studentTrades[s.email]?.length > 0 && onViewAsStudent && (
                    <button 
                      onClick={() => handleViewAs(s, 'emotional')} 
                      className="p-2 text-slate-500 hover:text-purple-400 hover:bg-purple-500/10 rounded-lg" 
                      title="Ver perfil emocional do aluno"
                    >
                      <Brain className="w-4 h-4" />
                    </button>
                  )}
                  
                  {/* Botão Reenviar (só para pendentes) */}
                  {s.status === 'pending' && (
                    <button onClick={() => handleResendInvite(s.email)} disabled={resending === s.email} className="p-2 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg" title="Reenviar email">
                      {resending === s.email ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    </button>
                  )}
                  
                </div>
                </div>
                {/* Card Emocional — só alunos ativos com trades */}
                {s.status === 'active' && studentTrades[s.email]?.length > 0 && (
                  <StudentEmotionalCardInline
                    trades={studentTrades[s.email]}
                    studentName={s.name}
                    detectionConfig={detectionConfig}
                    statusThresholds={statusThresholds}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-6 text-xs text-slate-500">
        <div className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-emerald-400" /><span>Já configurou senha</span></div>
        <div className="flex items-center gap-2"><Clock className="w-3 h-3 text-yellow-400" /><span>Aguardando configurar senha</span></div>
        <div className="flex items-center gap-2"><AlertTriangle className="w-3 h-3 text-red-400" /><span>Erro no envio de email</span></div>
      </div>
      <DebugBadge component="StudentsManagement" />
    </div>
  );
};

/** Wrapper isolado para hook useEmotionalProfile por aluno */
const StudentEmotionalCardInline = ({ trades, studentName, detectionConfig, statusThresholds }) => {
  const { metrics, status, alerts, isReady } = useEmotionalProfile({
    trades, detectionConfig, statusThresholds
  });
  if (!isReady) return null;
  return (
    <div className="mt-2 ml-14">
      <StudentEmotionalCard metrics={metrics} status={status} alerts={alerts} studentName={studentName} />
    </div>
  );
};

export default StudentsManagement;
