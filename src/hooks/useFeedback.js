/**
 * useFeedback
 * @version 1.0.0
 * @description Hook para gerenciar feedback de trades
 */

import { useState, useCallback } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';

const useFeedback = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const functions = getFunctions();

  /**
   * Adiciona comentário ao trade
   * @param {string} tradeId - ID do trade
   * @param {string} content - Conteúdo do comentário
   * @param {string|null} newStatus - Novo status (opcional, ex: 'QUESTION')
   */
  const addComment = useCallback(async (tradeId, content, newStatus = null) => {
    setLoading(true);
    setError(null);
    
    try {
      const addFeedbackComment = httpsCallable(functions, 'addFeedbackComment');
      const result = await addFeedbackComment({ tradeId, content, newStatus });
      return result.data;
    } catch (err) {
      const errorMessage = err.message || 'Erro ao adicionar comentário';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [functions]);

  /**
   * Encerra o trade (apenas aluno, após REVIEWED)
   * @param {string} tradeId - ID do trade
   */
  const closeTrade = useCallback(async (tradeId) => {
    setLoading(true);
    setError(null);
    
    try {
      const closeTradeFunc = httpsCallable(functions, 'closeTrade');
      const result = await closeTradeFunc({ tradeId });
      return result.data;
    } catch (err) {
      const errorMessage = err.message || 'Erro ao encerrar trade';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [functions]);

  /**
   * Marca trade como QUESTION (aluno tem dúvida)
   * @param {string} tradeId - ID do trade
   * @param {string} question - Texto da dúvida
   */
  const askQuestion = useCallback(async (tradeId, question) => {
    return addComment(tradeId, question, 'QUESTION');
  }, [addComment]);

  /**
   * Responde feedback (aluno, sem mudar status)
   * @param {string} tradeId - ID do trade
   * @param {string} response - Texto da resposta
   */
  const respondToFeedback = useCallback(async (tradeId, response) => {
    return addComment(tradeId, response, null);
  }, [addComment]);

  return {
    loading,
    error,
    addComment,
    closeTrade,
    askQuestion,
    respondToFeedback
  };
};

export default useFeedback;
export { useFeedback };
