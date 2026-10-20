/**
 * reviewSwotGate
 * @description O que a tela da Revisão permite fazer com o SWOT, por estado da revisão (#487).
 *
 * - Publicar exige SWOT: o mentor lê o SWOT antes de o aluno ver.
 * - Rascunho gera e regenera à vontade.
 * - Publicada sem SWOT (revisões de antes da trava) pode gerar uma vez, a partir do
 *   retrato congelado; publicada com SWOT não regenera — o aluno já viu.
 * - Arquivada não mexe em nada (a CF também recusa).
 *
 * @param {Object|null} review — doc da revisão ({ status, swot })
 * @returns {{ canGenerate: boolean, canRegenerate: boolean, canPublish: boolean }}
 */
export const reviewSwotGate = (review) => {
  const status = review?.status;
  const hasSwot = Boolean(review?.swot);
  const isDraft = status === 'DRAFT';
  return {
    canGenerate: !hasSwot && (isDraft || status === 'CLOSED'),
    canRegenerate: hasSwot && isDraft,
    canPublish: isDraft && hasSwot,
  };
};

export default reviewSwotGate;
