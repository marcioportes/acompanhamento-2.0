/**
 * closeCycle.js — Cloud Function callable
 *
 * Cria documento imutável em `cycleClosures/{closureId}` com snapshot completo do
 * ritual de fechamento (10 seções A-J). Aplica plan adjustment (se houver) atomicamente.
 *
 * Permission: aluno (próprio ciclo) OU mentor (fecha pelo aluno em modo demonstração).
 * Idempotência: closureId determinístico = `${planId}_${cycleKey}`. Recriar = error.
 *
 * Issue #259 (1A — Ritual completo de Fechamento de Ciclo).
 *
 * Input (payload):
 *   {
 *     planId, studentId, accountId,
 *     cycleKey, cycleNumber, cycleStart, cycleEnd,
 *     closeMode: 'self' | 'demonstrated' | 'co_edited',
 *     snapshot, metrics, patterns, aar, maturity, swot, mentor, forward,
 *     notes?: string | null
 *   }
 *
 * Output:
 *   { closureId: string, success: true }
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const {
  isMentor,
  validateClosurePayload,
  buildClosureId,
} = require('./validators');

const asHttpsValidator = (fn) => (arg) => {
  try { return fn(arg); }
  catch (e) { throw new HttpsError('invalid-argument', e.message); }
};

module.exports = onCall(
  { maxInstances: 5, timeoutSeconds: 60 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária');
    }

    const userEmail = request.auth.token.email;
    const userUid = request.auth.uid;
    const role = isMentor(userEmail) ? 'mentor' : 'student';

    // Validação estrutural do payload
    const payload = request.data || {};
    asHttpsValidator(validateClosurePayload)(payload);

    // Permission gate aluno OU mentor
    if (role === 'student' && userUid !== payload.studentId) {
      throw new HttpsError(
        'permission-denied',
        'Aluno só pode fechar o próprio ciclo',
      );
    }
    // role === 'mentor' não tem restrição adicional hoje (mentor único = Marcio).
    // Quando houver múltiplos mentores, validar `mentor.studentIds INCLUDES studentId`.

    // Servidor decide closeMode a partir do role autenticado.
    // Cliente não precisa mandar; se mentor mandar 'co_edited', respeitamos como hint.
    payload.closeMode = role === 'student'
      ? 'self'
      : (payload.closeMode === 'co_edited' ? 'co_edited' : 'demonstrated');

    const closureId = asHttpsValidator(() => buildClosureId(payload.planId, payload.cycleKey))();
    const db = admin.firestore();
    const closureRef = db.collection('cycleClosures').doc(closureId);
    const planRef = db.collection('plans').doc(payload.planId);

    // Gate de saldo agora vem do equity do CICLO sendo fechado (não da conta).
    // Computado dentro da transaction abaixo a partir de cycleBaseline.plFinal
    // — não precisa pré-fetch externo. Mantemos o bloco vazio só pra preservar
    // a estrutura do try/catch downstream sem mudança de shape.

    // Transação atomica: validar plano + verificar não-duplicação + persistir + atualizar plan
    try {
      const result = await db.runTransaction(async (tx) => {
        const planSnap = await tx.get(planRef);
        if (!planSnap.exists) {
          throw new HttpsError('not-found', `Plano ${payload.planId} não encontrado`);
        }
        const plan = planSnap.data();

        // Coerência studentId
        if (plan.studentId !== payload.studentId) {
          throw new HttpsError(
            'invalid-argument',
            `studentId do payload (${payload.studentId}) não bate com plan.studentId (${plan.studentId})`,
          );
        }

        const existingSnap = await tx.get(closureRef);
        if (existingSnap.exists) {
          throw new HttpsError(
            'already-exists',
            `Closure ${closureId} já existe — use reopenCycle se precisar editar`,
          );
        }

        // Behavioral summary — derivado de patterns + forward.aiSuggestion.
        // Persistir aqui evita recálculo no front e dá ao inbox de mentor um campo
        // queryable pra priorizar items críticos (REGRA 0 do advisor).
        const counts = payload.patterns?.eventCounts || {};
        const breach = payload.snapshot?.stopBreach || {};
        const ai = payload.forward?.aiSuggestion || {};
        const isCritical = ai.triggeredRule === 'pause_restructure';
        const severity =
          isCritical ? 'critical' :
          (breach.severity && breach.severity !== 'clean') ? breach.severity :
          ((counts.tilt || 0) + (counts.revenge || 0) + (counts.stopTampering || 0)) > 0 ? 'minor' :
          'clean';

        // Denial flag (R2.B10) — aluno atribui resultado a sorte/mercado em ciclo
        // crítico apesar de erros internos detectados. Sinaliza ao mentor que vai
        // precisar fazer o diálogo de ancoragem em fatos no review.
        const detectedInternalErrors =
          (counts.tilt || 0) > 0 ||
          (counts.revenge || 0) > 0 ||
          (counts.stopTampering || 0) > 0 ||
          (breach.tradesAfterStop || 0) > 0;
        const attrs = Array.isArray(payload.aar?.whyDifference?.attributions)
          ? payload.aar.whyDifference.attributions
          : [];
        const onlyExternalAttribution =
          attrs.length > 0 &&
          !attrs.includes('error') &&
          (attrs.includes('luck') || attrs.includes('market'));
        const denialFlag = isCritical && detectedInternalErrors && onlyExternalAttribution;

        const behavioralSummary = {
          tilt: counts.tilt || 0,
          tiltDaysCount: counts.tiltDaysCount || 0,
          revenge: counts.revenge || 0,
          overtrading: counts.overtrading || 0,
          stopTampering: counts.stopTampering || 0,
          rapidReentry: counts.rapidReentry || 0,
          stopBreachIndex: breach.stopBreachIndex ?? -1,
          tradesAfterStop: breach.tradesAfterStop || 0,
          pnlAfterStop: breach.pnlAfterStop || 0,
          pnlPctOfStop: breach.pnlPctOfStop ?? null,
          cycleStopViolated: (breach.stopBreachIndex ?? -1) !== -1,
          critical: isCritical,
          notifyMentor: !!ai.notifyMentor,
          severity,
          triggeredRule: ai.triggeredRule || null,
          denialFlag,
        };

        // Foto do plano ANTES do close mexer (contrato C3 #259) — ground truth
        // pra reabertura restaurar o estado pré-fechamento. Capturada no
        // servidor a partir do plan lido na transaction, não do payload —
        // evita confiar no cliente pra um campo que define audit trail.
        const preClosePlanSnapshot = {
          pl: Number(plan.pl) || 0,
          riskPerOperation: Number(plan.riskPerOperation) || 0,
          rrTarget: Number(plan.rrTarget) || 0,
          cycleGoal: Number(plan.cycleGoal) || 0,
          cycleStop: Number(plan.cycleStop) || 0,
          periodGoal: Number(plan.periodGoal) || 0,
          periodStop: Number(plan.periodStop) || 0,
        };

        // Baseline imutável do ciclo (contrato C2 #259) — narrativa formal do
        // que aconteceu nesse ciclo: PL inicial era X, saldo dinâmico fechou
        // em Y, virou Z. Independente de qualquer mutação futura no plano.
        const cycleBaseline = {
          plInicial: preClosePlanSnapshot.pl,
          saldoFinal: Number(payload.snapshot?.result) || 0,
          plFinal: preClosePlanSnapshot.pl + (Number(payload.snapshot?.result) || 0),
        };

        // Build closure doc
        const now = admin.firestore.FieldValue.serverTimestamp();
        const closureDoc = {
          // Identidade
          planId: payload.planId,
          studentId: payload.studentId,
          accountId: payload.accountId || null,
          cycleKey: payload.cycleKey,
          cycleNumber: payload.cycleNumber,
          cycleStart: payload.cycleStart,
          cycleEnd: payload.cycleEnd,

          // Conteúdo (10 seções)
          snapshot: payload.snapshot,
          metrics: payload.metrics,
          patterns: payload.patterns,
          aar: payload.aar,
          maturity: payload.maturity,
          swot: payload.swot,
          mentor: payload.mentor,
          forward: payload.forward,
          notes: payload.notes ?? null,
          behavioralSummary,

          // C3: baseline do ciclo + foto pré-fechamento (audit + reabertura)
          cycleBaseline,
          preClosePlanSnapshot,

          // Status + reopen
          status: 'CLOSED',
          originalSnapshot: null,
          reopenedAt: null,
          reopenedBy: null,
          reopenReason: null,

          // Auditoria
          closedAt: now,
          closedBy: { uid: userUid, email: userEmail, role },
          closeMode: payload.closeMode,
          movementId: null,                      // FK pra movements se result ≠ 0 (A-fase futura)
          schemaVersion: 3,                      // bump por C3 (cycleBaseline + preClosePlanSnapshot)
          createdAt: now,
        };

        tx.set(closureRef, closureDoc);

        // Plan update — hard seal range + cycle bookkeeping + plan adjustment (se houver)
        // sealedCycleRanges é fonte canônica de verdade pro hard seal (suporta reopen seletivo).
        // lastClosedCycleEnd é cache simples pra rules.firestore (defesa em profundidade).
        const sealedRange = {
          closureId,
          cycleStart: payload.cycleStart,
          cycleEnd: payload.cycleEnd,
        };
        const planUpdate = {
          sealedCycleRanges: admin.firestore.FieldValue.arrayUnion(sealedRange),
          lastClosedCycleEnd: payload.cycleEnd,    // cache otimista pra rules
          lastCycleClosureId: closureId,
          currentCycleNumber: payload.cycleNumber + 1,
          updatedAt: now,
        };

        // Virada de ciclo (contrato C2 #259): PL do plano após o fechamento
        // vira o PL(ini) do próximo ciclo. Por default é o plFinal do ciclo
        // anterior; se o aluno aplicou ajuste no ritual, usa o valor escolhido.
        // Saldo derivado zera porque o ciclo aberto agora começa em cycleEnd+1
        // e os trades anteriores não pertencem mais a ele.
        const adj = payload.forward?.planAdjustment;
        if (adj?.changed && typeof adj.newPl === 'number' && adj.newPl > 0) {
          planUpdate.pl = adj.newPl;
        } else if (cycleBaseline.plFinal > 0) {
          planUpdate.pl = cycleBaseline.plFinal;
        }
        // Demais parâmetros (RO, RR) — só com ajuste explícito do aluno e > 0.
        // Zero é semântica de PAUSA (REGRA 0 do advisor); não vira o plano,
        // fica registrado em behavioralSummary.critical + notifyMentor.
        if (adj?.changed) {
          if (typeof adj.newRiskPerOp === 'number' && adj.newRiskPerOp > 0) {
            planUpdate.riskPerOperation = adj.newRiskPerOp;
          }
          if (typeof adj.newRRTarget === 'number' && adj.newRRTarget > 0) {
            planUpdate.rrTarget = adj.newRRTarget;
          }
        }

        // Gate de saldo — PL efetivo do plano após o close não pode exceder
        // o EQUITY do ciclo sendo fechado (plan.pl_inicial + Σ trades_ciclo).
        // Usa cycleBaseline.plFinal calculado acima na transaction (ground truth).
        // NÃO usa account.currentBalance: a conta pode ter resultados de trades
        // posteriores ao cycleEnd se o aluno deixou o ciclo aberto enquanto já
        // operava no próximo (ex.: fechando abril em maio). Ciclo é unidade
        // discreta de alocação — só o que ele gerou vira capital do próximo.
        const cycleEquity = cycleBaseline.plFinal;
        const effectivePL = Number(planUpdate.pl ?? plan.pl ?? 0);
        if (Number.isFinite(cycleEquity) && cycleEquity > 0 && effectivePL > cycleEquity + 0.1) {
          throw new HttpsError(
            'failed-precondition',
            `PL do plano (${effectivePL.toFixed(2)}) excede o equity do ciclo `
              + `(${cycleEquity.toFixed(2)} = PL inicial + resultado). Recalibre o capital no Passo 6 antes de fechar o ciclo.`,
          );
        }

        tx.update(planRef, planUpdate);

        return { closureId };
      });

      return { closureId: result.closureId, success: true };
    } catch (e) {
      // Re-throw HttpsError; convert outros pra internal
      if (e instanceof HttpsError) throw e;
      console.error('[closeCycle] erro inesperado:', e);
      throw new HttpsError('internal', `Erro ao fechar ciclo: ${e.message}`);
    }
  },
);
