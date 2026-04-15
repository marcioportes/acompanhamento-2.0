/**
 * useLocalStorage.js
 * @description Hook genérico para persistir state em localStorage como JSON.
 *              Trata SSR, acesso negado (modo anônimo), e JSON corrompido.
 *
 * @see Issue #118 — Barra de Contexto Unificado (DEC-047)
 */

import { useState, useEffect, useCallback } from 'react';

const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const readFromStorage = (key, fallback) => {
  if (!isBrowser) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`[useLocalStorage] Falha ao ler "${key}":`, err.message);
    return fallback;
  }
};

const writeToStorage = (key, value) => {
  if (!isBrowser) return;
  try {
    if (value === undefined || value === null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  } catch (err) {
    console.warn(`[useLocalStorage] Falha ao gravar "${key}":`, err.message);
  }
};

/**
 * Hook para persistir state em localStorage.
 *
 * @param {string} key - Chave no localStorage (versionar manualmente, ex: "studentContext_v1_userId")
 * @param {any} initialValue - Valor inicial se nada persistido
 * @returns {[value, setValue, clear]}
 */
export const useLocalStorage = (key, initialValue) => {
  const [value, setValue] = useState(() => readFromStorage(key, initialValue));

  useEffect(() => {
    writeToStorage(key, value);
  }, [key, value]);

  const clear = useCallback(() => {
    if (!isBrowser) return;
    try {
      window.localStorage.removeItem(key);
    } catch (err) {
      console.warn(`[useLocalStorage] Falha ao remover "${key}":`, err.message);
    }
    setValue(initialValue);
  }, [key, initialValue]);

  return [value, setValue, clear];
};

export default useLocalStorage;
