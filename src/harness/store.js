/**
 * store.js — o banco em memória do harness visual (issue #427)
 *
 * Guarda documentos por caminho de collection: `'trades'`, `'students/u1/reviews'`.
 * Nada aqui sabe o que é um trade — quem dá forma ao dado é a fixture.
 *
 * O harness existe porque duas entregas seguidas foram para produção sem que
 * ninguém olhasse a tela renderizada (#421, #423). Aliasar o SDK do Firebase, e
 * não os hooks, é deliberado: assim `AuthContext`, `useTrades` e o resto rodam
 * REAIS, e o que a foto mostra é o código de produção. Stub de hook reproduz a
 * forma e não o comportamento — e quando diverge, o harness fica certo e a
 * produção fica errada, que é exatamente o defeito que este loop existe para pegar.
 */

/** Timestamp compatível com o do Firestore no que os consumidores usam. */
export class FakeTimestamp {
  constructor(date) { this._date = new Date(date); }
  static fromDate(d) { return new FakeTimestamp(d); }
  static now() { return new FakeTimestamp(new Date()); }
  toDate() { return new Date(this._date); }
  toMillis() { return this._date.getTime(); }
  get seconds() { return Math.floor(this._date.getTime() / 1000); }
  valueOf() { return this._date.getTime(); }
}

const dados = new Map();
let latenciaMs = 0;

/** Semeia uma collection. `docs` = [{ id, ...campos }]. */
export const semear = (caminho, docs) => {
  dados.set(caminho, docs.map((d) => ({ ...d })));
};

export const semearTudo = ({ collections = {}, subcollections = {} }) => {
  dados.clear();
  Object.entries(collections).forEach(([c, docs]) => semear(c, docs));
  Object.entries(subcollections).forEach(([c, docs]) => semear(c, docs));
};

export const lerCollection = (caminho) => dados.get(caminho) ?? [];

/**
 * CollectionGroup: toda collection cujo ÚLTIMO segmento casa com o nome.
 * `useMentorMaturityOverview` depende disso para varrer `students/{id}/maturity`.
 */
export const lerCollectionGroup = (nome) => {
  const saida = [];
  for (const [caminho, docs] of dados.entries()) {
    const segs = caminho.split('/');
    if (segs[segs.length - 1] === nome) {
      docs.forEach((d) => saida.push({ doc: d, caminho }));
    }
  }
  return saida;
};

export const caminhosConhecidos = () => [...dados.keys()];

export const setLatencia = (ms) => { latenciaMs = ms; };
export const getLatencia = () => latenciaMs;

/** Acesso por caminho pontuado — `mentor.closingCommentAt` é campo real de cycleClosures. */
export const valorDoCampo = (obj, campo) =>
  String(campo).split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
