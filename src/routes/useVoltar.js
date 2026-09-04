/**
 * useVoltar — o "voltar" que não inventa regra (issue #144, Fase A2)
 *
 * O App tinha oito estados só para decidir o destino do botão voltar
 * (`feedbackReturnPlanId`, `feedbackReturnReviewContext`,
 * `ledgerReturnReviewContext`, ...) mais flags no objeto do trade. Com
 * histórico de verdade, voltar é voltar.
 *
 * A exceção é a entrada direta: quem abriu o link do WhatsApp em aba nova não
 * tem para onde voltar — `location.key === 'default'` marca essa primeira
 * entrada, e aí o botão leva ao `fallback` (tipicamente a porta do papel).
 */
import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export const useVoltar = (fallback) => {
  const navigate = useNavigate();
  const location = useLocation();
  const entradaDireta = location.key === 'default';

  return useCallback(() => {
    if (entradaDireta) navigate(fallback, { replace: true });
    else navigate(-1);
  }, [entradaDireta, fallback, navigate]);
};

export default useVoltar;
