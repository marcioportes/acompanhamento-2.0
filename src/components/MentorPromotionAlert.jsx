/**
 * MentorPromotionAlert.jsx — alunos prontos para subir de estágio.
 *
 * #376 (23/08/2026). Contraparte verde do `MentorMaturityAlert` (que só mostra
 * regressão). Antes desta issue o mentor não era avisado de promoção em lugar nenhum:
 * o aluno chegava a 9/9, o motor gravava `proposedTransition: UP` e nada acontecia.
 *
 * Regra de Marcio: *"avisa da promoção tanto para o aluno quanto para mim, e eu faço a
 * promoção avisando o aluno."* Por isso o botão fica aqui, do lado do mentor, e o card
 * do aluno só informa que ele cumpriu os requisitos.
 */

import { useMemo, useState } from 'react';
import DebugBadge from './DebugBadge';
import { STAGE_NAMES } from '../utils/maturityEngine/constants';
import { isReadyForPromotion, nextStageOf } from '../utils/maturityEngine/promotionReadiness';
import { usePromoteStudentStage } from '../hooks/usePromoteStudentStage';
import { useToast } from '../contexts/ToastContext';

const MentorPromotionAlert = ({
  students = [],
  maturityMap = new Map(),
  onSelectStudent,
  onPromoted,
  embedded = false,
}) => {
  const prontos = useMemo(() => {
    const out = [];
    for (const s of students) {
      const m = maturityMap.get(s.id);
      if (!isReadyForPromotion(m)) continue;
      out.push({ student: s, maturity: m, toStage: nextStageOf(m) });
    }
    return out;
  }, [students, maturityMap]);

  const [emAndamento, setEmAndamento] = useState(null);
  const { promote } = usePromoteStudentStage();
  const toast = useToast();

  if (prontos.length === 0) return null;

  const handlePromote = async (studentId, nome, toStage) => {
    setEmAndamento(studentId);
    try {
      await promote(studentId);
      toast?.success?.(`${nome} promovido para ${STAGE_NAMES[toStage]}.`);
      onPromoted?.(studentId, toStage);
    } catch (err) {
      // `failed-precondition` = o aluno deixou de estar pronto entre a tela e o clique.
      toast?.error?.(err?.message ?? 'Não foi possível promover agora.');
    } finally {
      setEmAndamento(null);
    }
  };

  return (
    <section
      className="bg-emerald-950/20 backdrop-blur border border-emerald-500/30 rounded-xl p-4 mb-4"
      data-testid="mentor-promotion-alert"
    >
      <h3 className="font-bold text-emerald-300 text-sm mb-1">
        {prontos.length === 1 ? 'Aluno pronto para promoção' : `${prontos.length} alunos prontos para promoção`}
      </h3>
      <p className="text-xs text-emerald-200/70 mb-3">
        Cumpriram todos os requisitos do estágio seguinte. A promoção é sua — converse com o aluno.
      </p>

      <ul className="space-y-2">
        {prontos.map(({ student, maturity, toStage }) => (
          <li
            key={student.id}
            className="flex items-center justify-between gap-3 rounded-lg bg-slate-900/40 border border-emerald-500/20 px-3 py-2"
            data-testid={`promotion-row-${student.id}`}
          >
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => onSelectStudent?.(student)}
                className="text-sm font-semibold text-white hover:text-emerald-300 transition-colors truncate block text-left"
              >
                {student.name ?? student.id}
              </button>
              <p className="text-[11px] text-slate-400 font-mono">
                {STAGE_NAMES[maturity.currentStage]} → {STAGE_NAMES[toStage]} ·{' '}
                {maturity.gatesMet}/{maturity.gatesTotal} gates
              </p>
            </div>
            <button
              type="button"
              onClick={() => handlePromote(student.id, student.name ?? student.id, toStage)}
              disabled={emAndamento === student.id}
              data-testid={`promote-button-${student.id}`}
              className="shrink-0 text-xs px-3 py-1.5 rounded-lg font-semibold bg-emerald-500/20 text-emerald-200 border border-emerald-500/40 hover:bg-emerald-500/30 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {emAndamento === student.id ? 'Promovendo…' : `Promover para ${STAGE_NAMES[toStage]}`}
            </button>
          </li>
        ))}
      </ul>

      {!embedded && <DebugBadge component="MentorPromotionAlert" />}
    </section>
  );
};

export default MentorPromotionAlert;
