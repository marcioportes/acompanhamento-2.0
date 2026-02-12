import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { UserPlus, Trash2, Mail, CheckCircle, Clock, Users, AlertCircle, Loader2, RefreshCw } from 'lucide-react';

const StudentsManagement = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [adding, setAdding] = useState(false);
  const [resending, setResending] = useState(null);

  const functions = getFunctions();

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

  const handleAddStudent = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    const email = newEmail.trim().toLowerCase();
    const name = newName.trim();
    if (!email) { setError('Email obrigatório'); return; }
    if (!email.includes('@')) { setError('Email inválido'); return; }
    if (students.some(s => s.email === email)) { setError('Email já cadastrado'); return; }
    
    setAdding(true);
    try {
      const createStudent = httpsCallable(functions, 'createStudent');
      await createStudent({ email, name });
      setNewEmail(''); setNewName('');
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

  const handleRemove = async (student) => {
    if (!confirm('Remover ' + student.email + '?\n\nIsso também remove o acesso ao sistema.')) return;
    try {
      const deleteStudent = httpsCallable(functions, 'deleteStudent');
      await deleteStudent({ uid: student.uid || student.id, email: student.email });
    } catch (err) { setError('Erro: ' + err.message); }
  };

  const activeCount = students.filter(s => s.status === 'active').length;
  const pendingCount = students.filter(s => s.status === 'pending').length;

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>;

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-display font-bold text-white flex items-center gap-3">
          <Users className="w-7 h-7 text-blue-400" />Gerenciar Alunos
        </h1>
        <p className="text-slate-400 mt-1">Cadastre alunos - eles receberão email para configurar senha</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="glass-card p-4 text-center"><p className="text-2xl font-bold text-white">{students.length}</p><p className="text-xs text-slate-400">Total</p></div>
        <div className="glass-card p-4 text-center"><p className="text-2xl font-bold text-emerald-400">{activeCount}</p><p className="text-xs text-slate-400">Ativos</p></div>
        <div className="glass-card p-4 text-center"><p className="text-2xl font-bold text-yellow-400">{pendingCount}</p><p className="text-xs text-slate-400">Pendentes</p></div>
      </div>

      {success && <div className="mb-4 p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm flex items-center gap-2"><CheckCircle className="w-4 h-4" />{success}</div>}

      <form onSubmit={handleAddStudent} className="glass-card p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <input type="email" placeholder="Email do aluno *" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none" />
          <input type="text" placeholder="Nome" value={newName} onChange={(e) => setNewName(e.target.value)} className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none" />
          <button type="submit" disabled={adding} className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium disabled:opacity-50">
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}Adicionar
          </button>
        </div>
        {error && <div className="mt-3 flex items-center gap-2 text-red-400 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
      </form>

      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-slate-800/50"><h3 className="font-semibold text-white">Alunos Cadastrados</h3></div>
        {students.length === 0 ? (
          <div className="p-8 text-center text-slate-500"><Mail className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>Nenhum aluno cadastrado</p></div>
        ) : (
          <div className="divide-y divide-slate-800/50">
            {students.map(s => (
              <div key={s.id} className="p-4 flex items-center justify-between hover:bg-slate-800/30">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${s.status === 'active' ? 'bg-gradient-to-br from-emerald-500 to-green-600' : 'bg-gradient-to-br from-slate-600 to-slate-700'}`}>
                    {(s.name || s.email).charAt(0).toUpperCase()}
                  </div>
                  <div><p className="font-medium text-white">{s.name || '-'}</p><p className="text-sm text-slate-500">{s.email}</p></div>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${s.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                    {s.status === 'active' ? <><CheckCircle className="w-3 h-3" />Ativo</> : <><Clock className="w-3 h-3" />Pendente</>}
                  </div>
                  {s.status === 'pending' && (
                    <button onClick={() => handleResendInvite(s.email)} disabled={resending === s.email} className="p-2 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg" title="Reenviar email">
                      {resending === s.email ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    </button>
                  )}
                  <button onClick={() => handleRemove(s)} className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg" title="Remover">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-6 text-xs text-slate-500">
        <div className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-emerald-400" /><span>Já configurou senha</span></div>
        <div className="flex items-center gap-2"><Clock className="w-3 h-3 text-yellow-400" /><span>Aguardando configurar senha</span></div>
      </div>
    </div>
  );
};

export default StudentsManagement;
