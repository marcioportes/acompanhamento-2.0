import { useState, useEffect, useCallback } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  updateDoc, 
  deleteDoc, 
  doc,
  orderBy,
  limit,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook para gerenciamento de notificações
 */
export const useNotifications = () => {
  const { user, isMentor } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Carregar notificações
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Query baseada no role do usuário
    let q;
    if (isMentor()) {
      // Mentor recebe notificações com targetRole='mentor'
      q = query(
        collection(db, 'notifications'),
        where('targetRole', '==', 'mentor'),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
    } else {
      // Aluno recebe notificações com seu userId
      q = query(
        collection(db, 'notifications'),
        where('targetUserId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
    }

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const notificationsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setNotifications(notificationsData);
        setUnreadCount(notificationsData.filter(n => !n.read).length);
        setLoading(false);
      },
      (err) => {
        console.error('Erro ao carregar notificações:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, isMentor]);

  // Marcar notificação como lida
  const markAsRead = useCallback(async (notificationId) => {
    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await updateDoc(notificationRef, { read: true });
    } catch (err) {
      console.error('Erro ao marcar notificação como lida:', err);
      throw err;
    }
  }, []);

  // Marcar todas como lidas
  const markAllAsRead = useCallback(async () => {
    try {
      const batch = writeBatch(db);
      
      notifications
        .filter(n => !n.read)
        .forEach(n => {
          const notificationRef = doc(db, 'notifications', n.id);
          batch.update(notificationRef, { read: true });
        });
      
      await batch.commit();
    } catch (err) {
      console.error('Erro ao marcar todas como lidas:', err);
      throw err;
    }
  }, [notifications]);

  // Deletar notificação
  const deleteNotification = useCallback(async (notificationId) => {
    try {
      await deleteDoc(doc(db, 'notifications', notificationId));
    } catch (err) {
      console.error('Erro ao deletar notificação:', err);
      throw err;
    }
  }, []);

  // Limpar notificações antigas (mais de 30 dias)
  const clearOldNotifications = useCallback(async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const batch = writeBatch(db);
      
      notifications
        .filter(n => {
          const createdAt = n.createdAt?.toDate?.() || new Date(n.createdAt);
          return createdAt < thirtyDaysAgo;
        })
        .forEach(n => {
          const notificationRef = doc(db, 'notifications', n.id);
          batch.delete(notificationRef);
        });
      
      await batch.commit();
    } catch (err) {
      console.error('Erro ao limpar notificações antigas:', err);
      throw err;
    }
  }, [notifications]);

  // Buscar notificações não lidas
  const getUnreadNotifications = useCallback(() => {
    return notifications.filter(n => !n.read);
  }, [notifications]);

  // Buscar notificações por tipo
  const getNotificationsByType = useCallback((type) => {
    return notifications.filter(n => n.type === type);
  }, [notifications]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearOldNotifications,
    getUnreadNotifications,
    getNotificationsByType
  };
};

export default useNotifications;
