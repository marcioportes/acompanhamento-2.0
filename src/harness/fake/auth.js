/**
 * firebase/auth no harness (issue #427)
 *
 * O papel sai só do email — `MENTOR_EMAILS` em `AuthContext.jsx` e `getUserRole`
 * em `firebase.js`. Entregando o email certo no `onAuthStateChanged`, o
 * `AuthProvider` REAL deriva `'mentor'` ou `'student'` sozinho, e o ramo de aluno
 * (que faz `getDocs` na whitelist e pode ativar o cadastro) roda de verdade.
 *
 * `definirUsuario` é chamado pelo `main.jsx` ANTES do render, a partir do
 * `?papel=` da URL. Trocar o email é o único jeito honesto de fotografar o lado
 * do aluno: forçar o papel na marra pularia justamente o caminho que decide o que
 * ele enxerga.
 */
export const MENTOR_EMAIL = 'marcio.portes@me.com';

let usuario = {
  uid: 'mentor-harness',
  email: MENTOR_EMAIL,
  displayName: 'Marcio Portes',
  emailVerified: true,
};

export const definirUsuario = (novo) => { usuario = { ...usuario, ...novo }; };

export const getAuth = () => ({ __harness: true, get currentUser() { return usuario; } });

export const onAuthStateChanged = (_auth, cb) => {
  // Assíncrono de propósito: o `loading` do AuthProvider é estado real da tela.
  const id = setTimeout(() => cb(usuario), 0);
  return () => clearTimeout(id);
};

export const signInWithEmailAndPassword = async () => ({ user: usuario });
export const signOut = async () => {};
export const createUserWithEmailAndPassword = async () => ({ user: usuario });
export const deleteUser = async () => {};
export const sendPasswordResetEmail = async () => {};
