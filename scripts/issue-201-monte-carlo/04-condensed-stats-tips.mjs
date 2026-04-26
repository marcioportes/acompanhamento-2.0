// Stats CONDENSADOS por perfil — comportamento real (stop-on-win, recovery on loss)
// Base: Apex Intraday 50K | DD=$2500 | Target=$3000 | 21d | RR 1:2 | 100k iter
const DD = 2500, TARGET = 3000, DAYS = 21, RR = 2, ITER = 100000;
const PROFILES = [
  { code: 'CONS_A', roPct: 0.10, max: 2 },
  { code: 'CONS_B', roPct: 0.15, max: 2 },
  { code: 'CONS_C', roPct: 0.20, max: 2 },
  { code: 'AGRES_A', roPct: 0.25, max: 1 },
  { code: 'AGRES_B', roPct: 0.30, max: 1 },
];

function sim(p, wr) {
  const ro = DD * p.roPct, win = ro * RR;
  let pass = 0, bust = 0, sumDays = 0;
  for (let i = 0; i < ITER; i++) {
    let bal = 0, out = null;
    for (let d = 0; d < DAYS && out === null; d++) {
      const w1 = Math.random() < wr;
      bal += w1 ? win : -ro;
      if (bal <= -DD) { out = 'bust'; break; }
      if (bal >= TARGET) { out = 'pass'; sumDays += (d + 1); break; }
      // 2º trade: só se conservador (max=2) E perdeu o 1º
      if (p.max === 2 && !w1) {
        const w2 = Math.random() < wr;
        bal += w2 ? win : -ro;
        if (bal <= -DD) { out = 'bust'; break; }
        if (bal >= TARGET) { out = 'pass'; sumDays += (d + 1); break; }
      }
    }
    if (out === 'pass') pass++;
    else if (out === 'bust') bust++;
  }
  return {
    pass: (pass / ITER) * 100,
    bust: (bust / ITER) * 100,
    days: pass > 0 ? sumDays / pass : null,
  };
}

console.log('Perfil    | WR45  PASS/BUST/D   | WR50  PASS/BUST/D   | WR55  PASS/BUST/D');
console.log('-'.repeat(80));
for (const p of PROFILES) {
  const cells = [0.45, 0.50, 0.55].map(wr => {
    const r = sim(p, wr);
    return `${r.pass.toFixed(0).padStart(3)}/${r.bust.toFixed(1).padStart(4)}/${r.days?.toFixed(1).padStart(4)}`;
  });
  console.log(`${p.code.padEnd(9)} | ${cells.join(' | ')}`);
}
