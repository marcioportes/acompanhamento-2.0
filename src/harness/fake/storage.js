/** firebase/storage no harness — imagem de trade vira um placeholder local. */
export const getStorage = () => ({ __harness: true });
export const ref = (_storage, caminho) => ({ __harness: true, caminho });
export const uploadBytes = async (r) => ({ ref: r });
export const getDownloadURL = async (r) =>
  `https://placehold.co/1200x700/0f172a/64748b?text=${encodeURIComponent(r?.caminho ?? 'grafico')}`;
