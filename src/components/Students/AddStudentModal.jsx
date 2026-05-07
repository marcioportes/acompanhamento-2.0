/**
 * AddStudentModal
 * @description Modal para criar novo aluno com sugestões de duplicado.
 *              Acionado pelo botão "+ Novo aluno" em StudentsManagement.
 *              Extraído do form inline da v2.x — issue #263.
 */

import { useState, useMemo } from 'react';
import {
  UserPlus, Loader2, AlertCircle, AlertTriangle, X,
} from 'lucide-react';
import { normalizeName, normalizeEmail } from '../../utils/contactsNormalizer';
import { formatWhatsappDisplay } from '../../utils/whatsappValidation';

/**
 * @param {Array}    students         - Universo (managedStudents) para sugestões de duplicado
 * @param {Function} onCreate         - async ({name, email, celular}) => {ok, message}
 * @param {Function} onUseExisting    - async (existingStudent, {email, celular}) => {ok, message}
 * @param {Function} onClose          - () => void
 */
const AddStudentModal = ({ students, onCreate, onUseExisting, onClose }) => {
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newCelular, setNewCelular] = useState('');
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);

  const suggestions = useMemo(() => {
    const tName = normalizeName(newName);
    const tEmail = normalizeEmail(newEmail);
    const tPhoneTail = String(newCelular ?? '').replace(/\D/g, '').slice(-8);
    if (!tName && !tEmail && !tPhoneTail) return [];
    const matches = [];
    for (const s of students) {
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
  }, [newName, newEmail, newCelular, students]);

  const emailDuplicate = suggestions.some(({ reasons }) => reasons.includes('email'));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const email = newEmail.trim().toLowerCase();
    const name = newName.trim();
    const celular = newCelular.trim();
    if (!email) { setError('Email obrigatório'); return; }
    if (!email.includes('@')) { setError('Email inválido'); return; }
    if (emailDuplicate) {
      setError('Email já existe — selecione um aluno na lista acima para atualizar');
      return;
    }
    setAdding(true);
    const res = await onCreate({ name, email, celular });
    setAdding(false);
    if (res?.ok) onClose();
    else setError(res?.message || 'Erro ao criar aluno');
  };

  const handleUseExisting = async (existing) => {
    setError('');
    setAdding(true);
    const email = newEmail.trim().toLowerCase();
    const celular = newCelular.trim();
    const res = await onUseExisting(existing, { email, celular });
    setAdding(false);
    if (res?.ok) onClose();
    else setError(res?.message || 'Erro ao atualizar');
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-auto"
      onClick={onClose}
    >
      <div
        className="glass-card w-full max-w-xl p-6 my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-400" /> Novo aluno
            </h2>
            <p className="text-xs text-slate-400 mt-1">Receberá email para configurar senha</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-500 hover:text-white"
            title="Fechar"
            disabled={adding}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            placeholder="Nome"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            disabled={adding}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
          />
          <input
            type="email"
            placeholder="Email do aluno *"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            disabled={adding}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
          />
          <input
            type="text"
            placeholder="Celular (+5521...)"
            value={newCelular}
            onChange={(e) => setNewCelular(e.target.value)}
            disabled={adding}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
          />

          {suggestions.length > 0 && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
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
                    <button
                      type="button"
                      onClick={() => handleUseExisting(student)}
                      disabled={adding}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg disabled:opacity-50 flex-shrink-0"
                    >
                      Usar este
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                {emailDuplicate
                  ? 'Email já existe — selecione um aluno acima para atualizar.'
                  : 'Se não for nenhum, clique em Adicionar para criar novo.'}
              </p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={adding}
              className="px-4 py-2.5 text-slate-400 hover:text-white rounded-lg text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={adding}
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium disabled:opacity-50"
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Adicionar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddStudentModal;
