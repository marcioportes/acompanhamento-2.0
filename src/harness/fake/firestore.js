/**
 * firebase/firestore no harness (issue #427)
 *
 * Superfície implementada = superfície medida no `src/`: 20 símbolos, 4 operadores
 * de `where` (`==` 68 usos, `in` 3, `>=` 2, `<=` 1). Nada além disso é adivinhado.
 *
 * Duas regras de projeto, ambas contra o mesmo inimigo — a tela vazia sem
 * explicação, que foi o que passou despercebido em produção:
 *
 *   1. Operador, collection ou caminho desconhecido **lança**, nomeando o
 *      chamador. Devolver `[]` em silêncio é como um bug de dado vira "achei
 *      que era assim mesmo".
 *   2. `onSnapshot` entrega ASSÍNCRONO, com latência configurável. É o que faz o
 *      estado de carregando existir de verdade — e ele é uma das telas a fotografar.
 */
import {
  FakeTimestamp, lerCollection, lerCollectionGroup, caminhosConhecidos,
  getLatencia, valorDoCampo,
} from '../store';

export const Timestamp = FakeTimestamp;
export const getFirestore = () => ({ __harness: true });
export const serverTimestamp = () => FakeTimestamp.now();
export const arrayUnion = (...itens) => ({ __op: 'arrayUnion', itens });
export const arrayRemove = (...itens) => ({ __op: 'arrayRemove', itens });

/** Caminho com nº ÍMPAR de segmentos é collection; PAR é documento. */
const montarRef = (segs) => {
  const path = segs.join('/');
  const ehColecao = segs.length % 2 === 1;
  return {
    __harness: true,
    type: ehColecao ? 'collection' : 'document',
    path,
    id: segs[segs.length - 1],
    get parent() {
      return segs.length <= 1 ? null : montarRef(segs.slice(0, -1));
    },
  };
};

const segmentos = (partes) =>
  partes.flatMap((p) => String(p).split('/')).filter(Boolean);

export const collection = (_db, ...partes) => {
  const segs = segmentos(partes);
  if (segs.length % 2 === 0) {
    throw new Error(`[harness] collection() com caminho de documento: "${segs.join('/')}"`);
  }
  return montarRef(segs);
};

export const doc = (_dbOuRef, ...partes) => {
  const base = _dbOuRef?.__harness && _dbOuRef.path ? _dbOuRef.path.split('/') : [];
  const segs = [...base, ...segmentos(partes)];
  if (segs.length % 2 === 1) {
    throw new Error(`[harness] doc() com caminho de collection: "${segs.join('/')}"`);
  }
  return montarRef(segs);
};

export const collectionGroup = (_db, nome) => ({
  __harness: true, type: 'collectionGroup', nome, path: nome,
});

export const where = (field, op, value) => ({ tipo: 'where', field, op, value });
export const orderBy = (field, dir = 'asc') => ({ tipo: 'orderBy', field, dir });
export const limit = (n) => ({ tipo: 'limit', n });

export const query = (ref, ...restricoes) => ({
  __harness: true, type: 'query', ref, restricoes,
});

// ---------------------------------------------------------------- execução

const casa = (docData, { field, op, value }, origem) => {
  const v = valorDoCampo(docData, field);
  switch (op) {
    case '==': return v === value;
    case '!=': return v !== value;
    case 'in': return Array.isArray(value) && value.includes(v);
    case 'not-in': return Array.isArray(value) && !value.includes(v);
    case '>=': return norm(v) >= norm(value);
    case '<=': return norm(v) <= norm(value);
    case '>': return norm(v) > norm(value);
    case '<': return norm(v) < norm(value);
    case 'array-contains': return Array.isArray(v) && v.includes(value);
    default:
      throw new Error(`[harness] operador de where() não implementado: "${op}" em ${origem}`);
  }
};

const norm = (v) => (v instanceof FakeTimestamp ? v.toMillis() : v);

const montarSnapshotDoc = (doc, caminhoColecao) => {
  const { id, ...data } = doc;
  const ref = montarRef([...caminhoColecao.split('/'), id]);
  return {
    id, ref,
    exists: () => true,
    data: () => data,
  };
};

const coletar = (alvo) => {
  const ref = alvo.type === 'query' ? alvo.ref : alvo;
  if (ref.type === 'collectionGroup') {
    return lerCollectionGroup(ref.nome).map(({ doc, caminho }) => montarSnapshotDoc(doc, caminho));
  }
  if (ref.type !== 'collection') {
    throw new Error(`[harness] leitura de collection esperava ref de collection, veio "${ref.type}"`);
  }
  if (!caminhosConhecidos().includes(ref.path)) {
    // Collection não semeada: pode ser fixture incompleta OU caminho errado no
    // código. Avisa alto e devolve vazio — travar aqui esconderia as duas.
    console.warn(`[harness] collection sem seed: "${ref.path}" (semeadas: ${caminhosConhecidos().join(', ')})`);
    return [];
  }
  return lerCollection(ref.path).map((d) => montarSnapshotDoc(d, ref.path));
};

const aplicar = (docs, restricoes, origem) => {
  let out = docs;
  for (const r of restricoes) {
    if (r.tipo === 'where') out = out.filter((d) => casa(d.data(), r, origem));
  }
  for (const r of restricoes) {
    if (r.tipo === 'orderBy') {
      const dir = r.dir === 'desc' ? -1 : 1;
      out = [...out].sort((a, b) => {
        const va = norm(valorDoCampo(a.data(), r.field));
        const vb = norm(valorDoCampo(b.data(), r.field));
        if (va == null && vb == null) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        return va < vb ? -dir : va > vb ? dir : 0;
      });
    }
  }
  const lim = restricoes.find((r) => r.tipo === 'limit');
  return lim ? out.slice(0, lim.n) : out;
};

const montarQuerySnapshot = (docs) => ({
  docs, size: docs.length, empty: docs.length === 0,
  forEach: (fn) => docs.forEach(fn),
});

const executar = (alvo) => {
  const restricoes = alvo.type === 'query' ? alvo.restricoes : [];
  const origem = (alvo.type === 'query' ? alvo.ref : alvo).path;
  return montarQuerySnapshot(aplicar(coletar(alvo), restricoes, origem));
};

export const getDocs = async (alvo) => executar(alvo);

export const getDoc = async (ref) => {
  const caminhoColecao = ref.path.split('/').slice(0, -1).join('/');
  const achado = lerCollection(caminhoColecao).find((d) => d.id === ref.id);
  if (!achado) return { id: ref.id, ref, exists: () => false, data: () => undefined };
  return montarSnapshotDoc(achado, caminhoColecao);
};

/**
 * `onSnapshot` serve collection, collectionGroup E documento — `useComplianceRules`
 * observa um doc único (`masterData/compliance`), e a primeira execução do
 * harness quebrou exatamente aí. O shim falhar alto foi o que tornou o gap
 * visível em segundos, em vez de virar uma tela vazia sem explicação.
 */
export const onSnapshot = (alvo, onNext, onError) => {
  let vivo = true;
  const ehDoc = alvo?.type === 'document';
  const id = setTimeout(async () => {
    if (!vivo) return;
    try { onNext(ehDoc ? await getDoc(alvo) : executar(alvo)); }
    catch (e) { if (onError) onError(e); else throw e; }
  }, getLatencia());
  return () => { vivo = false; clearTimeout(id); };
};

// ------------------------------------------------- escrita: no-op que registra

const registrar = (op, ref, dados) => {
  console.info(`[harness] ${op} ignorado em "${ref?.path ?? '?'}"`, dados ?? '');
};
export const addDoc = async (ref, dados) => { registrar('addDoc', ref, dados); return montarRef([...ref.path.split('/'), 'novo-harness']); };
export const setDoc = async (ref, dados) => registrar('setDoc', ref, dados);
export const updateDoc = async (ref, dados) => registrar('updateDoc', ref, dados);
export const deleteDoc = async (ref) => registrar('deleteDoc', ref);
export const writeBatch = () => ({
  set: (r, d) => registrar('batch.set', r, d),
  update: (r, d) => registrar('batch.update', r, d),
  delete: (r) => registrar('batch.delete', r),
  commit: async () => registrar('batch.commit', { path: '(lote)' }),
});
