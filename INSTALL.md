# 🚀 Guia de Instalação - Acompanhamento 2.0

## 📋 Pré-requisitos

Antes de começar, você precisa ter instalado:

- **Node.js** (versão 18 ou superior) - [Download](https://nodejs.org/)
- **Git** - [Download](https://git-scm.com/)
- **Conta Google** (para Firebase)

---

## 📦 PASSO 1: Instalar Firebase CLI

Abra o terminal (PowerShell no Windows ou Terminal no Mac) e execute:

```bash
npm install -g firebase-tools
```

Verifique se instalou corretamente:
```bash
firebase --version
```
Deve mostrar algo como `13.x.x`

---

## 🔐 PASSO 2: Fazer Login no Firebase

```bash
firebase login
```

Isso vai abrir o navegador. Faça login com sua conta Google (a mesma do projeto Firebase).

---

## 📂 PASSO 3: Preparar o Projeto

### Opção A: Se você já tem o repositório clonado

1. Extraia o ZIP `acompanhamento-2.0-arquitetura-v2.zip` 
2. Copie **TODOS** os arquivos extraídos para dentro da pasta do seu repositório
3. Substitua os arquivos quando perguntado

### Opção B: Se vai começar do zero

```bash
# Clonar repositório
git clone https://github.com/marcioportes/acompanhamento-2.0.git
cd acompanhamento-2.0

# Extrair o ZIP na pasta (substitua pelo caminho correto)
# No Windows: Extraia manualmente o ZIP para esta pasta
# No Mac/Linux: unzip /caminho/para/acompanhamento-2.0-arquitetura-v2.zip -d .
```

---

## 📦 PASSO 4: Instalar Dependências

### 4.1 Dependências do Frontend
```bash
cd acompanhamento-2.0
npm install
```

### 4.2 Dependências das Functions
```bash
cd functions
npm install
cd ..
```

---

## 🔗 PASSO 5: Conectar ao Projeto Firebase

```bash
firebase use acompanhamento-20
```

Se der erro, execute:
```bash
firebase use --add
```
E selecione `acompanhamento-20` na lista.

---

## 🚀 PASSO 6: Deploy das Functions

### 6.1 Deploy das regras do Firestore
```bash
firebase deploy --only firestore:rules
```

### 6.2 Deploy dos índices do Firestore
```bash
firebase deploy --only firestore:indexes
```

### 6.3 Deploy das regras do Storage
```bash
firebase deploy --only storage
```

### 6.4 Deploy das Cloud Functions
```bash
firebase deploy --only functions
```

**⚠️ IMPORTANTE:** O primeiro deploy das functions pode demorar 2-3 minutos.

### 6.5 Ou deploy tudo de uma vez
```bash
firebase deploy
```

---

## 🌱 PASSO 7: Popular Dados Iniciais (Seed)

Após o deploy, você precisa popular as tabelas com dados iniciais (moedas, corretoras, tickers, etc).

### Opção A: Via Console do Firebase (Recomendado)

1. Acesse: https://console.firebase.google.com/project/acompanhamento-20/functions
2. Clique na função `seedInitialData`
3. Clique em "Test in Cloud Shell" ou chame via URL

### Opção B: Via Navegador (após frontend estar rodando)

1. Acesse o site: https://acompanhamento-20.firebaseapp.com
2. Faça login como mentor (marcio.portes@me.com)
3. Abra o Console do navegador (F12 → Console)
4. Cole e execute:
```javascript
// Importar e executar o seed
const { runSeed } = await import('./src/utils/seedData.js');
await runSeed();
```

### Opção C: Via Código (adicione temporariamente ao App.jsx)

```javascript
// No início do App.jsx, adicione:
import { runSeed } from './utils/seedData';

// Dentro do componente, chame uma vez:
useEffect(() => {
  runSeed().then(console.log);
}, []);
```

---

## ✅ PASSO 8: Verificar Instalação

### 8.1 Verificar Functions
Acesse no navegador:
```
https://us-central1-acompanhamento-20.cloudfunctions.net/healthCheck
```

Deve retornar:
```json
{
  "status": "ok",
  "timestamp": "...",
  "version": "2.0.0"
}
```

### 8.2 Verificar Dados no Firestore
1. Acesse: https://console.firebase.google.com/project/acompanhamento-20/firestore
2. Verifique se existem as collections:
   - `currencies` (3 documentos: BRL, USD, EUR)
   - `brokers` (12 documentos)
   - `tickers` (14 documentos)
   - `exchanges` (5 documentos)
   - `setups` (12 documentos)
   - `emotions` (16 documentos)

---

## 🖥️ PASSO 9: Deploy do Frontend

O frontend faz deploy automático via Vercel quando você faz push.

```bash
git add .
git commit -m "feat: nova arquitetura v2 com Firebase Functions"
git push
```

Aguarde 1-2 minutos e acesse:
- https://acompanhamento-20.firebaseapp.com
- ou https://acompanhamento-2-0.vercel.app (se configurado)

---

## 🔧 Comandos Úteis

| Comando | Descrição |
|---------|-----------|
| `firebase deploy` | Deploy completo |
| `firebase deploy --only functions` | Apenas functions |
| `firebase deploy --only firestore` | Apenas regras/índices |
| `firebase functions:log` | Ver logs |
| `firebase functions:log --follow` | Logs em tempo real |
| `firebase emulators:start` | Rodar localmente |
| `npm run dev` | Frontend em modo dev |

---

## ❓ Problemas Comuns

### "Permission denied" ao fazer deploy
```bash
firebase logout
firebase login
```

### "Project not found"
```bash
firebase projects:list
firebase use acompanhamento-20
```

### Functions não aparecem no Console
Aguarde 2-3 minutos após o deploy. Verifique os logs:
```bash
firebase functions:log
```

### Erro no seed "Already seeded"
Os dados já foram populados. Se quiser forçar:
```javascript
import { forceSeed } from './src/utils/seedData.js';
await forceSeed();
```

### Erro de billing no Firebase
Cloud Functions requer plano Blaze (pay as you go). 
- Acesse: https://console.firebase.google.com/project/acompanhamento-20/usage/details
- Ative o plano Blaze
- **Custo:** Gratuito até 2M invocações/mês (seu uso será ~22K/mês)

---

## 📞 Suporte

Se tiver problemas:
1. Verifique os logs: `firebase functions:log`
2. Abra uma issue: https://github.com/marcioportes/acompanhamento-2.0/issues

---

## ✅ Checklist Final

- [ ] Firebase CLI instalado
- [ ] Login no Firebase feito
- [ ] Dependências do frontend instaladas (`npm install`)
- [ ] Dependências das functions instaladas (`cd functions && npm install`)
- [ ] Projeto conectado (`firebase use acompanhamento-20`)
- [ ] Regras deployadas (`firebase deploy --only firestore,storage`)
- [ ] Functions deployadas (`firebase deploy --only functions`)
- [ ] Dados iniciais populados (seed)
- [ ] Health check funcionando
- [ ] Frontend deployado (git push)
