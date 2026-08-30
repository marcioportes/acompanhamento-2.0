/**
 * tradeInstant.js — issue #402
 *
 * SSoT do INSTANTE de um trade e da ordem cronológica entre trades.
 *
 * POR QUE EXISTE:
 *   Todo consumidor que precisava caminhar o dia em ordem inventou a própria
 *   regra, e duas delas ordenavam por `createdAt` — isto é, por ordem de
 *   ESCRITA. `analyzePlanCompliance` (calculations.js) e `computeStopBreach`
 *   (cycleMetrics.js) caminhavam o dia na ordem em que o importador gravou,
 *   não na ordem em que o aluno operou. Foi assim que o trade das 10:51 de
 *   25/08/2026 recebeu a violação de stop diário causada pelo trade das 11:34:
 *   o importador gravou o segundo 3 segundos ANTES do primeiro.
 *
 * POR QUE NÃO DÁ PRA COMPARAR `entryTime` COMO STRING:
 *   222 dos 364 trades da base têm `entryTime` naive (`'2026-08-25T10:51:01'`)
 *   e 141 têm offset (`'2026-08-25T11:34:02-03:00'`). `localeCompare` entre as
 *   duas formas compara representações incompatíveis — `"...T16:23:00-04:00"`
 *   ordena antes de `"...T17:00:00-03:00"` mesmo sendo o instante posterior.
 *
 * O `source` do retorno é o mecanismo de honestidade: quando o instante teve de
 * ser inferido (ou pior, derivado só da data), a UI declara que a ordem do dia
 * foi inferida em vez de afirmar um "2º trade" que ela não pode provar.
 *
 * Espelho CJS: `functions/shared/tradeInstant.js` — manter em sincronia
 * (teste de paridade em `src/__tests__/functions/shared/tradeInstantMirror.test.js`).
 *
 * @see src/utils/tradeTimezone.js — contrato de fuso do #292
 * @see functions/shared/orderInstant.js — o mesmo movimento do lado das ordens (#388)
 */
import {
  TIMEZONES,
  getOffset,
  naiveIsoToOffset,
  tzFromStoredIso,
  defaultTzForExchange,
  defaultTzForTicker,
} from './tradeTimezone';

/** ISO que já carrega instante absoluto (offset explícito ou Z). */
const HAS_TZ = /[zZ]$|[+-]\d{2}:?\d{2}$/;

/** Meio-dia: derivar a data sem hora nunca deve cruzar fronteira de dia. */
const MEIO_DIA = '12:00:00';

const finito = (n) => typeof n === 'number' && Number.isFinite(n);

/**
 * Fuso a assumir para um horário naive deste trade.
 *
 * Inferido POR TRADE, não por dia: 10 dias da base têm exchange/ticker mistos
 * entre as linhas, e assumir um fuso único para o dia erraria essas.
 *
 * @returns {string} id IANA — sempre resolve (Brasília é o último fallback)
 */
function inferirTz(trade) {
  // 1. O par do próprio trade já gravado com offset é a melhor evidência.
  const doExit = tzFromStoredIso(trade?.exitTime);
  if (doExit) return doExit;
  // 2. A bolsa.
  if (trade?.exchange) return defaultTzForExchange(trade.exchange);
  // 3. O contrato (futuros CME → ET).
  if (trade?.ticker) return defaultTzForTicker(trade.ticker);
  return TIMEZONES.BRT.id;
}

/**
 * Instante absoluto do trade, com a proveniência de como foi obtido.
 *
 * Cadeia: offset explícito → naive resolvido pelo fuso inferido → data ao
 * meio-dia → nada.
 *
 * @param {Object} trade
 * @param {'entryTime'|'exitTime'} [field='entryTime']
 * @returns {{ ms: number|null, source: 'offset'|'inferred'|'date'|'none', tz: string|null, iso: string|null }}
 */
export function tradeInstantInfo(trade, field = 'entryTime') {
  const vazio = { ms: null, source: 'none', tz: null, iso: null };
  if (!trade || typeof trade !== 'object') return vazio;

  const raw = trade[field];

  if (typeof raw === 'string' && raw.includes('T')) {
    if (HAS_TZ.test(raw)) {
      const ms = Date.parse(raw);
      if (finito(ms)) return { ms, source: 'offset', tz: tzFromStoredIso(raw), iso: raw };
    } else {
      const tz = inferirTz(trade);
      const iso = naiveIsoToOffset(raw, tz);
      const ms = Date.parse(iso);
      if (finito(ms)) return { ms, source: 'inferred', tz, iso };
    }
  }

  // Sem hora utilizável: o dia inteiro colapsa no meio-dia local. Preserva a
  // ordem ENTRE dias e admite não saber a ordem DENTRO do dia.
  const date = typeof trade.date === 'string' ? trade.date.slice(0, 10) : null;
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const tz = inferirTz(trade);
    const iso = `${date}T${MEIO_DIA}${getOffset(date, tz)}`;
    const ms = Date.parse(iso);
    if (finito(ms)) return { ms, source: 'date', tz, iso };
  }

  return vazio;
}

/**
 * Instante em ms, ou null.
 * @returns {number|null}
 */
export function tradeInstantMs(trade, field = 'entryTime') {
  return tradeInstantInfo(trade, field).ms;
}

/** Timestamp de criação em ms — aceita Firestore Timestamp, Date, número ou ISO. */
function createdAtMs(trade) {
  const c = trade?.createdAt;
  if (!c) return null;
  if (finito(c.seconds)) return c.seconds * 1000 + Math.round((c.nanoseconds || 0) / 1e6);
  if (typeof c.toDate === 'function') {
    const ms = c.toDate().getTime();
    return finito(ms) ? ms : null;
  }
  if (c instanceof Date) return finito(c.getTime()) ? c.getTime() : null;
  if (finito(c)) return c;
  if (typeof c === 'string') {
    const ms = Date.parse(c);
    return finito(ms) ? ms : null;
  }
  return null;
}

/** Ausente vai para o FIM da ordem — nunca para o começo. */
function cmpNullLast(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Ordem cronológica canônica: data → instante → createdAt → id.
 *
 * Total e determinística — o desempate final por `id` garante que permutar a
 * entrada nunca muda a saída, que é a propriedade que faltava e deixou o
 * resultado dependente de ordem de escrita em lote.
 *
 * @returns {number}
 */
export function compareTradesChrono(a, b) {
  const porData = cmpNullLast(
    typeof a?.date === 'string' ? a.date : null,
    typeof b?.date === 'string' ? b.date : null,
  );
  if (porData !== 0) return porData;

  const porInstante = cmpNullLast(tradeInstantMs(a), tradeInstantMs(b));
  if (porInstante !== 0) return porInstante;

  const porCriacao = cmpNullLast(createdAtMs(a), createdAtMs(b));
  if (porCriacao !== 0) return porCriacao;

  return cmpNullLast(a?.id ?? null, b?.id ?? null);
}

/**
 * Cópia ordenada cronologicamente. Nunca muta a entrada.
 * @returns {Object[]}
 */
export function sortTradesChrono(trades) {
  if (!Array.isArray(trades)) return [];
  return [...trades].sort(compareTradesChrono);
}

/**
 * A ordem intradiária deste conjunto é confiável?
 *
 * Com um trade só a pergunta não se coloca. Com mais de um, o risco real não é
 * o horário naive em si — se TODAS as linhas do dia são naive, o mesmo fuso é
 * aplicado a todas e a ordem relativa se preserva (é o caso de 74 dos 75 dias
 * com mais de um trade na base). O risco é o dia MISTURADO e o trade sem hora.
 *
 * O terceiro risco é o EMPATE: duas operações com o mesmo instante ao segundo.
 * A ordenação as devolve numa ordem qualquer (desempate por criação e por id),
 * e qualquer frase de sequência sobre elas — "a 2ª das 3", "aberta depois do
 * stop" — é sorteio com cara de fato. Um caso na base (Elza, 22/05, duas
 * entradas em MNQM6 às 11:37:15, importadas do mesmo CSV).
 *
 * @returns {{ reliable: boolean, reason: 'ok'|'single'|'missing_entry_time'|'mixed_offsets'|'tied_instants' }}
 */
export function orderingConfidence(trades) {
  const lista = Array.isArray(trades) ? trades : [];
  if (lista.length <= 1) return { reliable: true, reason: 'single' };

  const infos = lista.map((t) => tradeInstantInfo(t));
  if (infos.some((i) => i.source === 'date' || i.source === 'none')) {
    return { reliable: false, reason: 'missing_entry_time' };
  }
  // Misturar horário com offset e horário naive só é risco quando os fusos
  // RESOLVIDOS divergem. Se o naive foi inferido para o mesmo fuso dos demais,
  // a ordem relativa é tão sólida quanto seria com offset em todos — e recusar
  // afirmá-la seria conservadorismo sem lastro, do mesmo tipo que este issue
  // combate na direção oposta.
  const fusos = new Set(infos.map((i) => i.tz));
  if (fusos.size > 1) return { reliable: false, reason: 'mixed_offsets' };
  const instantes = infos.map((i) => i.ms);
  if (new Set(instantes).size < instantes.length) {
    return { reliable: false, reason: 'tied_instants' };
  }
  return { reliable: true, reason: 'ok' };
}
