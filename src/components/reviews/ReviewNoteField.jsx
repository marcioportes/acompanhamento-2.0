/**
 * ReviewNoteField — campo "ponto pra revisão" no compositor de feedback (#325).
 *
 * Presentacional. A nota viaja com o "Enviar Feedback": o servidor a persiste nas
 * Notas da Sessão do rascunho quando o trade entra em REVIEWED. Se o mentor não
 * enviar o feedback, a nota se perde (não cria rascunho com trade fora de escopo).
 */
import { PinIcon } from 'lucide-react';

const ReviewNoteField = ({ value, onChange, disabled = false }) => (
  <div className="mb-2">
    <label className="text-[11px] text-slate-500 flex items-center gap-1 mb-1">
      <PinIcon className="w-3 h-3 text-emerald-400" />
      Ponto pra revisão (opcional — vai pras Notas da Sessão ao enviar o feedback)
    </label>
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      rows={2}
      placeholder="Algo a conversar sobre este trade na revisão..."
      className="w-full bg-slate-800/60 border border-emerald-500/20 rounded-lg px-3 py-2 text-white placeholder-slate-600 resize-none focus:border-emerald-500/40 focus:outline-none disabled:opacity-50 text-sm"
    />
  </div>
);

export default ReviewNoteField;
