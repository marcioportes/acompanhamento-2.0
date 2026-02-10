# 🚀 Guia de Deploy - Acompanhamento 2.0

## Visão Geral

O sistema usa duas plataformas:
- **Frontend**: Vercel (deploy automático via git push)
- **Backend**: Firebase Functions (deploy manual)

---

## 📋 Pré-requisitos

### 1. Instalar Firebase CLI
```bash
npm install -g firebase-tools
```

### 2. Fazer login no Firebase
```bash
firebase login
```
Isso abrirá o navegador para autenticação.

### 3. Verificar projeto conectado
```bash
firebase projects:list
```
Deve mostrar `acompanhamento-20`.

---

## 🔧 Setup Inicial (apenas primeira vez)

### 1. Clonar repositório
```bash
git clone https://github.com/marcioportes/acompanhamento-2.0.git
cd acompanhamento-2.0
```

### 2. Instalar dependências do frontend
```bash
npm install
```

### 3. Instalar dependências das functions
```bash
cd functions
npm install
cd ..
```

### 4. Configurar projeto Firebase
```bash
firebase use acompanhamento-20
```

---

## 🚀 Deploy

### Deploy do Frontend (Vercel)
```bash
git add .
git commit -m "sua mensagem"
git push
```
O Vercel faz deploy automático quando detecta push no main.

### Deploy das Functions (Firebase)
```bash
firebase deploy --only functions
```

### Deploy das Regras do Firestore
```bash
firebase deploy --only firestore:rules
```

### Deploy dos Índices do Firestore
```bash
firebase deploy --only firestore:indexes
```

### Deploy das Regras do Storage
```bash
firebase deploy --only storage
```

### Deploy completo do Firebase
```bash
firebase deploy
```

---

## 📊 Popular Dados Iniciais (Seed)

### Opção 1: Via Console do Navegador
1. Acesse https://acompanhamento-20.firebaseapp.com
2. Faça login como mentor (marcio.portes@me.com)
3. Abra o Console do navegador (F12)
4. Execute:
```javascript
import('/src/utils/seedData.js').then(m => m.runSeed())
```

### Opção 2: Via Firebase Console
1. Acesse https://console.firebase.google.com
2. Selecione projeto `acompanhamento-20`
3. Vá em Functions
4. Execute a função `seedInitialData` manualmente

---

## 🔍 Monitoramento

### Ver logs das Functions
```bash
firebase functions:log
```

### Ver logs em tempo real
```bash
firebase functions:log --follow
```

### Acessar Firebase Console
- Firestore: https://console.firebase.google.com/project/acompanhamento-20/firestore
- Functions: https://console.firebase.google.com/project/acompanhamento-20/functions
- Storage: https://console.firebase.google.com/project/acompanhamento-20/storage

---

## 🧪 Desenvolvimento Local

### Iniciar emuladores Firebase
```bash
firebase emulators:start
```

### Iniciar frontend em modo dev
```bash
npm run dev
```

### Testar functions localmente
```bash
cd functions
npm run serve
```

---

## 📁 Estrutura do Projeto

```
acompanhamento-2.0/
├── functions/              # Firebase Cloud Functions
│   ├── index.js           # Triggers e lógica de negócio
│   └── package.json
├── src/                    # Frontend React
│   ├── components/        # Componentes UI
│   ├── contexts/          # Contextos (Auth, Data)
│   ├── hooks/             # Hooks customizados
│   ├── pages/             # Páginas principais
│   ├── utils/             # Utilitários
│   └── constants/         # Constantes do sistema
├── firebase.json          # Configuração Firebase
├── firestore.rules        # Regras de segurança Firestore
├── firestore.indexes.json # Índices do Firestore
├── storage.rules          # Regras de segurança Storage
└── vercel.json            # Configuração Vercel
```

---

## ⚠️ Troubleshooting

### Erro: "Permission denied" no Firestore
- Verifique se as regras foram deployadas: `firebase deploy --only firestore:rules`

### Erro: "Function not found"
- Verifique se as functions foram deployadas: `firebase deploy --only functions`

### Erro de CORS
- As functions já estão configuradas para aceitar requests do domínio do Vercel

### Cold start lento
- Normal na primeira requisição após inatividade
- Functions ficam "quentes" com uso contínuo

---

## 📞 Suporte

- GitHub Issues: https://github.com/marcioportes/acompanhamento-2.0/issues
- Firebase Docs: https://firebase.google.com/docs
