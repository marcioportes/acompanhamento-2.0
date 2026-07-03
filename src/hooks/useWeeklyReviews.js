/**
 * useWeeklyReviews
 * @version 1.0.0
 * @description Hook para listar e gerenciar revisões semanais de um aluno (#102).
 *
 * - Mentor: vê todas as revisões (DRAFT, CLOSED, ARCHIVED) em real-time.
 * - Aluno: vê apenas CLOSED e ARCHIVED (A4 — DRAFT é working do mentor).
 * - Callbacks invocam CFs: createWeeklyReview, generateWeeklySwot, closeReview, archiveReview.
 *   closeReview e archiveReview usam updateDoc direto via client (state machine em rules A4).
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  collection, query, where, orderBy, onSnapshot, getDocs,
  doc, updateDoc, serverTimestamp, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { validateReviewUrl } from '../utils/reviewUrlValidator';

export const useWeeklyReviews = (studentId) => {
  const { user, isMentor } = useAuth();
  const mentor = typeof isMentor === 'function' ? isMentor() : Boolean(isMentor);
  const [reviews, setReviews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const functions = useMemo(() => getFunctions(), []);

  useEffect(() => {
    if (!studentId || !user) {
      setReviews([]);
      setIsLoading(false);
      return undefined;
    }

    setIsLoading(true);
    setError(null);

    const reviewsRef = collection(db, 'students', studentId, 'reviews');
    const q = mentor
      ? query(reviewsRef, orderBy('weekStart', 'desc'))
      : query(
          reviewsRef,
          where('status', 'in', ['CLOSED', 'ARCHIVED']),
          orderBy('weekStart', 'desc')
        );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setReviews(items);
        setIsLoading(false);
      },
      (err) => {
        console.error('[useWeeklyReviews] snapshot error:', err);
        setError(err.message || 'Erro ao carregar revisões');
        setIsLoading(false);
      }
    );
    return () => unsub();
  }, [studentId, user, mentor]);

  // Ao criar nova revisão, puxa takeaways não-encerrados (!done) da última revisão
  // CLOSED/ARCHIVED do MESMO plano e os replica no novo DRAFT com ids novos. Campo
  // carriedOverFromReviewId preserva rastreabilidade. O doc anterior permanece
  // congelado — esta operação é aditiva no DRAFT novo, não modifica a anterior.
  const carryOverTakeaways = useCallback(async ({ newReviewId, planId, newWeekStart }) => {
    if (!newReviewId || !planId || !studentId) return;
    try {
      const allQ = query(
        collection(db, 'students', studentId, 'reviews'),
        orderBy('weekStart', 'desc')
      );
      const snap = await getDocs(allQ);
      const prev = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .find(r =>
          r.id !== newReviewId &&
          (r.status === 'CLOSED' || r.status === 'ARCHIVED') &&
          (r.planId === planId || r.frozenSnapshot?.planContext?.planId === planId) &&
          (!newWeekStart || !r.weekStart || r.weekStart < newWeekStart)
        );
      if (!prev) return;
      const openItems = (Array.isArray(prev.takeawayItems) ? prev.takeawayItems : [])
        .filter(it => !it.done);
      if (openItems.length === 0) return;
      const carried = openItems.map(it => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        text: it.text,
        done: false,
        createdAt: new Date().toISOString(),
        sourceTradeId: it.sourceTradeId || null,
        carriedOverFromReviewId: prev.id,
      }));
      await updateDoc(
        doc(db, 'students', studentId, 'reviews', newReviewId),
        { takeawayItems: carried }
      );
    } catch (carryErr) {
      // Não aborta fluxo: review já existe. Só loga.
      // eslint-disable-next-line no-console
      console.warn('[useWeeklyReviews] carry-over takeaways falhou:', carryErr);
    }
  }, [studentId]);

  const createReview = useCallback(async (payload) => {
    setActionLoading(true);
    setError(null);
    try {
      const cf = httpsCallable(functions, 'createWeeklyReview');
      const res = await cf(payload);
      const data = res.data || {};
      // Carry-over é best-effort, não quebra o fluxo se falhar.
      if (data.reviewId && payload?.planId) {
        await carryOverTakeaways({
          newReviewId: data.reviewId,
          planId: payload.planId,
          newWeekStart: payload.weekStart || null,
        });
      }
      return data;
    } catch (err) {
      setError(err.message || 'Erro ao criar revisão');
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, [functions, carryOverTakeaways]);

  // #269 v2 — não há mais criação manual de rascunho nem inclusão explícita de trade.
  // A revisão semanal nasce sob demanda no 1º feedback do mentor (trigger onTradeUpdated
  // → getOrCreateOpenReview, server-side) e os trades entram ao virarem REVIEWED.

  // #331 — `snapshot` (montado no cliente via buildClientSnapshot) é passado para a CF quando
  // a revisão está DRAFT (frozenSnapshot ainda null). Ausente → a CF cai no frozenSnapshot.
  const generateSwot = useCallback(async ({ reviewId, snapshot = null }) => {
    setActionLoading(true);
    setError(null);
    try {
      const cf = httpsCallable(functions, 'generateWeeklySwot');
      const res = await cf({ studentId, reviewId, snapshot });
      return res.data;
    } catch (err) {
      setError(err.message || 'Erro ao gerar SWOT');
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, [functions, studentId]);

  // closeReview publica o rascunho (#269: via callable publishReview). A callable
  // faz a transição atômica DRAFT→CLOSED, flipa os trades empenhados para DISCUSSED,
  // atribui sequenceNumber e limpa o ponteiro plan.activeDraftReviewId. frozenSnapshot
  // (recomputado no publish) é passthrough. Links meeting/video são persistidos antes
  // via updateDoc direto (campos do doc da review, permitidos ao mentor em DRAFT).
  const closeReview = useCallback(async (reviewId, opts = {}) => {
    setActionLoading(true);
    setError(null);
    try {
      const ref = doc(db, 'students', studentId, 'reviews', reviewId);
      const pre = {};
      if (opts.meetingLink !== undefined) pre.meetingLink = opts.meetingLink;
      if (opts.videoLink !== undefined) pre.videoLink = opts.videoLink;
      if (Object.keys(pre).length > 0) await updateDoc(ref, pre);

      const cf = httpsCallable(functions, 'publishReview');
      const res = await cf({
        studentId,
        reviewId,
        frozenSnapshot: opts.frozenSnapshot ?? null,
        swot: opts.swot ?? null,
      });
      return res.data;
    } catch (err) {
      setError(err.message || 'Erro ao publicar revisão');
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, [functions, studentId]);

  const archiveReview = useCallback(async (reviewId) => {
    setActionLoading(true);
    setError(null);
    try {
      const ref = doc(db, 'students', studentId, 'reviews', reviewId);
      await updateDoc(ref, {
        status: 'ARCHIVED',
        archivedAt: serverTimestamp(),
      });
    } catch (err) {
      setError(err.message || 'Erro ao arquivar revisão');
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, [studentId]);

  // #269 v2 — "descartar rascunho" não existe: a revisão é o balaio dos trades que o
  // mentor revisou. Não quer fazer a reunião agora → não publica; a revisão aberta espera.

  // Salva campos editáveis do rascunho (sessionNotes, meetingLink, videoLink) SEM mudar
  // o status. Usado pelo ReviewToolsPanel/WeeklyReviewModal — mentor digita e persiste
  // sem precisar publicar antes. Cada campo é opcional (undefined preserva valor atual).
  const saveDraftFields = useCallback(async (reviewId, { meetingLink, videoLink, sessionNotes } = {}) => {
    setActionLoading(true);
    setError(null);
    try {
      const ref = doc(db, 'students', studentId, 'reviews', reviewId);
      const delta = {};
      if (meetingLink !== undefined) delta.meetingLink = meetingLink;
      if (videoLink !== undefined) delta.videoLink = videoLink;
      if (sessionNotes !== undefined) delta.sessionNotes = sessionNotes;
      if (Object.keys(delta).length === 0) return;
      await updateDoc(ref, delta);
    } catch (err) {
      setError(err.message || 'Erro ao salvar rascunho');
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, [studentId]);

  // Issue #197: atualiza meetingLink/videoLink de uma revisão sem mudar status.
  // Permite ao mentor corrigir/preencher o link da reunião e da gravação após
  // publicar a revisão (links da gravação só existem depois da reunião terminar).
  // Rules cobrem mentor em DRAFT/CLOSED→CLOSED; ARCHIVED é terminal e não chega aqui.
  // Validação reaproveita validateReviewUrl (regex https + allowlist de hosts).
  const updateMeetingLinks = useCallback(async (reviewId, { meetingLink, videoLink } = {}) => {
    const hasMeeting = meetingLink !== undefined;
    const hasVideo = videoLink !== undefined;
    if (!hasMeeting && !hasVideo) return;
    if (hasMeeting) {
      const v = validateReviewUrl(meetingLink);
      if (!v.valid) throw new Error(v.error);
    }
    if (hasVideo) {
      const v = validateReviewUrl(videoLink);
      if (!v.valid) throw new Error(v.error);
    }
    setActionLoading(true);
    setError(null);
    try {
      const ref = doc(db, 'students', studentId, 'reviews', reviewId);
      const payload = { updatedAt: serverTimestamp() };
      if (hasMeeting) payload.meetingLink = meetingLink;
      if (hasVideo) payload.videoLink = videoLink;
      await updateDoc(ref, payload);
    } catch (err) {
      setError(err.message || 'Erro ao atualizar links');
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, [studentId]);

  // Atualiza campo sessionNotes (Notas da Sessão) — texto livre do mentor sobre a reunião.
  // Usado em Stage 3 da nova tela WeeklyReviewPage (Subitem 4).
  const updateSessionNotes = useCallback(async (reviewId, notes) => {
    setActionLoading(true);
    setError(null);
    try {
      const ref = doc(db, 'students', studentId, 'reviews', reviewId);
      await updateDoc(ref, { sessionNotes: typeof notes === 'string' ? notes : null });
    } catch (err) {
      setError(err.message || 'Erro ao salvar notas da sessão');
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, [studentId]);

  // ===== Takeaways checklist (Stage 4) =====
  // Schema: review.takeawayItems: [{id, text, done, createdAt, sourceTradeId?}]
  // Adição via arrayUnion (race-safe). Toggle/remove via read-modify-write.

  const addTakeawayItem = useCallback(async (reviewId, text, sourceTradeId = null) => {
    const clean = (text || '').trim();
    if (!clean) return;
    setActionLoading(true);
    setError(null);
    try {
      const item = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        text: clean,
        done: false,
        // serverTimestamp não funciona dentro de arrayUnion — usar ISO client-side.
        createdAt: new Date().toISOString(),
        sourceTradeId: sourceTradeId || null,
      };
      const ref = doc(db, 'students', studentId, 'reviews', reviewId);
      await updateDoc(ref, { takeawayItems: arrayUnion(item) });
    } catch (err) {
      setError(err.message || 'Erro ao adicionar takeaway');
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, [studentId]);

  const toggleTakeawayDone = useCallback(async (reviewId, itemId) => {
    setActionLoading(true);
    setError(null);
    try {
      const current = reviews.find(r => r.id === reviewId);
      const items = Array.isArray(current?.takeawayItems) ? current.takeawayItems : [];
      const next = items.map(it => it.id === itemId ? { ...it, done: !it.done } : it);
      const ref = doc(db, 'students', studentId, 'reviews', reviewId);
      await updateDoc(ref, { takeawayItems: next });
    } catch (err) {
      setError(err.message || 'Erro ao marcar takeaway');
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, [studentId, reviews]);

  const removeTakeawayItem = useCallback(async (reviewId, itemId) => {
    setActionLoading(true);
    setError(null);
    try {
      const current = reviews.find(r => r.id === reviewId);
      const items = Array.isArray(current?.takeawayItems) ? current.takeawayItems : [];
      const next = items.filter(it => it.id !== itemId);
      const ref = doc(db, 'students', studentId, 'reviews', reviewId);
      await updateDoc(ref, { takeawayItems: next });
    } catch (err) {
      setError(err.message || 'Erro ao remover takeaway');
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, [studentId, reviews]);

  // Stage 4.5: aluno marca takeaway como feito/não-feito.
  // Aluno só tem permissão (via rules) de mutar `alunoDoneIds` quando review.status=CLOSED.
  const toggleAlunoDone = useCallback(async (reviewId, itemId, markDone) => {
    if (!itemId) return;
    setActionLoading(true);
    setError(null);
    try {
      const ref = doc(db, 'students', studentId, 'reviews', reviewId);
      await updateDoc(ref, {
        alunoDoneIds: markDone ? arrayUnion(itemId) : arrayRemove(itemId),
      });
    } catch (err) {
      setError(err.message || 'Erro ao atualizar status');
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, [studentId]);

  return {
    reviews,
    isLoading,
    actionLoading,
    error,
    createReview,
    generateSwot,
    closeReview,
    archiveReview,
    updateSessionNotes,
    saveDraftFields,
    updateMeetingLinks,
    addTakeawayItem,
    toggleTakeawayDone,
    removeTakeawayItem,
    toggleAlunoDone,
  };
};

export default useWeeklyReviews;
