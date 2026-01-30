# 📊 Acompanhamento 2.0 - Trading Journal

Sistema completo de Trading Journal para mentoria, com segregação de dados entre mentor e alunos, upload de imagens HTF/LTF, e análises avançadas.

![Trading Journal](https://img.shields.io/badge/Trading-Journal-blue)
![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react)
![Firebase](https://img.shields.io/badge/Firebase-Firestore-FFCA28?logo=firebase)
![Tailwind](https://img.shields.io/badge/Tailwind-CSS-38B2AC?logo=tailwindcss)

## ✨ Funcionalidades

### Para Alunos
- 📈 Dashboard com KPIs principais (P&L, Win Rate, Profit Factor)
- 📅 Calendário heatmap de trades
- 📊 Análise por Setup e Estado Emocional
- 📸 Upload obrigatório de gráficos HTF/LTF
- 📈 Curva de Capital (Equity Curve)
- 🔍 Filtros avançados por período, setup, emoção, etc.
- 💬 Visualização de feedback do mentor

### Para o Mentor
- 👥 Visão geral de todos os alunos
- 🏆 Ranking de alunos por performance
- ⚠️ Lista de alunos que precisam de atenção
- 💬 Sistema de feedback em cada trade
- 📊 Análises consolidadas da turma
- 📋 Trades aguardando feedback

## 🚀 Deploy no Vercel

### Pré-requisitos
- Conta no [Vercel](https://vercel.com)
- Conta no [GitHub](https://github.com)
- Projeto Firebase já configurado

### Passo a Passo

#### 1. Criar repositório no GitHub

```bash
# Clone ou faça upload do projeto para um novo repositório
git init
git add .
git commit -m "Initial commit - Acompanhamento 2.0"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/acompanhamento-2.0.git
git push -u origin main
```

#### 2. Conectar ao Vercel

1. Acesse [vercel.com](https://vercel.com) e faça login
2. Clique em **"Add New..."** → **"Project"**
3. Selecione o repositório `acompanhamento-2.0`
4. As configurações serão detectadas automaticamente:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
5. Clique em **"Deploy"**

#### 3. Configurar Domínio (Opcional)

1. No dashboard do Vercel, vá em **Settings** → **Domains**
2. Adicione seu domínio personalizado
3. Configure o DNS conforme instruções

## 🔧 Configuração Local

### Instalar dependências

```bash
npm install
```

### Executar em desenvolvimento

```bash
npm run dev
```

O app estará disponível em `http://localhost:5173`

### Build de produção

```bash
npm run build
npm run preview
```

## 🔥 Configuração do Firebase

O projeto já está configurado com as seguintes credenciais:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyA4bILzUTtkZvkOLz3B_EzYKFwrw0xygfc",
  authDomain: "acompanhamento-20.firebaseapp.com",
  projectId: "acompanhamento-20",
  storageBucket: "acompanhamento-20.firebasestorage.app",
  messagingSenderId: "761679940146",
  appId: "1:761679940146:web:1bae12ce93456c62238a2b"
};
```

### Regras do Firestore

Certifique-se de que as regras do Firestore estão configuradas:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /trades/{tradeId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && 
        (resource.data.studentId == request.auth.uid || 
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'mentor');
    }
  }
}
```

### Regras do Storage

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /trades/{tradeId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

## 👥 Usuários do Sistema

### Mentor
- **Email:** marcio.portes@me.com
- **Senha:** (definida pelo usuário)

### Alunos de Teste
| Email | Senha |
|-------|-------|
| aluno1@teste.com | 123456 |
| aluno2@teste.com | 123456 |
| aluno3@teste.com | 123456 |

## 📁 Estrutura do Projeto

```
acompanhamento-2.0/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── AddTradeModal.jsx
│   │   ├── CalendarHeatmap.jsx
│   │   ├── EmotionAnalysis.jsx
│   │   ├── EquityCurve.jsx
│   │   ├── Filters.jsx
│   │   ├── Loading.jsx
│   │   ├── SetupAnalysis.jsx
│   │   ├── Sidebar.jsx
│   │   ├── StatCard.jsx
│   │   ├── TradeDetailModal.jsx
│   │   └── TradesList.jsx
│   ├── contexts/
│   │   └── AuthContext.jsx
│   ├── hooks/
│   │   └── useTrades.js
│   ├── pages/
│   │   ├── LoginPage.jsx
│   │   ├── MentorDashboard.jsx
│   │   └── StudentDashboard.jsx
│   ├── utils/
│   │   └── calculations.js
│   ├── App.jsx
│   ├── firebase.js
│   ├── index.css
│   └── main.jsx
├── .gitignore
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── vercel.json
└── vite.config.js
```

## 🎨 Design System

- **Cores principais:** Slate (backgrounds), Blue/Cyan (primário), Purple (accent)
- **Fontes:** DM Sans (body), Sora (headings), JetBrains Mono (code)
- **Dark theme** com efeitos de glassmorphism
- **Responsivo** para mobile e desktop

## 📊 Estrutura de Dados

### Collection: trades

```typescript
{
  id: string,
  date: string,           // YYYY-MM-DD
  ticker: string,
  exchange: 'B3' | 'NASDAQ' | 'NYSE' | 'CRYPTO',
  side: 'LONG' | 'SHORT',
  entry: number,
  exit: number,
  qty: number,
  result: number,         // Calculado automaticamente
  resultPercent: number,  // Calculado automaticamente
  setup: string,
  emotion: string,
  notes: string,
  htfUrl: string,         // URL do Firebase Storage
  ltfUrl: string,         // URL do Firebase Storage
  studentEmail: string,
  studentName: string,
  studentId: string,
  createdAt: Timestamp,
  mentorFeedback?: string,
  feedbackDate?: string
}
```

## 🔄 Atualizações Futuras

- [ ] Exportação de relatórios em PDF
- [ ] Metas e objetivos pessoais
- [ ] Sistema de notificações
- [ ] Análise por horário de trade
- [ ] Journal diário de sessão
- [ ] Calculadora de risco integrada

## 📝 Licença

Este projeto é de uso exclusivo para a mentoria de trading.

---

Desenvolvido com ❤️ para traders em evolução
