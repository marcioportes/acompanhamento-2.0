/**
 * migrate-trade-status.js
 * @version 1.2.0
 * @description Migra status legados para o novo padrão
 * 
 * EXECUÇÃO:
 * cd functions
 * node migrate-trade-status.js
 * 
 * MIGRAÇÕES:
 * - PENDING_REVIEW → OPEN
 * - IN_REVISION → QUESTION
 */

const admin = require('firebase-admin');

// Inicializa com credenciais do projeto
admin.initializeApp();
const db = admin.firestore();

async function migrateBatch(querySnapshot, newStatus, oldStatus) {
  if (querySnapshot.empty) {
    console.log(`  Nenhum trade com status '${oldStatus}'`);
    return 0;
  }

  const docs = querySnapshot.docs;
  let migrated = 0;

  // Firestore batch limit = 500
  for (let i = 0; i < docs.length; i += 500) {
    const batch = db.batch();
    const chunk = docs.slice(i, i + 500);

    chunk.forEach(doc => {
      batch.update(doc.ref, {
        status: newStatus,
        _migratedAt: admin.firestore.FieldValue.serverTimestamp(),
        _migratedFrom: oldStatus
      });
    });

    await batch.commit();
    migrated += chunk.length;
    console.log(`  Migrados ${migrated}/${docs.length}...`);
  }

  return migrated;
}

async function migrate() {
  console.log('═══════════════════════════════════════════');
  console.log('  MIGRAÇÃO DE STATUS DOS TRADES v1.2.0');
  console.log('═══════════════════════════════════════════\n');

  let totalMigrated = 0;

  // 1. PENDING_REVIEW → OPEN
  console.log('[1/2] Migrando PENDING_REVIEW → OPEN...');
  const pendingSnapshot = await db.collection('trades')
    .where('status', '==', 'PENDING_REVIEW')
    .get();
  
  const pendingCount = await migrateBatch(pendingSnapshot, 'OPEN', 'PENDING_REVIEW');
  totalMigrated += pendingCount;

  // 2. IN_REVISION → QUESTION
  console.log('\n[2/2] Migrando IN_REVISION → QUESTION...');
  const revisionSnapshot = await db.collection('trades')
    .where('status', '==', 'IN_REVISION')
    .get();
  
  const revisionCount = await migrateBatch(revisionSnapshot, 'QUESTION', 'IN_REVISION');
  totalMigrated += revisionCount;

  // Resumo
  console.log('\n═══════════════════════════════════════════');
  console.log(`  ✅ MIGRAÇÃO CONCLUÍDA`);
  console.log(`  Total migrados: ${totalMigrated} trades`);
  console.log('═══════════════════════════════════════════\n');

  // Verificação
  console.log('Verificando status atuais...');
  const stats = {};
  const allTrades = await db.collection('trades').get();
  allTrades.forEach(doc => {
    const status = doc.data().status || 'NULL';
    stats[status] = (stats[status] || 0) + 1;
  });
  console.log('Distribuição de status:', stats);
}

migrate()
  .then(() => {
    console.log('\nScript finalizado com sucesso.');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ ERRO:', err);
    process.exit(1);
  });
