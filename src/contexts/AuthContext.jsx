/**
 * AuthContext.jsx - Gerenciamento de Autenticação e Sessão
 * Acompanhamento 2.0 - Trading Journal
 * * VERSÃO: 5.3.2
 * DATA: 12/02/2026
 * AUTOR: System Engineer (via Assistant)
 * * CHANGELOG v5.3.2:
 * 1. FEAT: Integração Real com Cloud Function 'activateStudent'.
 * - Substituído o log estático pela chamada httpsCallable.
 * - Isso finaliza o fluxo de ativação do aluno no primeiro login.
 */

import { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail
} from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions'; 
import { auth, db, functions } from '../firebase'; 

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Emails de mentores autorizados
const MENTOR_EMAILS = ['marcio.portes@me.com'];

const getUserRole = (email) => {
  if (MENTOR_EMAILS.includes(email?.toLowerCase())) return 'mentor';
  return 'student';
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Verifica se o email existe na coleção 'students' (Whitelist).
   */
  const checkStudentWhitelist = async (email) => {
    try {
      const q = query(collection(db, 'students'), where('email', '==', email.toLowerCase()));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        console.warn(`[AUTH] Acesso negado: ${email} não encontrado na whitelist.`);
        return null;
      }
      
      const studentData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
      console.log('[AUTH] Aluno validado na whitelist:', studentData.id);
      return studentData;
    } catch (e) {
      console.error('[AUTH] Erro crítico ao ler whitelist:', e);
      throw e;
    }
  };

  /**
   * Ativa o aluno via Backend (Cloud Function)
   */
  const callActivateStudent = async () => {
    try {
      console.log('[AUTH] Chamando Cloud Function para ativar aluno...');
      const activateFn = httpsCallable(functions, 'activateStudent');
      const result = await activateFn();
      console.log('[AUTH] Resultado da ativação:', result.data);
    } catch (e) {
      console.error('[AUTH] Erro ao ativar aluno via Backend:', e);
      // Não lançamos erro aqui para não bloquear o login se a função falhar temporariamente
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('[AUTH] Estado alterado:', firebaseUser?.email || 'Deslogado');
      
      if (firebaseUser) {
        const role = getUserRole(firebaseUser.email);
        
        // Validação de Sessão Persistente
        if (role !== 'mentor') {
          try {
            const student = await checkStudentWhitelist(firebaseUser.email);
            
            if (!student) {
               console.error('[AUTH] Usuário removido da whitelist. Encerrando sessão.');
               await signOut(auth);
               return;
            }
            
            // Se pendente na sessão persistente, tenta ativar também
            if (student.status === 'pending') {
              await callActivateStudent();
            }

          } catch (e) {
             console.error('[AUTH] Falha na revalidação de sessão:', e);
          }
        }

        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || firebaseUser.email.split('@')[0],
        });
        setUserRole(role);
      } else {
        setUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = async (email, password) => {
    setError(null);
    setLoading(true);
    
    console.log('[AUTH] Iniciando processo de login:', email);
    
    try {
      const role = getUserRole(email);
      
      // PASSO 1: Autenticação no Firebase Auth
      const result = await signInWithEmailAndPassword(auth, email, password);
      console.log('[AUTH] Credenciais verificadas no Firebase Auth.');

      // PASSO 2: Autorização de Negócio (Whitelist)
      if (role !== 'mentor') {
        try {
          const student = await checkStudentWhitelist(email);
          
          if (!student) {
            console.error('[AUTH] Login abortado: Usuário fora da whitelist.');
            await signOut(auth);
            throw new Error('Acesso não autorizado. Seu cadastro não consta na lista de alunos ativos.');
          }

          // PASSO 3: Ativação via Backend
          if (student.status === 'pending') {
            // Chama a função sem await para não atrasar a entrada visual do usuário
            callActivateStudent(); 
          }

        } catch (whitelistError) {
          if (auth.currentUser) await signOut(auth);
          throw whitelistError;
        }
      }

      setUserRole(role);
      return { user: result.user, role };
      
    } catch (err) {
      console.error('[AUTH] Falha no login:', err.code, err.message);
      
      let errorMessage = 'Erro ao fazer login';
      
      if (err.code === 'auth/invalid-email') errorMessage = 'Email inválido';
      else if (err.code === 'auth/user-disabled') errorMessage = 'Conta desativada temporariamente';
      else if (err.code === 'auth/user-not-found') errorMessage = 'Usuário não encontrado.';
      else if (err.code === 'auth/wrong-password') errorMessage = 'Senha incorreta';
      else if (err.code === 'auth/invalid-credential') errorMessage = 'Email ou senha incorretos';
      else if (err.code === 'auth/too-many-requests') errorMessage = 'Muitas tentativas. Aguarde 5 minutos.';
      else if (err.message) errorMessage = err.message;
      
      setError(errorMessage);
      setLoading(false);
      throw new Error(errorMessage);
    }
  };

  const logout = async () => {
    setError(null);
    try {
      await signOut(auth);
      setUser(null);
      setUserRole(null);
    } catch (err) {
      setError('Erro ao fazer logout');
      throw err;
    }
  };

  const resetPassword = async (email) => {
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err) {
      let errorMessage = 'Erro ao enviar email de recuperação';
      if (err.code === 'auth/user-not-found') errorMessage = 'Email não cadastrado';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const isMentor = () => userRole === 'mentor';
  const isStudent = () => userRole === 'student';

  const value = {
    user, userRole, loading, error,
    login, logout, resetPassword,
    isMentor, isStudent,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;