// Apex Intraday 50K | DD=$2500 | Target=$3000 | 21 dias úteis | RR 1:2 | 50k iter
const DD = 2500, TARGET = 3000, DAYS = 21, RR = 2, ITER = 50000;
const WR_LIST = [0.40, 0.45, 0.50, 0.55, 0.60];

function simulate({ ro, maxTradesPerDay }, wr) {
  const win = ro * RR;
  let pass = 0, bust = 0;
  let sumDaysToPass = 0;
  for (let it = 0; it < ITER; it++) {
    let balance = 0, outcome = null;
    for (let d = 0; d < DAYS && outcome === null; d++) {
      for (let t = 0; t < maxTradesPerDay; t++) {
        balance += Math.random() < wr ? win : -ro;
        if (balance <= -DD) { outcome = 'bust'; break; }
        if (balance >= TARGET) { outcome = 'pass'; sumDaysToPass += (d + 1); break; }
      }
    }
    if (outcome === 'pass') pass++;
    else if (outcome === 'bust') bust++;
  }
  return {
    pass: (pass / ITER) * 100,
    bust: (bust / ITER) * 100,
    days: pass > 0 ? sumDaysToPass / pass : null,
  };
}

function table(label, variants) {
  console.log(`\n=== ${label} ===`);
  const header = `WR    | ${variants.map(v => v.label.padEnd(14)).join(' | ')}`;
  console.log(header);
  console.log('-'.repeat(header.length));
  console.log('PASS %');
  for (const wr of WR_LIST) {
    const cells = variants.map(v => simulate(v, wr).pass.toFixed(1).padStart(14));
    console.log(`${wr.toFixed(2)}  |${cells.join(' |')}`);
  }
  console.log('BUST %');
  for (const wr of WR_LIST) {
    const cells = variants.map(v => simulate(v, wr).bust.toFixed(1).padStart(14));
    console.log(`${wr.toFixed(2)}  |${cells.join(' |')}`);
  }
  console.log('DIAS p/ aprovar (média condicional)');
  for (const wr of WR_LIST) {
    const cells = variants.map(v => {
      const r = simulate(v, wr);
      return (r.days ? r.days.toFixed(1) : '   —   ').padStart(14);
    });
    console.log(`${wr.toFixed(2)}  |${cells.join(' |')}`);
  }
}

// Recorte 1: RO fixo $375 (15% DD), varia só maxTradesPerDay
table(
  'Recorte 1 — RO fixo $375/trade, varia trades/dia',
  [
    { label: '1 trade  $375', ro: 375, maxTradesPerDay: 1 },
    { label: '2 trades $375', ro: 375, maxTradesPerDay: 2 },
    { label: '3 trades $375', ro: 375, maxTradesPerDay: 3 },
  ]
);

// Recorte 2: Daily exposure fixo $750, varia split
table(
  'Recorte 2 — Daily exposure $750 fixo, varia split (CONS_B vs AGRES_B)',
  [
    { label: '1×$750 (AGRES_B)', ro: 750, maxTradesPerDay: 1 },
    { label: '2×$375 (CONS_B)', ro: 375, maxTradesPerDay: 2 },
    { label: '3×$250',          ro: 250, maxTradesPerDay: 3 },
  ]
);
