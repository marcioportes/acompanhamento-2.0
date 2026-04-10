/**
 * usePropFirmTemplates
 * @description CRUD para collection raiz `propFirmTemplates` (catálogo de templates de mesas proprietárias)
 *
 * PATH FIRESTORE: propFirmTemplates/{templateId} (collection raiz — INV-15 aprovado)
 *
 * Catálogo independente de alunos (como tickers). Mentor configura uma vez,
 * alunos selecionam ao criar conta tipo PROP.
 *
 * Ref: issue #52, DEC-053
 */

import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { DEFAULT_TEMPLATES, enrichTemplate } from '../constants/propFirmDefaults';

const COLLECTION_NAME = 'propFirmTemplates';

export function usePropFirmTemplates() {
  const { user, isMentor } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- Real-time listener ---
  useEffect(() => {
    if (!user) {
      setTemplates([]);
      setLoading(false);
      return;
    }

    const colRef = collection(db, COLLECTION_NAME);
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        // Enriquecer cada template com restrictedInstruments derivado da instrumentsTable
        const docs = snapshot.docs.map(d => enrichTemplate({ id: d.id, ...d.data() }));
        docs.sort((a, b) => {
          if (a.firm !== b.firm) return (a.firm ?? '').localeCompare(b.firm ?? '');
          return (a.accountSize ?? 0) - (b.accountSize ?? 0);
        });
        setTemplates(docs);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[usePropFirmTemplates] listener error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // --- Seed defaults (mentor only) ---
  const seedDefaults = useCallback(async () => {
    if (!isMentor()) throw new Error('Apenas mentor pode fazer seed de templates');

    for (const template of DEFAULT_TEMPLATES) {
      const { id, ...data } = template;
      await setDoc(doc(db, COLLECTION_NAME, id), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
  }, [isMentor]);

  // --- Add template ---
  const addTemplate = useCallback(async (templateData) => {
    if (!isMentor()) throw new Error('Apenas mentor pode criar templates');

    const docRef = doc(collection(db, COLLECTION_NAME));
    await setDoc(docRef, {
      ...templateData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  }, [isMentor]);

  // --- Update template ---
  const updateTemplate = useCallback(async (templateId, updates) => {
    if (!isMentor()) throw new Error('Apenas mentor pode editar templates');

    const docRef = doc(db, COLLECTION_NAME, templateId);
    await setDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }, [isMentor]);

  // --- Delete template ---
  const deleteTemplate = useCallback(async (templateId) => {
    if (!isMentor()) throw new Error('Apenas mentor pode deletar templates');

    await deleteDoc(doc(db, COLLECTION_NAME, templateId));
  }, [isMentor]);

  // --- Delete all templates ---
  const deleteAllTemplates = useCallback(async () => {
    if (!isMentor()) throw new Error('Apenas mentor pode deletar templates');

    const colRef = collection(db, COLLECTION_NAME);
    const { getDocs } = await import('firebase/firestore');
    const snapshot = await getDocs(colRef);
    const deletes = snapshot.docs.map(d => deleteDoc(d.ref));
    await Promise.all(deletes);
  }, [isMentor]);

  // --- Get template by ID ---
  const getTemplateById = useCallback((templateId) => {
    return templates.find(t => t.id === templateId) ?? null;
  }, [templates]);

  // --- Get templates grouped by firm ---
  const getTemplatesByFirm = useCallback(() => {
    const grouped = {};
    for (const t of templates) {
      const firm = t.firm ?? 'CUSTOM';
      if (!grouped[firm]) grouped[firm] = [];
      grouped[firm].push(t);
    }
    return grouped;
  }, [templates]);

  return {
    templates,
    loading,
    error,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    deleteAllTemplates,
    seedDefaults,
    getTemplateById,
    getTemplatesByFirm
  };
}
