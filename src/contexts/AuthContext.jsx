import { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail
} from 'firebase/auth';
import { collection, query, where, getDocs, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Emails de mentores
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
      if (snapshot.empty) {
        console.log('Aluno não encontrado na whitelist:', email);
        return null;
      }
      const studentData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
      console.log('Aluno encontrado:', studentData);
      return studentData;
    } catch (e) {
      console.error('Erro ao verificar whitelist:', e);
      return null;
    }
  };

  // Atualizar status do aluno para ativo
  const activateStudent = async (studentId) => {
    try {
      await updateDoc(doc(db, 'students', studentId), {
        status: 'active',
        firstLoginAt: serverTimestamp()
      });
      console.log('Aluno ativado:', studentId);
    } catch (e) {
      console.error('Erro ao ativar aluno:', e);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('onAuthStateChanged:', firebaseUser?.email || 'sem usuário');
      
      if (firebaseUser) {
        const role = getUserRole(firebaseUser.email);
        console.log('Role detectado:', role);
        
        // Se for aluno, verificar e ativar se pendente
        if (role !== 'mentor') {
          const student = await checkStudentWhitelist(firebaseUser.email);
          if (student && student.status === 'pending') {
            await activateStudent(student.id);
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
    
    console.log('Tentando login:', email);
    
    try {
      const role = getUserRole(email);
      console.log('Role para login:', role);
      
      // Se não é mentor, verificar whitelist ANTES de autenticar
      if (role !== 'mentor') {
        const student = await checkStudentWhitelist(email);
        if (!student) {
          const err = new Error('Email não autorizado. Contate seu mentor para solicitar acesso.');
          setError(err.message);
          setLoading(false);
          throw err;
        }
        console.log('Aluno autorizado, tentando autenticar...');
      }

      // Autenticar no Firebase
      const result = await signInWithEmailAndPassword(auth, email, password);
      console.log('Login bem-sucedido:', result.user.email);
      
      // Se é aluno e pendente, ativar
      if (role !== 'mentor') {
        const student = await checkStudentWhitelist(email);
        if (student && student.status === 'pending') {
          await activateStudent(student.id);
        }
      }

      setUserRole(role);
      return { user: result.user, role };
      
    } catch (err) {
      console.error('Erro no login:', err.code, err.message);
      
      let errorMessage = 'Erro ao fazer login';
      
      // Erros do Firebase Auth
      if (err.code === 'auth/invalid-email') {
        errorMessage = 'Email inválido';
      } else if (err.code === 'auth/user-disabled') {
        errorMessage = 'Usuário desabilitado';
      } else if (err.code === 'auth/user-not-found') {
        errorMessage = 'Usuário não encontrado. Verifique o email ou contate seu mentor.';
      } else if (err.code === 'auth/wrong-password') {
        errorMessage = 'Senha incorreta';
      } else if (err.code === 'auth/invalid-credential') {
        errorMessage = 'Email ou senha incorretos';
      } else if (err.code === 'auth/too-many-requests') {
        errorMessage = 'Muitas tentativas. Aguarde alguns minutos.';
      } else if (err.message) {
        // Erro customizado (whitelist)
        errorMessage = err.message;
      }
      
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
