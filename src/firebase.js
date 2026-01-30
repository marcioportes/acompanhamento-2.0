import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

// Configuração Firebase - Acompanhamento 2.0
const firebaseConfig = {
  apiKey: "AIzaSyA4bILzUTtkZvkOLz3B_EzYKFwrw0xygfc",
  authDomain: "acompanhamento-20.firebaseapp.com",
  projectId: "acompanhamento-20",
  storageBucket: "acompanhamento-20.firebasestorage.app",
  messagingSenderId: "761679940146",
  appId: "1:761679940146:web:1bae12ce93456c62238a2b",
  measurementId: "G-SYK41VDLE8"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);

// Serviços Firebase
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// ============================================
// CONFIGURAÇÃO DE MENTOR
// ============================================
export const MENTOR_EMAIL = 'marcio.portes@me.com';

// Helper para obter role do usuário
// Qualquer email diferente do mentor é student
export const getUserRole = (email) => {
  return email === MENTOR_EMAIL ? 'mentor' : 'student';
};

// Helper para verificar se é mentor
export const isMentorEmail = (email) => {
  return email === MENTOR_EMAIL;
};

// ============================================
// CONSTANTES LEGADAS (para compatibilidade)
// Novos componentes devem usar useMasterData()
// ============================================

// Setups (legado - usar collection 'setups')
export const SETUPS = [
  'Fractal TTrades',
  'Rompimento',
  'Pullback',
  'Reversão',
  'Tendência',
  'VWAP',
  'Gap',
  'Scalp',
  'Swing',
  'Outros'
];

// Emoções (legado - usar collection 'emotions')
export const EMOTIONS = [
  'Disciplinado',
  'Confiante',
  'Neutro',
  'Ansioso',
  'FOMO',
  'Hesitante',
  'Eufórico',
  'Frustrado',
  'Revenge',
  'Overtrading'
];

// Exchanges (legado - usar collection 'exchanges')
export const EXCHANGES = ['B3', 'CME', 'NYSE', 'NASDAQ', 'CRYPTO'];

// Lados
export const SIDES = ['LONG', 'SHORT'];

// Tipos de conta
export const ACCOUNT_TYPES = ['REAL', 'DEMO', 'PROP'];

// Tipos de movimentação
export const MOVEMENT_TYPES = ['DEPOSIT', 'WITHDRAWAL'];

// Status do trade
export const TRADE_STATUS = {
  PENDING_REVIEW: 'PENDING_REVIEW',
  REVIEWED: 'REVIEWED',
  IN_REVISION: 'IN_REVISION'
};

export default app;
