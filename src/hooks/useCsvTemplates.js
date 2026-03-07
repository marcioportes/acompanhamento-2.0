/**
 * useCsvTemplates
 * @version 1.0.0 (v1.18.0)
 * @description Hook para CRUD de templates de mapeamento CSV.
 *   Templates são compartilhados (por corretora/plataforma) e salvos em `csvTemplates`.
 *
 * USAGE:
 *   const { templates, loading, addTemplate, updateTemplate, deleteTemplate } = useCsvTemplates();
 */

import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

const COLLECTION = 'csvTemplates';

const useCsvTemplates = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  // Listener real-time
  useEffect(() => {
    const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTemplates(list);
      setLoading(false);
    }, (err) => {
      console.error('[useCsvTemplates] Listener error:', err);
      setLoading(false);
    });
    return unsub;
  }, []);

  /**
   * Cria um novo template.
   * @param {Object} templateData - { name, platform, mapping, valueMap, defaults, dateFormat, delimiter }
   * @returns {Promise<string>} ID do template criado
   */
  const addTemplate = useCallback(async (templateData) => {
    if (!user) throw new Error('Autenticação necessária');

    const docData = {
      name: templateData.name || 'Sem nome',
      platform: templateData.platform || '',
      description: templateData.description || '',
      mapping: templateData.mapping || {},
      valueMap: templateData.valueMap || {},
      defaults: templateData.defaults || {},
      dateFormat: templateData.dateFormat || '',
      delimiter: templateData.delimiter || ';',
      encoding: templateData.encoding || 'UTF-8',
      isPublic: true,
      createdBy: user.uid,
      createdByEmail: user.email,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const ref = await addDoc(collection(db, COLLECTION), docData);
    console.log(`[useCsvTemplates] Template criado: ${ref.id}`);
    return ref.id;
  }, [user]);

  /**
   * Atualiza um template existente.
   * @param {string} templateId
   * @param {Object} updates
   */
  const updateTemplate = useCallback(async (templateId, updates) => {
    if (!user) throw new Error('Autenticação necessária');

    const ref = doc(db, COLLECTION, templateId);
    await updateDoc(ref, {
      ...updates,
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
    });
    console.log(`[useCsvTemplates] Template atualizado: ${templateId}`);
  }, [user]);

  /**
   * Deleta um template.
   * @param {string} templateId
   */
  const deleteTemplate = useCallback(async (templateId) => {
    const ref = doc(db, COLLECTION, templateId);
    await deleteDoc(ref);
    console.log(`[useCsvTemplates] Template deletado: ${templateId}`);
  }, []);

  return { templates, loading, addTemplate, updateTemplate, deleteTemplate };
};

export default useCsvTemplates;
