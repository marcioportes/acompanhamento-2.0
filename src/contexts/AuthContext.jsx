import { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth, getUserRole } from '../firebase';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const role = getUserRole(firebaseUser.email);
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
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const role = getUserRole(result.user.email);
      setUserRole(role);
      return { user: result.user, role };
    } catch (err) {
      let errorMessage = 'Erro ao fazer login';
      switch (err.code) {
        case 'auth/invalid-email':
          errorMessage = 'Email inválido';
          break;
        case 'auth/user-disabled':
          errorMessage = 'Usuário desabilitado';
          break;
        case 'auth/user-not-found':
          errorMessage = 'Usuário não encontrado';
          break;
        case 'auth/wrong-password':
          errorMessage = 'Senha incorreta';
          break;
        case 'auth/invalid-credential':
          errorMessage = 'Credenciais inválidas';
          break;
        default:
          errorMessage = err.message;
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
      if (err.code === 'auth/user-not-found') {
        errorMessage = 'Email não encontrado';
      }
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const isMentor = () => userRole === 'mentor';
  const isStudent = () => userRole === 'student';

  const value = {
    user,
    userRole,
    loading,
    error,
    login,
    logout,
    resetPassword,
    isMentor,
    isStudent,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
