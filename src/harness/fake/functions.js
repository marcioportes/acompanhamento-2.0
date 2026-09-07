/**
 * firebase/functions no harness. Callable de ESCRITA nunca é chamada durante um
 * screenshot; se for, avisa alto em vez de resolver em silêncio.
 *
 * #430 — a exceção são as callables de LEITURA que uma tela dispara ao montar.
 * `getInviteStatusBatch` é uma delas: sem resposta, `authStatusByEmail` fica
 * vazio, `hasAuth` devolve false para todo mundo e o Acompanhamento fotografa
 * doze candidatos a registro que não existem. A foto ficava mentindo justamente
 * sobre o estado que decide etiqueta e filete de cada linha.
 */

/** Leituras que uma tela dispara ao montar, respondidas com dado plausível. */
const LEITURAS = {
  // Um em cada quatro alunos ainda não tem Auth user — proporção que deixa o
  // caso "candidato a registro" visível na foto sem tomar a tabela inteira.
  getInviteStatusBatch: ({ emails = [] }) => ({
    result: Object.fromEntries(
      emails.map((email, i) => [email, { authExists: i % 4 !== 0, firstLoginAt: null }]),
    ),
  }),
};

export const getFunctions = () => ({ __harness: true });
export const httpsCallable = (_fns, nome) => async (payload) => {
  const leitura = LEITURAS[nome];
  if (leitura) return { data: leitura(payload ?? {}) };
  console.warn(`[harness] httpsCallable('${nome}') chamada`, payload);
  return { data: { ok: true, harness: true } };
};
