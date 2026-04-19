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
  collection, query, where, orderBy, onSnapshot,
  doc, updateDoc, deleteDoc, serverTimestamp, arrayUnion,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

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

  const createReview = useCallback(async (payload) => {
    setActionLoading(true);
    setError(null);
    try {
      const cf = httpsCallable(functions, 'createWeeklyReview');
      const res = await cf(payload);
      return res.data;
    } catch (err) {
      setError(err.message || 'Erro ao criar revisão');
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, [functions]);

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
  // não no create).
  const closeReview = useCallback(async (reviewId, { takeaways = null, meetingLink = null, videoLink = null, frozenSnapshot = null } = {}) => {
    setActionLoading(true);
    setError(null);
    try {
      const ref = doc(db, 'students', studentId, 'reviews', reviewId);
      const payload = {
        status: 'CLOSED',
        closedAt: serverTimestamp(),
        takeaways,
        meetingLink,
        videoLink,
      };
      if (frozenSnapshot) payload.frozenSnapshot = frozenSnapshot;
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
    addIncludedTrade,
  };
};

export default useWeeklyReviews;
