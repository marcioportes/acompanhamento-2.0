/**
 * firebase/functions no harness. Callable nunca é chamada durante um screenshot
 * (são todas ações de escrita); se for, falha alto em vez de resolver silêncio.
 */
export const getFunctions = () => ({ __harness: true });
export const httpsCallable = (_fns, nome) => async (payload) => {
  console.warn(`[harness] httpsCallable('${nome}') chamada`, payload);
  return { data: { ok: true, harness: true } };
};
