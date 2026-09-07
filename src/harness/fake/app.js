/** firebase/app no harness — `initializeApp` devolve um handle inerte. */
export const initializeApp = (config) => ({ __harness: true, options: config });
export default { initializeApp };
