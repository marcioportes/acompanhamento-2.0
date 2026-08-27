/**
 * useMentorRiskRadar — issue #101 (Torre de Controle)
 *
 * Casca de memoização sobre `buildMentorRadar`. Toda a regra vive em
 * `src/utils/mentorRiskRadar.js`, que é testável sem React (INV-05).
 *
 * NÃO abre listener: recebe o que o `MentorDashboard` já escuta. Chamar
 * `useTrades`/`usePlans`/`useSubscriptions` aqui dentro duplicaria três
 * `onSnapshot` para desenhar a mesma tela.
 *
 * A data de referência entra em `now` para que a Torre não recalcule a cada
 * render por causa de um `new Date()` novo — e para que o teste possa fixar o dia.
 */
import { useMemo, useRef } from 'react';
import { buildMentorRadar } from '../utils/mentorRiskRadar';

const VAZIO = Object.freeze([]);

export const useMentorRiskRadar = ({
  allTrades = VAZIO,
  plans = VAZIO,
  students = VAZIO,
  subscriptions = VAZIO,
  now = null,
} = {}) => {
  // Referência estável de "hoje" enquanto a tela está montada. Sem isto, cada
  // render criaria uma Date nova e invalidaria o memo.
  const agora = useRef(now ?? new Date());
  if (now) agora.current = now;

  return useMemo(
    () => buildMentorRadar({ allTrades, plans, students, subscriptions, now: agora.current }),
    [allTrades, plans, students, subscriptions],
  );
};

export default useMentorRiskRadar;
