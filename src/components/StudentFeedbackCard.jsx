/**
 * StudentFeedbackCard
 * @version 1.2.0
 * @description Card resumo de feedback por aluno com contadores clicáveis
 */

import { Clock, HelpCircle, CheckCircle, Lock, User } from 'lucide-react';

const StudentFeedbackCard = ({ 
  student, 
  counts, 
  onClickOpen, 
  onClickQuestion,
  onClickAll
}) => {
  const { open = 0, question = 0, reviewed = 0, closed = 0 } = counts;
  const hasActions = open > 0 || question > 0;

  return (
    <div 
      className={`glass-card p-4 transition-all hover:border-slate-600 ${
        hasActions ? 'border-l-4 border-l-blue-500' : ''
      }`}
    >
      {/* Header: Avatar + Nome */}
      <div 
        className="flex items-center gap-3 mb-4 cursor-pointer hover:opacity-80"
        onClick={onClickAll}
      >
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
          {student.name?.charAt(0)?.toUpperCase() || <User className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white truncate">{student.name}</p>
          <p className="text-xs text-slate-500 truncate">{student.email}</p>
        </div>
      </div>

      {/* Contadores Clicáveis */}
      <div className="grid grid-cols-2 gap-2">
        {/* OPEN - Aguardando Feedback */}
        <button
          onClick={onClickOpen}
          disabled={open === 0}
          className={`flex items-center gap-2 p-3 rounded-lg transition-all ${
            open > 0 
              ? 'bg-slate-700/50 hover:bg-blue-500/20 hover:border-blue-500/50 border border-transparent cursor-pointer' 
              : 'bg-slate-800/30 cursor-default opacity-50'
          }`}
        >
          <div className={`p-1.5 rounded-lg ${open > 0 ? 'bg-blue-500/20' : 'bg-slate-700/50'}`}>
            <Clock className={`w-4 h-4 ${open > 0 ? 'text-blue-400' : 'text-slate-600'}`} />
          </div>
          <div className="text-left">
            <p className={`text-lg font-bold ${open > 0 ? 'text-blue-400' : 'text-slate-600'}`}>
              {open}
            </p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Feedback</p>
          </div>
        </button>

        {/* QUESTION - Dúvidas */}
        <button
          onClick={onClickQuestion}
          disabled={question === 0}
          className={`flex items-center gap-2 p-3 rounded-lg transition-all ${
            question > 0 
              ? 'bg-slate-700/50 hover:bg-amber-500/20 hover:border-amber-500/50 border border-transparent cursor-pointer animate-pulse' 
              : 'bg-slate-800/30 cursor-default opacity-50'
          }`}
        >
          <div className={`p-1.5 rounded-lg ${question > 0 ? 'bg-amber-500/20' : 'bg-slate-700/50'}`}>
            <HelpCircle className={`w-4 h-4 ${question > 0 ? 'text-amber-400' : 'text-slate-600'}`} />
          </div>
          <div className="text-left">
            <p className={`text-lg font-bold ${question > 0 ? 'text-amber-400' : 'text-slate-600'}`}>
              {question}
            </p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Dúvidas</p>
          </div>
        </button>
      </div>

      {/* Resumo secundário */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800/50">
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-emerald-500" />
            {reviewed} revisados
          </span>
          <span className="flex items-center gap-1">
            <Lock className="w-3 h-3 text-purple-500" />
            {closed} encerrados
          </span>
        </div>
      </div>
    </div>
  );
};

export default StudentFeedbackCard;
