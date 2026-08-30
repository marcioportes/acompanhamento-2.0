/**
 * loginBlockPolicy — regra de bloqueio de login por inadimplência.
 *
 * PURA, sem I/O: o `checkSubscriptions` decide, grava e desabilita o Auth; aqui
 * mora só o critério, para poder ser testado sem Firestore.
 *
 * O QUE MUDOU (issue #101, 28/08/2026 — pedido de Marcio: "quando eu desbloquear
 * um login, que continuar pendente, o sistema precisa voltar a bloquear"):
 *
 * O autobloqueio do #263 disparava apenas na TRANSIÇÃO de `active` para
 * `overdue` — o dia em que a assinatura vencia o período de graça. Depois disso,
 * a rotina diária passava pela assinatura já vencida sem tocar no bloqueio. Ou
 * seja: bastava desbloquear uma vez e o aluno ficava com acesso indefinidamente,
 * inadimplente, sem nada reverter.
 *
 * Agora a regra é um INVARIANTE verificado todo dia, não um evento: enquanto
 * houver assinatura vencida e nenhuma viva, o login fica bloqueado. Desbloquear
 * dá acesso até a próxima execução da rotina (08:00 BRT); o que devolve acesso
 * em definitivo é o pagamento entrar.
 *
 * O bloqueio MANUAL do mentor segue soberano: a rotina nunca o desfaz.
 */

/**
 * @param {Object} p
 * @param {boolean} p.temVencida — ao menos uma assinatura em `overdue`
 * @param {boolean} p.temViva    — ao menos uma assinatura `active` (paga ou trial)
 * @param {boolean} p.bloqueado  — `student.loginBlocked === true`
 * @returns {boolean} true se a rotina deve (re)bloquear agora
 */
function deveBloquear({ temVencida, temViva, bloqueado } = {}) {
  if (bloqueado) return false;          // já está bloqueado — nada a fazer
  if (!temVencida) return false;        // não deve nada
  if (temViva) return false;            // outra conta paga sustenta o acesso
  return true;
}

/**
 * O desbloqueio automático (assinatura recuperada) só vale para bloqueio de
 * origem `auto`. Bloqueio manual do mentor não é desfeito por pagamento.
 */
function deveDesbloquear({ bloqueado, motivo } = {}) {
  return bloqueado === true && motivo === 'auto';
}

module.exports = { deveBloquear, deveDesbloquear };
