/**
 * AuthContext
 * @version 2.0.1
 * @description Contexto de autenticação com ativação automática de aluno
 * * FIX v2.0.1: Remove verificação de whitelist PRÉ-login. 
 * A verificação agora ocorre PÓS-login para respeitar as regras do Firestore.
 */

import { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail
} from 'firebase/auth';
import { collection, query, where, getDocs, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { shouldActivateStudent, buildActivatePayload } from '../utils/studentActivation';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Emails de mentores (pode mover para Firestore depois)
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

  // Verificar whitelist de alunos
  const checkStudentWhitelist = async (email) => {
    try {
      const q = query(collection(db, 'students'), where('email', '==', email.toLowerCase()));
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;
      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    } catch (err) {
      console.error('[AuthContext] Erro whitelist:', err);
      // Se der erro de permissão aqui, é porque algo muito errado aconteceu, 
      // mas agora só acontecerá se o usuário logado realmente não tiver acesso.
      return null;
    }
  };

  // Ativa aluno no 1º login (idempotente — política em studentActivation).
  // DEC-AUTO-263-07: accessStatus='active' é o sinal canônico do ritual completo.
  // DEC-AUTO-271-02 (#271): callers passam o student inteiro; decisão e
  // payload moram em src/utils/studentActivation.js (testáveis).
  const activateStudent = async (student) => {
    if (!shouldActivateStudent(student)) return;
    try {
      await updateDoc(doc(db, 'students', student.id), buildActivatePayload(serverTimestamp()));
      console.log('[AuthContext] Aluno ativado:', student.id);
    } catch (err) {
      console.error('[AuthContext] Erro ao ativar:', err);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const role = getUserRole(firebaseUser.email);
        
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || firebaseUser.email.split('@')[0],
        });
        setUserRole(role);

        // Se é aluno, verificar e ativar (idempotente — só escreve se accessStatus !== 'active').
        if (role === 'student') {
          const student = await checkStudentWhitelist(firebaseUser.email);
          if (student) await activateStudent(student);
        }
      } else {
        setUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- LOGIN CORRIGIDO ---
  const login = async (email, password) => {
    setError(null);
    setLoading(true);
    try {
      const role = getUserRole(email);
      
      // 1. PRIMEIRO: Autentica no Firebase Auth (Garante o token)
      const result = await signInWithEmailAndPassword(auth, email, password);
      
      // 2. SEGUNDO: Se não for mentor, verifica se está autorizado no Banco
      if (role !== 'mentor') {
        // Agora o request.auth != null, então a regra do Firestore vai passar
        const student = await checkStudentWhitelist(email);
        
        if (!student) {
          // Se autenticou mas não é aluno válido: TCHAU!
          await signOut(auth);
          throw { code: 'auth/not-authorized', message: 'Email não autorizado. Contate seu mentor.' };
        }

        // Ativa (idempotente — só escreve se accessStatus !== 'active')
        await activateStudent(student);
      }

      setUserRole(role);
      return { user: result.user, role };
    } catch (err) {
      // Se houve logout forçado acima, o catch pega o erro e exibe
      let errorMessage = 'Erro ao fazer login';
      switch (err.code) {
        case 'auth/invalid-email': errorMessage = 'Email inválido'; break;
        case 'auth/user-disabled': errorMessage = 'Usuário desabilitado'; break;
        case 'auth/user-not-found': errorMessage = 'Usuário não encontrado'; break;
        case 'auth/wrong-password': errorMessage = 'Senha incorreta'; break;
        case 'auth/invalid-credential': errorMessage = 'Credenciais inválidas'; break;
        case 'auth/not-authorized': errorMessage = err.message; break;
        default: errorMessage = err.message;
      }
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
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
      if (err.code === 'auth/user-not-found') errorMessage = 'Email não encontrado';
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