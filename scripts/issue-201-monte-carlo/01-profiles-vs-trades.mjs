// Monte Carlo: 1 vs 2 trades/dia em Apex Intraday 50K, RR fixo 1:2
// drawdown $2500, profit target $3000, 21 dias úteis (eval 30 calendar)

const PROFILES = [
  { code: 'CONS_A', roPct: 0.10, maxTradesPerDay: 2 },
  { code: 'CONS_B', roPct: 0.15, maxTradesPerDay: 2 },
  { code: 'CONS_C', roPct: 0.20, maxTradesPerDay: 2 },
  { code: 'AGRES_A', roPct: 0.25, maxTradesPerDay: 1 },
  { code: 'AGRES_B', roPct: 0.30, maxTradesPerDay: 1 },
];

const DD = 2500;
const TARGET = 3000;
const DAYS = 21;
const RR = 2;
const ITER = 50000;
const WR_LIST = [0.40, 0.45, 0.50, 0.55, 0.60];

function simulate(profile, wr) {
  const ro = DD * profile.roPct;
  const win = ro * RR;
  let pass = 0, bust = 0, timeOut = 0;
  let sumDaysToPass = 0;

  for (let it = 0; it < ITER; it++) {
    let balance = 0;
    let outcome = null;
    for (let d = 0; d < DAYS && outcome === null; d++) {
      for (let t = 0; t < profile.maxTradesPerDay; t++) {
        const w = Math.random() < wr;
        balance += w ? win : -ro;
        if (balance <= -DD) { outcome = 'bust'; break; }
        if (balance >= TARGET) { outcome = 'pass'; sumDaysToPass += (d + 1); break; }
      }
    }
    if (outcome === 'pass') pass++;
    else if (outcome === 'bust') bust++;
    else timeOut++;
  }
  return {
    passPct: (pass / ITER) * 100,
    bustPct: (bust / ITER) * 100,
    timeOutPct: (timeOut / ITER) * 100,
    avgDays: pass > 0 ? (sumDaysToPass / pass) : null,
  };
}

console.log(`\nApex Intraday 50K | DD=$${DD} | Target=$${TARGET} | ${DAYS} dias | RR ${RR}:1 | ${ITER.toLocaleString()} iter\n`);

const header = `WR    | ${PROFILES.map(p => p.code.padEnd(7)).join(' | ')}`;
console.log(header);
console.log('-'.repeat(header.length));

console.log('\n>>> APROVAÇÃO % (PASS) <<<');
for (const wr of WR_LIST) {
  const cells = PROFILES.map(p => simulate(p, wr).passPct.toFixed(1).padStart(7));
  console.log(`${wr.toFixed(2)}  | ${cells.join(' | ')}`);
}

console.log('\n>>> BUST % <<<');
for (const wr of WR_LIST) {
  const cells = PROFILES.map(p => simulate(p, wr).bustPct.toFixed(1).padStart(7));
  console.log(`${wr.toFixed(2)}  | ${cells.join(' | ')}`);
}

console.log('\n>>> DIAS MÉDIOS PARA APROVAR (entre os que aprovaram) <<<');
for (const wr of WR_LIST) {
  const cells = PROFILES.map(p => {
    const r = simulate(p, wr);
    return (r.avgDays ? r.avgDays.toFixed(1) : '  —  ').padStart(7);
  });
  console.log(`${wr.toFixed(2)}  | ${cells.join(' | ')}`);
}

console.log('\nLegenda: 1 trade/dia = AGRES_A (RO 25%) e AGRES_B (RO 30%) | 2 trades/dia = CONS_A/B/C\n');
