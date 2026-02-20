/**
 * migrate-plan-currentPl.js
 * @description Migração única: calcula currentPl para todos os planos existentes
 *   currentPl = pl + soma(trades.result WHERE planId == planId)
 * 
 * EXECUÇÃO:
 *   cd functions
 *   node migrate-plan-currentPl.js
 * 
 * REQUISITOS:
 *   - Firebase Admin SDK configurado (usa credenciais do projeto)
 *   - Executar ANTES do deploy das novas Cloud Functions
 */

const admin = require('firebase-admin');

// Inicializa com credenciais do projeto (usa GOOGLE_APPLICATION_CREDENTIALS ou default)
admin.initializeApp();
const db = admin.firestore();

async function migrate() {
  console.log('=== MIGRAÇÃO: Plan currentPl ===\n');
  
  const plansSnapshot = await db.collection('plans').get();
  console.log(`Planos encontrados: ${plansSnapshot.size}\n`);
  
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const planDoc of plansSnapshot.docs) {
    const plan = planDoc.data();
    const planId = planDoc.id;
    const basePl = plan.pl || 0;
    
    try {
      // Buscar trades vinculados ao plano
      const tradesSnapshot = await db.collection('trades')
        .where('planId', '==', planId)
        .get();
      
      // Somar resultados
      let totalResult = 0;
      tradesSnapshot.forEach(tradeDoc => {
        totalResult += (tradeDoc.data().result || 0);
      });
      
      const currentPl = basePl + totalResult;
      
      // Verificar se já tem currentPl
      if (plan.currentPl !== undefined && Math.abs(plan.currentPl - currentPl) < 0.01) {
        console.log(`  [SKIP] ${plan.name || planId}: currentPl já correto (${currentPl})`);
        skipped++;
        continue;
      }
      
      // Atualizar
      await planDoc.ref.update({
        currentPl,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`  [OK] ${plan.name || planId}: pl=${basePl}, trades=${tradesSnapshot.size}, totalResult=${totalResult.toFixed(2)}, currentPl=${currentPl.toFixed(2)}`);
      updated++;
      
    } catch (err) {
      console.error(`  [ERRO] ${plan.name || planId}: ${err.message}`);
      errors++;
    }
  }
  
  console.log(`\n=== RESULTADO ===`);
  console.log(`Atualizados: ${updated}`);
  console.log(`Já corretos: ${skipped}`);
  console.log(`Erros: ${errors}`);
  console.log(`Total: ${plansSnapshot.size}`);
  
  process.exit(errors > 0 ? 1 : 0);
}

migrate().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
