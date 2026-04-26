// Apex Intraday 50K | DD=$2500 | Target=$3000 | 21 dias úteis | RR 1:2 | 100k iter
const DD = 2500, TARGET = 3000, DAYS = 21, RR = 2, ITER = 100000;
const WR_LIST = [0.40, 0.45, 0.50, 0.55, 0.60];

// Estratégias de cadência:
//  - 'always-2': sempre tira 2 trades por dia (modelo ingênuo da sim anterior)
//  - 'stop-on-win': 1º win → para o dia; 1º loss → tira 2º (recovery). Padrão real CONS_B.
//  - 'stop-on-win-cap-1L': como stop-on-win, mas após 1 loss para o dia (sem recovery). Fica em 1 trade efetivo.
//  - 'one-trade': sempre 1 trade (AGRES_B / aluno disciplinado solo).
function simulate({ ro, strategy }, wr) {
  const win = ro * RR;
  let pass = 0, bust = 0;
  let sumDaysToPass = 0;
  let totalTrades = 0;

  for (let it = 0; it < ITER; it++) {
    let balance = 0, outcome = null;
    for (let d = 0; d < DAYS && outcome === null; d++) {
      // 1º trade
      const w1 = Math.random() < wr;
      balance += w1 ? win : -ro;
      totalTrades++;
      if (balance <= -DD) { outcome = 'bust'; break; }
      if (balance >= TARGET) { outcome = 'pass'; sumDaysToPass += (d + 1); break; }

      // Decisão sobre 2º trade
      let take2 = false;
      if (strategy === 'always-2') take2 = true;
      else if (strategy === 'stop-on-win') take2 = !w1;            // só após loss
      else if (strategy === 'stop-on-win-cap-1L') take2 = false;   // nunca tira 2º
      else if (strategy === 'one-trade') take2 = false;

      if (take2) {
        const w2 = Math.random() < wr;
        balance += w2 ? win : -ro;
        totalTrades++;
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
    avgTradesPerSim: totalTrades / ITER,
  };
}

function table(title, variants) {
  console.log(`\n=== ${title} ===`);
  const labels = variants.map(v => v.label.padEnd(22));
  console.log(`WR    | ${labels.join(' | ')}`);
  console.log('-'.repeat(8 + (24 * variants.length)));
  console.log('PASS %');
  for (const wr of WR_LIST) {
    console.log(`${wr.toFixed(2)}  | ${variants.map(v => simulate(v, wr).pass.toFixed(1).padStart(22)).join(' | ')}`);
  }
  console.log('BUST %');
  for (const wr of WR_LIST) {
    console.log(`${wr.toFixed(2)}  | ${variants.map(v => simulate(v, wr).bust.toFixed(1).padStart(22)).join(' | ')}`);
  }
  console.log('DIAS p/ aprovar (média condicional)');
  for (const wr of WR_LIST) {
    console.log(`${wr.toFixed(2)}  | ${variants.map(v => {
      const r = simulate(v, wr);
      return (r.days ? r.days.toFixed(1) : '   —   ').padStart(22);
    }).join(' | ')}`);
  }
  console.log('AVG TRADES por simulação');
  for (const wr of WR_LIST) {
    console.log(`${wr.toFixed(2)}  | ${variants.map(v => simulate(v, wr).avgTradesPerSim.toFixed(1).padStart(22)).join(' | ')}`);
  }
}

// CONS_B (RO $375, RR 1:2) sob diferentes comportamentos de cadência
table(
  'CONS_B ($375 RO) — comportamento real importa',
  [
    { label: 'always-2 (ingênuo)',   ro: 375, strategy: 'always-2' },
    { label: 'stop-win/recovery',    ro: 375, strategy: 'stop-on-win' },
    { label: '1 trade só (cap-1L)',  ro: 375, strategy: 'stop-on-win-cap-1L' },
  ]
);

// Comparação CONS_B real (stop-win) vs AGRES_B (1×$750)
table(
  'CONS_B real vs AGRES_B (mesmo daily exposure $750)',
  [
    { label: 'CONS_B stop-win',  ro: 375, strategy: 'stop-on-win' },
    { label: 'AGRES_B 1×$750',   ro: 750, strategy: 'one-trade' },
  ]
);
