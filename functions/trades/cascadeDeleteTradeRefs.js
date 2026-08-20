/**
 * cascadeDeleteTradeRefs.js
 * @version 1.0.0 (v1.83.14 — issue #363, fase A)
 * @description Apaga tudo que aponta para um trade quando ele é deletado.
 *
 * PROBLEMA (issue #363, medição em produção 19/08/2026):
 *   Apagar um trade deixava vivo tudo que apontava para ele. `notifications.tradeId` tinha
 *   5.129 órfãs — 89% da collection, todas não lidas; `orders.correlatedTradeId`, 26. Só
 *   `movements` estava limpo, porque é a única dependência que o `deleteTrade` do cliente
 *   sabia apagar.
 *
 * POR QUE AQUI:
 *   Existem três caminhos de deleção com coberturas divergentes (`useTrades.deleteTrade`,
 *   `deletePlanCascade`, `deleteStudentData`) e nenhum completo. O `onTradeDeleted` é o
 *   único ponto por onde TODA deleção passa, venha de onde vier. Além disso roda com admin
 *   SDK: `firestore.rules` tem `allow delete: if false` em `/orders`, então o cliente não
 *   alcança a collection nem se quisesse (DEC-AUTO-363-02).
 *
 * APAGA, NÃO DESVINCULA:
 *   Decisão de produto de Marcio (19/08/2026): o doc de `orders` é apagado, não tem o
 *   `correlatedTradeId` zerado. Perde-se o rastro do que a corretora executou naquele
 *   trade, e isso está aceito — apagar significa deixar de existir, não sumir de uma tela.
 *   O #362 tornou a reimportação idempotente, então reimportar o extrato original
 *   reconstrói as ordens se necessário (DEC-AUTO-363-01).
 *
 * ISOLAMENTO (INV-03):
 *   Cada alvo tem try/catch próprio e alimenta `errors[]`. Falhar num alvo não impede os
 *   outros — a alternativa (abortar tudo) trocaria lixo parcial por lixo total. Nenhum erro
 *   é silencioso: todos aparecem no retorno e no log do trigger.
 *
 * STORAGE (fase B):
 *   Os prints HTF/LTF vivem em `trades/{tradeId}/` e nunca foram apagados. A tela chamava
 *   `deleteTrade(id, htfUrl, ltfUrl)` contra uma função de um argumento só — os dois URLs
 *   eram descartados em silêncio, e ninguém soube. Apagar por PREFIXO em vez de por URL
 *   dispensa a fiação: alcança também o que a tela não conhecia. É o único alvo cujo volume
 *   em bytes é relevante; os documentos do Firestore são texto.
 *
 * FORA DE ESCOPO:
 *   o `drawdownHistory` da conta permanece append-only por decisão do #52: é ledger da
 *   conta, não artefato do trade. As referências em `reviews` ficam de fora por decisão de
 *   Marcio (DEC-AUTO-363-04): vivem dentro do `frozenSnapshot`, congelado por contrato do
 *   #259 — apagá-las reescreveria o que uma revisão publicada dizia na época, e são 10.
 */

const { deleteDocsInBatches } = require('../_shared/batchDelete');

/** Collections que apontam para o trade por um campo escalar, na ordem de execução. */
const SCALAR_REFS = [
  { key: 'movements', collection: 'movements', field: 'tradeId' },
  { key: 'orders', collection: 'orders', field: 'correlatedTradeId' },
  { key: 'notifications', collection: 'notifications', field: 'tradeId' },
];

async function cascadeDeleteTradeRefs(db, { tradeId, bucket = null } = {}) {
  const result = {
    skipped: false,
    movements: 0,
    orders: 0,
    notifications: 0,
    storage: false,
    errors: [],
  };

  if (!tradeId) {
    result.skipped = true;
    return result;
  }

  for (const { key, collection, field } of SCALAR_REFS) {
    try {
      const snap = await db.collection(collection).where(field, '==', tradeId).get();
      const refs = snap.docs.map((d) => d.ref);
      result[key] = await deleteDocsInBatches(db, refs);
    } catch (err) {
      // Falha no meio da paginação: o que já saiu do banco conta (err.deleted).
      result[key] = Number(err && err.deleted) || 0;
      result.errors.push(`${key}: ${err && err.message ? err.message : String(err)}`);
    }
  }

  // Storage por último: é o único alvo irreversível fora do Firestore. Best-effort — sem
  // bucket (ambiente de teste, credencial ausente) não é erro, é ausência de alvo.
  if (bucket) {
    try {
      await bucket.deleteFiles({ prefix: `trades/${tradeId}/` });
      result.storage = true;
    } catch (err) {
      result.errors.push(`storage: ${err && err.message ? err.message : String(err)}`);
    }
  }

  return result;
}

module.exports = {
  cascadeDeleteTradeRefs,
  // exportado para teste
  SCALAR_REFS,
};
