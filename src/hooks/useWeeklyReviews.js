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
  doc, updateDoc, deleteDoc, serverTimestamp, arrayUnion, arrayRemove,
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

  const generateSwot = useCallback(async ({ reviewId }) => {
    setActionLoading(true);
    setError(null);
    try {
      const cf = httpsCallable(functions, 'generateWeeklySwot');
      const res = await cf({ studentId, reviewId });
      return res.data;
    } catch (err) {
      setError(err.message || 'Erro ao gerar SWOT');
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, [functions, studentId]);

  // closeReview publica o rascunho. Se frozenSnapshot for fornecido, sobrescreve
  // o snapshot atual (recomputado no momento do publish — indicadores congelam aqui,
  // não no create). Campos takeaways/meetingLink/videoLink são opcionais: só vão ao
  // payload se EXPLICITAMENTE passados (undefined preserva o valor atual do doc).
  const closeReview = useCallback(async (reviewId, opts = {}) => {
    setActionLoading(true);
    setError(null);
    try {
      const ref = doc(db, 'students', studentId, 'reviews', reviewId);
      const payload = {
        status: 'CLOSED',
        closedAt: serverTimestamp(),
      };
      if (opts.takeaways !== undefined) payload.takeaways = opts.takeaways;
      if (opts.meetingLink !== undefined) payload.meetingLink = opts.meetingLink;
      if (opts.videoLink !== undefined) payload.videoLink = opts.videoLink;
      if (opts.frozenSnapshot) payload.frozenSnapshot = opts.frozenSnapshot;
      await updateDoc(ref, payload);
    } catch (err) {
      setError(err.message || 'Erro ao fechar revisão');
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, [studentId]);

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

  // Deletar revisão (mentor-only, bloqueado em ARCHIVED via rules).
  const deleteReview = useCallback(async (reviewId) => {
    setActionLoading(true);
    setError(null);
    try {
      const ref = doc(db, 'students', studentId, 'reviews', reviewId);
      await deleteDoc(ref);
    } catch (err) {
      setError(err.message || 'Erro ao deletar revisão');
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, [studentId]);

  // Salva campos editáveis do rascunho (takeaways, meetingLink, videoLink, sessionNotes) SEM
  // mudar o status. Usado pelo baseline ReviewToolsPanel — mentor digita e persiste
  // sem precisar publicar antes.
  const saveDraftFields = useCallback(async (reviewId, { takeaways = null, meetingLink = null, videoLink = null, sessionNotes = undefined } = {}) => {
    setActionLoading(true);
    setError(null);
    try {
      const ref = doc(db, 'students', studentId, 'reviews', reviewId);
      const delta = { takeaways, meetingLink, videoLink };
      if (sessionNotes !== undefined) delta.sessionNotes = sessionNotes;
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

  // Adiciona um tradeId ao set explícito `includedTradeIds` da revisão.
  // Usado pelo PinToReviewButton — permite incluir trade fora do período da revisão
  // (caso mentor revise trade antigo em rascunho de semana diferente).
  const addIncludedTrade = useCallback(async (reviewId, tradeId) => {
    if (!tradeId) return;
    setActionLoading(true);
    setError(null);
    try {
      const ref = doc(db, 'students', studentId, 'reviews', reviewId);
      await updateDoc(ref, { includedTradeIds: arrayUnion(tradeId) });
    } catch (err) {
      setError(err.message || 'Erro ao incluir trade na revisão');
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, [studentId]);

  // Pin rápido: anexa uma linha ao campo takeaways de uma revisão (DRAFT).
  // Usado pelo PinToReviewButton (FeedbackPage) — evita context switch.
  const appendTakeaway = useCallback(async (reviewId, line) => {
    if (!line || !String(line).trim()) return;
    setActionLoading(true);
    setError(null);
    try {
      const ref = doc(db, 'students', studentId, 'reviews', reviewId);
      const current = reviews.find(r => r.id === reviewId);
      const existing = current?.takeaways || '';
      const sep = existing && !existing.endsWith('\n') ? '\n' : '';
      const next = existing + sep + String(line).trim();
      await updateDoc(ref, { takeaways: next });
    } catch (err) {
      setError(err.message || 'Erro ao anotar takeaway');
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, [studentId, reviews]);

  // Pin rápido: anexa uma linha ao campo sessionNotes de uma revisão (DRAFT).
  // Usado pelo PinToReviewButton — pontos observados no Feedback Trade são
  // notas de sessão, não takeaways (takeaways = ação/item estruturado).
  const appendSessionNotes = useCallback(async (reviewId, line) => {
    if (!line || !String(line).trim()) return;
    setActionLoading(true);
    setError(null);
    try {
      const ref = doc(db, 'students', studentId, 'reviews', reviewId);
      const current = reviews.find(r => r.id === reviewId);
      const existing = typeof current?.sessionNotes === 'string' ? current.sessionNotes : '';
      const sep = existing && !existing.endsWith('\n') ? '\n' : '';
      const next = existing + sep + String(line).trim();
      await updateDoc(ref, { sessionNotes: next });
    } catch (err) {
      setError(err.message || 'Erro ao anotar nota da sessão');
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, [studentId, reviews]);

  return {
    reviews,
    isLoading,
    actionLoading,
    error,
    createReview,
    generateSwot,
    closeReview,
    archiveReview,
    deleteReview,
    appendTakeaway,
    appendSessionNotes,
    addIncludedTrade,
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
