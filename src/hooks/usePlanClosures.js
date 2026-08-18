/**
 * usePlanClosures.js — closures de um plano específico.
 *
 * Subscribe a `cycleClosures where studentId == X` e filtra `planId` em memória.
 * Retorna lista com TODOS os closures do plano (CLOSED + REOPENED se houver),
 * pra que callers escolham status conforme uso.
 *
 * POR QUE NÃO `where planId ==` (o desenho original):
 *   A rule de `cycleClosures` é por documento — `isMentor() || isOwner(resource.data.studentId)`.
 *   Numa QUERY o Firestore não avalia doc a doc: ele só libera se as restrições da própria
 *   query garantirem a condição de antemão. Filtrando só por `planId`, nada garante
 *   `studentId == uid`, e a query inteira era rejeitada com `Missing or insufficient
 *   permissions` — sempre, para qualquer aluno. Passava só para o mentor, porque
 *   `isMentor()` independe de documento; por isso o bug ficou invisível.
 *
 *   Consequência silenciosa: `closures` ficava `[]` (o onSnapshot só faz console.error),
 *   e o `PlanLedgerExtract` calculava saldo de abertura sem os fechamentos — carry-over
 *   de patrimônio (#267) errado para todo aluno.
 *
 *   `studentId` é o filtro que a rule sabe validar — mesmo padrão de `useStudentClosures`
 *   e `useCycleExpiredQueue`. O `planId` sai em memória: são poucos closures por aluno
 *   (unidades), então o custo é irrelevante e não exige composite index novo.
 *
 * Usado por componentes que precisam consultar baseline histórico de um ciclo
 * específico (ex.: PlanLedgerExtract pra puxar PL(0) histórico).
 *
 * Issue #259 (1A — Ritual de Fechamento de Ciclo).
 */

import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * @param {string|null} planId — plano cujos closures interessam
 * @param {string|null} studentId — dono do plano. Obrigatório: é o que torna a query
 *   autorizável pela rule. Sem ele o hook não consulta (evita o permission-denied silencioso).
 */
export function usePlanClosures(planId, studentId) {
  const [closures, setClosures] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!planId || !studentId) {
      setClosures([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const q = query(
      collection(db, 'cycleClosures'),
      where('studentId', '==', studentId),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setClosures(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((c) => c.planId === planId),
        );
        setLoading(false);
      },
      (err) => {
        console.error('[usePlanClosures] erro:', err);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [planId, studentId]);

  return { closures, loading };
}

export default usePlanClosures;
