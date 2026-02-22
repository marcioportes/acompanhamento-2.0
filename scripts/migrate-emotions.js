/**
 * Script de Migração - Sistema Emocional v2.0
 * @version 1.3.1
 * @description Adiciona campos de análise às 14 emoções existentes no Firestore
 * 
 * CAMPOS ADICIONADOS:
 * - score: number (-4 a +3) → peso da emoção na análise
 * - analysisCategory: string (POSITIVE|NEUTRAL|NEGATIVE|CRITICAL) → categoria para análise
 * - behavioralPattern: string → padrão comportamental identificado
 * - riskLevel: string (LOW|MEDIUM|HIGH|CRITICAL) → nível de risco
 * - description: string → descrição para tooltips
 * - order: number → ordem de exibição no dropdown
 * 
 * EXECUÇÃO:
 *   node scripts/migrate-emotions.js          # Dry-run (preview)
 *   node scripts/migrate-emotions.js --apply  # Aplica no Firestore
 * 
 * PRÉ-REQUISITOS:
 *   - Firebase Admin SDK configurado
 *   - serviceAccountKey.json na raiz do projeto (ou variável GOOGLE_APPLICATION_CREDENTIALS)
 * 
 * SEGURANÇA:
 *   - Campos novos são ADITIVOS (não altera campos existentes)
 *   - Código atual ignora campos novos (backward compatible)
 *   - Rollback: deletar campos novos (Firestore console ou script reverso)
 */

const admin = require('firebase-admin');

// ============================================
// INICIALIZAÇÃO FIREBASE
// ============================================

// Opção 1: Service Account Key (local)
// const serviceAccount = require('../serviceAccountKey.json');
// admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

// Opção 2: Default credentials (Cloud Functions / CI)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// ============================================
// MAPEAMENTO DE MIGRAÇÃO
// ============================================

/**
 * Mapeamento completo das 14 emoções existentes
 * Chave = Document ID no Firestore
 */
const EMOTION_MIGRATION_MAP = {
  'JQNOc1TY9L9XHOHFZyav': {
    name: 'Disciplinado',
    score: 3,
    analysisCategory: 'POSITIVE',
    behavioralPattern: 'DISCIPLINE',
    riskLevel: 'LOW',
    description: 'Seguiu o plano de trading rigorosamente',
    order: 1
  },
  'WW5N54E4VI2ModWmmyjv': {
    name: 'Calmo',
    score: 2,
    analysisCategory: 'POSITIVE',
    behavioralPattern: 'CALM',
    riskLevel: 'LOW',
    description: 'Operou com tranquilidade e controle emocional',
    order: 2
  },
  'se5IPUT6Gk77FPj2dxeL': {
    name: 'Confiante',
    score: 2,
    analysisCategory: 'POSITIVE',
    behavioralPattern: 'CONFIDENCE',
    riskLevel: 'MEDIUM',
    description: 'Confiança adequada baseada em análise',
    order: 3
  },
  'SeN1QAEOucD5YOXY9HhZ': {
    name: 'Neutro',
    score: 0,
    analysisCategory: 'NEUTRAL',
    behavioralPattern: 'NEUTRAL',
    riskLevel: 'MEDIUM',
    description: 'Estado emocional neutro, sem viés',
    order: 4
  },
  'inh9DEcBCeVZ36TiI9aS': {
    name: 'Aliviado',
    score: 0,
    analysisCategory: 'NEUTRAL',
    behavioralPattern: 'RELIEF',
    riskLevel: 'MEDIUM',
    description: 'Alívio após situação de pressão',
    order: 5
  },
  '9lfKHsjJikCvRF1ALkLK': {
    name: 'Ansioso',
    score: -1,
    analysisCategory: 'NEGATIVE',
    behavioralPattern: 'ANXIETY',
    riskLevel: 'HIGH',
    description: 'Ansiedade antes ou durante a operação',
    order: 6
  },
  '4jqH7wFhTY0TpX31uNL1': {
    name: 'Medo',
    score: -2,
    analysisCategory: 'NEGATIVE',
    behavioralPattern: 'FEAR',
    riskLevel: 'HIGH',
    description: 'Medo de perda influenciando decisões',
    order: 7
  },
  'maxrsSYDtu6b72jdnhJi': {
    name: 'Frustrado',
    score: -2,
    analysisCategory: 'NEGATIVE',
    behavioralPattern: 'FRUSTRATION',
    riskLevel: 'HIGH',
    description: 'Frustração com resultado ou mercado',
    order: 8
  },
  'EXB9zW6hla7SbvKAfuAB': {
    name: 'Esgotado',
    score: -2,
    analysisCategory: 'NEGATIVE',
    behavioralPattern: 'FATIGUE',
    riskLevel: 'HIGH',
    description: 'Fadiga mental afetando capacidade de decisão',
    order: 9
  },
  '7QY8PdoPntByV6TMNXhK': {
    name: 'Raiva',
    score: -2,
    analysisCategory: 'NEGATIVE',
    behavioralPattern: 'ANGER',
    riskLevel: 'HIGH',
    description: 'Raiva do mercado ou de si mesmo',
    order: 10
  },
  'CnnVzTYJKrLBCt3qL8Ya': {
    name: 'Eufórico',
    score: -2,
    analysisCategory: 'NEGATIVE',
    behavioralPattern: 'EUPHORIA',
    riskLevel: 'HIGH',
    description: 'Euforia excessiva, pode levar a overtrading',
    order: 11
  },
  'ygGBUxbXQaQQKBwORXmR': {
    name: 'Ganância',
    score: -3,
    analysisCategory: 'CRITICAL',
    behavioralPattern: 'GREED',
    riskLevel: 'CRITICAL',
    description: 'Ganância: querer mais após atingir meta',
    order: 12
  },
  'KgscCYGAMJAhX9Ri7ERG': {
    name: 'FOMO',
    score: -3,
    analysisCategory: 'CRITICAL',
    behavioralPattern: 'FOMO',
    riskLevel: 'CRITICAL',
    description: 'Fear Of Missing Out: medo de perder oportunidade',
    order: 13
  },
  'z1IPtUZrCuZuTlWu0nEt': {
    name: 'Revanche',
    score: -4,
    analysisCategory: 'CRITICAL',
    behavioralPattern: 'REVENGE',
    riskLevel: 'CRITICAL',
    description: 'Revanche: tentando recuperar loss imediatamente',
    order: 14
  }
};

// ============================================
// FUNÇÕES DE MIGRAÇÃO
// ============================================

/**
 * Preview: mostra o que será alterado sem aplicar
 */
async function dryRun() {
  console.log('\n🔍 DRY-RUN: Preview da migração\n');
  console.log('=' .repeat(80));

  const emotionsRef = db.collection('emotions');
  const snapshot = await emotionsRef.get();

  let found = 0;
  let notFound = 0;
  let alreadyMigrated = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const migration = EMOTION_MIGRATION_MAP[doc.id];

    if (!migration) {
      console.log(`⚠️  [${doc.id}] "${data.name}" - SEM MAPEAMENTO (será ignorado)`);
      notFound++;
      continue;
    }

    // Verificar se já foi migrado
    if (data.score !== undefined && data.analysisCategory !== undefined) {
      console.log(`✅ [${doc.id}] "${data.name}" - JÁ MIGRADO (score: ${data.score}, cat: ${data.analysisCategory})`);
      alreadyMigrated++;
      continue;
    }

    console.log(`📝 [${doc.id}] "${data.name}" → score: ${migration.score}, cat: ${migration.analysisCategory}, pattern: ${migration.behavioralPattern}, risk: ${migration.riskLevel}, order: ${migration.order}`);
    found++;
  }

  // Verificar IDs mapeados que não existem no Firestore
  const existingIds = snapshot.docs.map(d => d.id);
  const mappedIds = Object.keys(EMOTION_MIGRATION_MAP);
  const missing = mappedIds.filter(id => !existingIds.includes(id));

  if (missing.length > 0) {
    console.log('\n⚠️  IDs no mapeamento que NÃO existem no Firestore:');
    missing.forEach(id => {
      console.log(`   - ${id} (${EMOTION_MIGRATION_MAP[id].name})`);
    });
  }

  console.log('\n' + '=' .repeat(80));
  console.log(`📊 RESUMO:`);
  console.log(`   Total no Firestore: ${snapshot.size}`);
  console.log(`   A migrar: ${found}`);
  console.log(`   Já migrados: ${alreadyMigrated}`);
  console.log(`   Sem mapeamento: ${notFound}`);
  console.log(`   IDs faltantes: ${missing.length}`);
  console.log('\n💡 Execute com --apply para aplicar as mudanças\n');

  return { found, alreadyMigrated, notFound, missing: missing.length };
}

/**
 * Aplica a migração no Firestore usando batch write
 */
async function applyMigration() {
  console.log('\n🚀 APLICANDO MIGRAÇÃO...\n');

  const emotionsRef = db.collection('emotions');
  const snapshot = await emotionsRef.get();
  const batch = db.batch();
  let count = 0;
  let skipped = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const migration = EMOTION_MIGRATION_MAP[docSnap.id];

    if (!migration) {
      console.log(`⏭️  "${data.name}" - sem mapeamento, ignorado`);
      skipped++;
      continue;
    }

    // Verificar se já foi migrado
    if (data.score !== undefined && data.analysisCategory !== undefined) {
      console.log(`⏭️  "${data.name}" - já migrado, ignorado`);
      skipped++;
      continue;
    }

    // Adicionar campos novos (NÃO sobrescreve campos existentes)
    const updateData = {
      score: migration.score,
      analysisCategory: migration.analysisCategory,
      behavioralPattern: migration.behavioralPattern,
      riskLevel: migration.riskLevel,
      description: migration.description,
      order: migration.order,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    batch.update(docSnap.ref, updateData);
    console.log(`✅ "${data.name}" → score: ${migration.score}, cat: ${migration.analysisCategory}`);
    count++;
  }

  if (count > 0) {
    await batch.commit();
    console.log(`\n🎉 Migração concluída! ${count} documentos atualizados, ${skipped} ignorados.`);
  } else {
    console.log('\n✅ Nada para migrar - todos os documentos já estão atualizados.');
  }

  return { migrated: count, skipped };
}

/**
 * Rollback: remove campos adicionados pela migração
 */
async function rollback() {
  console.log('\n⏪ ROLLBACK: Removendo campos de migração...\n');

  const emotionsRef = db.collection('emotions');
  const snapshot = await emotionsRef.get();
  const batch = db.batch();
  let count = 0;

  const fieldsToRemove = {
    score: admin.firestore.FieldValue.delete(),
    analysisCategory: admin.firestore.FieldValue.delete(),
    behavioralPattern: admin.firestore.FieldValue.delete(),
    riskLevel: admin.firestore.FieldValue.delete(),
    description: admin.firestore.FieldValue.delete(),
    order: admin.firestore.FieldValue.delete(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    if (data.score !== undefined || data.analysisCategory !== undefined) {
      batch.update(docSnap.ref, fieldsToRemove);
      console.log(`🗑️  "${data.name}" - campos removidos`);
      count++;
    }
  }

  if (count > 0) {
    await batch.commit();
    console.log(`\n✅ Rollback concluído! ${count} documentos restaurados.`);
  } else {
    console.log('\n✅ Nada para reverter.');
  }

  return { rolledBack: count };
}

// ============================================
// EXECUÇÃO
// ============================================

async function main() {
  const args = process.argv.slice(2);

  try {
    if (args.includes('--apply')) {
      await applyMigration();
    } else if (args.includes('--rollback')) {
      await rollback();
    } else {
      await dryRun();
    }
  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

main();
