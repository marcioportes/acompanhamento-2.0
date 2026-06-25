/**
 * setMentorSwotStyle.js — Cloud Function callable (#262, metade-semanal).
 *
 * Persiste o estilo da SWOT do mentor (global) em mentorConfig/{mentorUid}.swotStyle.
 * Validação server-side dos eixos (tone/focus/depth ∈ {1,2,3}). Merge — não toca os
 * demais campos do doc (regras de compliance etc.).
 *
 * Input:  { tone: 1|2|3, focus: 1|2|3, depth: 1|2|3 }
 * Output: { swotStyle }
 *
 * @version 1.0 — issue #262
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { isMentor } = require('./validators');
const { SWOT_STYLE_AXES, clampSwotStyle } = require('../_shared/swotPromptBuilder');

module.exports = onCall(
  { maxInstances: 3, timeoutSeconds: 30 },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Autenticação necessária');
    if (!isMentor(request.auth.token.email)) {
      throw new HttpsError('permission-denied', 'Apenas mentor pode definir o estilo da SWOT');
    }

    const input = request.data || {};
    for (const axis of SWOT_STYLE_AXES) {
      const v = input[axis];
      if (v !== 1 && v !== 2 && v !== 3) {
        throw new HttpsError('invalid-argument', `${axis} deve ser 1, 2 ou 3`);
      }
    }
    const swotStyle = clampSwotStyle(input);

    const db = admin.firestore();
    await db.collection('mentorConfig').doc(request.auth.uid).set(
      {
        swotStyle,
        swotStyleUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: request.auth.token.email || null,
      },
      { merge: true },
    );

    console.log(`[setMentorSwotStyle] mentor ${request.auth.uid} → ${JSON.stringify(swotStyle)}`);
    return { swotStyle };
  }
);
