# marcioportes.com.br — Portal Institucional v2.0

## Documento de Referência: Branding, Arquitetura e Roadmap

**Versão:** 2.0
**Data:** 29/03/2026
**Status:** Decisões consolidadas — pronto para execução
**Origem:** Evolução do v1.0, incorporando sessão estratégica de 29/03/2026

---

## 1. RESUMO EXECUTIVO

### De → Para

| Aspecto | v1.0 (Março 2026) | v2.0 (Esta versão) |
|---|---|---|
| **Conceito** | Portal institucional genérico | Hub de marca pessoal com funil comportamental |
| **Marca** | Indefinida | **Marcio Portes** (marca pessoal) |
| **Framework** | Sem nome público | **Modelo Portes** |
| **Plataforma SaaS** | Acompanhamento 2.0 | **Espelho** (nome público) |
| **Mentoria** | Tchio-Alpha | **Mentoria Alpha** |
| **Lead magnet** | Quiz genérico | **Diagnóstico Comportamental** (IA conversacional) |
| **Motor de aquisição** | SEO + ads | **Fibonaccing** (conteúdo gratuito, 100h+ existente) |
| **Stack portal** | Next.js + CMS headless + NextAuth | Landing page leve + mesmo Firebase + custom domains |
| **Modelo de negócio** | Tier único (~R$ 500/mês) | Dois tiers: Espelho self-service + Mentoria Alpha |

### Decisões Consolidadas Nesta Versão

- DEC-P01: Marca pessoal "Marcio Portes" como guarda-chuva (não institucional)
- DEC-P02: "Modelo Portes" como nome do framework comportamental (4D + TEF + maturidade)
- DEC-P03: "Espelho" como nome público da plataforma SaaS (internamente permanece `acompanhamento-2.0`)
- DEC-P04: "Mentoria Alpha" como nome do serviço premium individual
- DEC-P05: "Diagnóstico Comportamental" como lead magnet #1 (assessment gratuito com IA)
- DEC-P06: Fibonaccing como motor de aquisição principal (conteúdo gratuito, 100h+)
- DEC-P07: Dois modos do Espelho: self-service (tier base) e mentorado (Mentoria Alpha)
- DEC-P08: Rename externo via custom domain + UI, sem refactoring de codebase/repo/Firebase
- DEC-P09: Público prioritário 12 meses: traders intermediários que já operam mas não evoluem
- DEC-P10: Portal como landing page leve, não como segundo projeto full-stack

---

## 2. POSICIONAMENTO DE MARCA

### Marca-Mãe

**Marcio Portes**

### Tagline

**"Você não tem problema de setup. Tem problema de comportamento."**

### Narrativa Central

O mercado está cheio de cursos sobre setup, indicadores e estratégias. Nenhum deles explica por que você não segue o próprio plano. Marcio Portes transforma o comportamento de traders em vantagem competitiva mensurável — combinando 25 anos de engenharia de sistemas críticos com frameworks de psicologia comportamental aplicada ao mercado financeiro.

### Público-Alvo Primário

Traders intermediários que já operam mas estagnaram. Características:

- Já passaram da fase de aprendizado técnico
- Sabem ler gráfico, conhecem indicadores, têm setup definido
- Continuam repetindo os mesmos erros: movem stop, fazem revenge trading, não seguem o plano
- Sentem que o problema "não é técnico" mas não sabem nomear o que é
- Já investiram em cursos e mentorias focados em técnica sem resultado duradouro

### Pilares de Autoridade

1. **Credibilidade técnica:** 25 anos em operações críticas de tecnologia + construtor da própria plataforma com IA
2. **Framework proprietário:** Modelo Portes (4D: Emocional/Plano/Modelo/Operacional), escala de maturidade, sistema de diagnóstico por IA
3. **Resultados com dados:** O sistema gera métricas — scores emocionais, compliance, payoff, risco operacional — permitindo mostrar evolução com evidência, não com depoimentos vagos
4. **Ponte tech + humano:** Tecnologia como instrumento de diagnóstico comportamental + mentoria humana para intervenção

### Diferenciadores vs. Mercado

| O que outros fazem | O que Marcio Portes faz |
|---|---|
| Ensinam setup e indicadores | Diagnostica e corrige comportamento |
| Usam planilha e WhatsApp | Plataforma própria com IA (Espelho) |
| Vendem "método infalível" | Mede, acompanha e mostra evolução com dados |
| Coaching genérico | Framework estruturado (Modelo Portes) com 4 dimensões |
| Promessa de resultado financeiro | Promessa de consciência comportamental |

---

## 3. SISTEMA DE NAMING

### Hierarquia Completa

```
MARCIO PORTES
"Você não tem problema de setup. Tem problema de comportamento."
│
├── Modelo Portes
│   O framework comportamental proprietário.
│   4 dimensões: Emocional · Plano · Modelo · Operacional
│   Escala de maturidade · Diagnóstico por IA · Probing questions
│   "Seu comportamento de trading pode ser medido,
│    diagnosticado e corrigido."
│
├── Produtos:
│   ├── Diagnóstico Comportamental     [gratuito, lead magnet]
│   │   Assessment por IA baseado no Modelo Portes
│   │   Resultado: perfil comportamental + pontos cegos
│   │
│   ├── Espelho                        [plataforma SaaS, dois modos]
│   │   Tagline: "O que o gráfico não mostra, o Espelho revela."
│   │   Modo self-service: diário + KPIs + insights IA
│   │   Modo mentorado: + feedback mentor + relatório AI + ciclos
│   │
│   ├── Mentoria Alpha                 [serviço premium individual]
│   │   Inclui Espelho (modo mentorado) + sessões 1:1
│   │   + feedback individual + validação de ciclo
│   │
│   └── Formação Marcio Portes         [EAD, futuro]
│       Cursos estruturados (detalhes TBD)
│
├── Conteúdo Gratuito:
│   ├── Fibonaccing                    [motor de aquisição principal]
│   │   100h+ de conteúdo: treinamentos, vídeos, mindmaps, PDFs
│   │   Tudo gratuito — isca para o funil comportamental
│   │
│   ├── Blog                           [artigos, SEO]
│   └── YouTube                        [vídeos]
│
└── Participações:
    └── Entrevistas / Mídia            [ex: Gaincast — convidado, não proprietário]
```

### Naming: Codebase vs. Público

| Contexto | Nome interno | Nome público |
|---|---|---|
| Repositório GitHub | `acompanhamento-2.0` | Não muda |
| Firebase Project | `acompanhamento-2.0` (ou equivalente) | Não muda |
| Vercel Project | `acompanhamento-2.0` | Não muda |
| URL do app | `app.marcioportes.com.br` | **Espelho** |
| Título no navegador (`<title>`) | Mudar para "Espelho" | **Espelho** |
| Logo no app | Mudar para "Espelho" | **Espelho** |
| Referências em docs/comunicação | "Acompanhamento 2.0" nos docs técnicos | "Espelho" em tudo externo |

---

## 4. MODELO DE NEGÓCIO

### Situação Atual (Março 2026)

- 61 alunos totais: 48 ativos + 13 VIP (mentoria individual)
- Pricing: R$ 500/mês ou R$ 1.200/trimestre
- Formato: grupo WhatsApp + sessões de pregão diárias (9h-12h) + plataforma para os 13 VIP
- Churn observado: alunos não renovando (economia + modelo possivelmente esgotado)

### Modelo Futuro (Dois Tiers)

```
Diagnóstico Comportamental ──── Gratuito
        │                       · Assessment por IA (Modelo Portes)
        │                       · Resultado: perfil + pontos cegos
        │                       · Porta de entrada do funil
        │
        ▼
Espelho (self-service) ──────── Pricing atual mantido
        │                       · Diário de trading (registro de operações)
        │                       · KPIs automáticos (Modelo Portes)
        │                       · Nota de evolução por dimensão (gates)
        │                       · Detecção de padrões (TILT, revenge)
        │                       · Gráficos de evolução
        │                       · Grupo WhatsApp
        │                       · Sessões de pregão diárias
        │                       · Acesso ao mentor via WhatsApp/canais
        │                       · SEM: ciclos, assessment AI, SWOT, feedback individual
        │
        ▼
Mentoria Alpha ──────────────── Pricing premium (TBD)
                                · Tudo do Espelho +
                                · Fechamento de ciclo (ritual de evolução)
                                · Assessment Comportamental por IA (relatório)
                                · SWOT dinâmico (analisa KPIs + diagnostica por gate/dimensão + prescreve)
                                · Feedback individual do mentor
                                · Validação de ciclo
                                · Probing questions / aprofundamento
                                · Sessões 1:1
                                · Plano de evolução personalizado
```

### Nota sobre Pricing

Decisão do Marcio: manter pricing atual. Descontos pontuais conforme necessidade. Pricing do tier Mentoria Alpha a ser definido quando a diferenciação de tiers for implementada.

### Migração do Grupo Atual

A comunicação para o grupo existente reposiciona sem desvalorizar:

- Todos passam a ter acesso ao Espelho (plataforma)
- Os 13 VIP continuam com feedback individual (Mentoria Alpha)
- Os 48 ativos ganham a plataforma como valor adicional
- Ninguém perde nada — todos ganham ferramenta
- Quem quer feedback individual, faz upgrade para Mentoria Alpha

---

## 5. FUNIL DE AQUISIÇÃO

### Motor Principal: Fibonaccing

```
AQUISIÇÃO (topo do funil)
│
├─ Twitter/X (~14k seguidores) → marcioportes.com.br/fibonaccing
├─ YouTube (vídeos existentes) → marcioportes.com.br/fibonaccing
├─ Google (SEO: "fibonacci trading") → marcioportes.com.br/fibonaccing
│
▼
FIBONACCING (conteúdo gratuito)
│  100h+ de treinamento, vídeos, mindmaps, PDFs
│  Organizado em trilha de aprendizado
│  "Tudo sobre Fibonacci aplicado ao trading. Grátis."
│
│  CTA contextual em cada página/vídeo:
│  "Você domina a técnica. Mas segue seu plano?"
│  "Descubra o que está travando sua evolução."
│
▼
DIAGNÓSTICO COMPORTAMENTAL (lead magnet gratuito)
│  Assessment conversacional por IA (Modelo Portes)
│  Resultado: perfil comportamental + pontos cegos
│  "Aqui está o que está travando sua evolução como trader."
│
▼
CONVERSÃO
├─ Espelho (self-service) → plataforma + comunidade
└─ Mentoria Alpha → acompanhamento individual premium
```

### Por Que Funciona

1. **Custo de aquisição ~zero:** O tráfego já existe (14k Twitter, YouTube, SEO)
2. **Conteúdo já produzido:** 100h+ precisam apenas de curadoria e organização
3. **Transição natural:** Pessoa vem pelo técnico (Fibonacci) → descobre que o problema é comportamental → faz o diagnóstico → entra no funil
4. **Posicionamento validado pela jornada:** O aluno experimenta na prática a tese "não é problema de setup"

---

## 6. ESTRUTURA DO PORTAL (Landing Page)

### Arquitetura de URLs

```
marcioportes.com.br/                    ← Landing page principal
├── /sobre                              ← Bio, CV, filosofia, história
├── /mentoria                           ← Mentoria Alpha, como funciona, aplicação
├── /espelho                            ← Vitrine do produto, features, CTA
├── /fibonaccing                        ← Mini-portal: trilha completa gratuita
│   ├── /fibonaccing/treinamentos       ← Módulos de treinamento organizados
│   ├── /fibonaccing/videos             ← Vídeos YouTube organizados
│   └── /fibonaccing/materiais          ← Mindmaps, PDFs, apresentações
├── /diagnostico                        ← Assessment comportamental (IA)
├── /conteudo                           ← Blog, artigos
└── /contato                            ← Formulário, redes sociais

app.marcioportes.com.br                 ← Espelho (plataforma SaaS)
                                           Subdomínio, mesmo Vercel deploy
```

### Landing Page — Estrutura de Seções

```
marcioportes.com.br/
│
├─ HERO SECTION
│   Headline: "Você não tem problema de setup.
│              Tem problema de comportamento."
│   Sub: "Descubra em 5 minutos o que está travando
│          sua evolução como trader."
│   CTA primário: [Fazer o Diagnóstico Comportamental — Gratuito]
│   CTA secundário: "Conheça o Modelo Portes" (scroll)
│
├─ SEÇÃO: O PROBLEMA
│   Narrativa das dores do intermediário estagnado:
│   "O mercado está cheio de cursos sobre setup, indicadores
│    e estratégias. Nenhum deles explica por que você não
│    segue o próprio plano."
│   3 cards com dores reconhecíveis:
│   ├─ "Você move o stop antes da hora"
│   ├─ "Você aumenta posição depois de perder"
│   └─ "Você sabe o que deveria fazer — e faz o oposto"
│
├─ SEÇÃO: O MODELO PORTES
│   Framework 4D visual (Emocional / Plano / Modelo / Operacional)
│   "Seu comportamento de trading pode ser medido,
│    diagnosticado e corrigido — como qualquer outra
│    competência profissional."
│   Diferencial: dados, não opinião. IA, não achismo.
│
├─ SEÇÃO: COMO FUNCIONA (jornada em 3 passos)
│   1. Diagnóstico → Assessment gratuito com IA
│   2. Espelho → Plataforma de acompanhamento comportamental
│   3. Mentoria Alpha → Evolução com feedback individual
│   CTA: [Começar pelo Diagnóstico — Gratuito]
│
├─ SEÇÃO: ESPELHO (produto SaaS)
│   "O que o gráfico não mostra, o Espelho revela."
│   Features: diário comportamental, KPIs automáticos,
│   detecção de padrões (TILT, revenge), insights por IA
│   Screenshot / demo visual
│   [Conhecer o Espelho →]
│
├─ SEÇÃO: MENTORIA ALPHA (serviço premium)
│   "Evolução personalizada com dados, não opinião."
│   O que inclui: tudo do Espelho + feedback individual
│   + relatório AI + validação de ciclo + sessões 1:1
│   [Aplicar para Mentoria Alpha →]
│
├─ SEÇÃO: FIBONACCING (conteúdo gratuito)
│   "100+ horas de conteúdo sobre Fibonacci aplicado
│    ao trading. Treinamentos, vídeos, mapas mentais.
│    Tudo grátis."
│   Preview: 3-4 cards de conteúdo mais popular
│   [Acessar Fibonaccing — Gratuito →]
│
├─ SEÇÃO: SOBRE MARCIO
│   Foto profissional
│   Bio: "25 anos construindo sistemas críticos.
│         Agora construo traders consistentes."
│   Credenciais resumidas
│   [Conheça minha história completa →]
│
├─ SEÇÃO: PROVA SOCIAL
│   Depoimentos de alunos (quando disponíveis)
│   Métricas: "X traders acompanhados",
│   "Y mil operações analisadas"
│
├─ SEÇÃO: CONTEÚDO RECENTE
│   Último post do blog
│   Último vídeo YouTube
│   Participações em mídia (ex: Gaincast)
│
└─ FOOTER
    Newsletter signup
    Links: Sobre / Mentoria / Espelho / Fibonaccing / Contato
    Redes sociais (Twitter/X, YouTube, LinkedIn, Instagram)
    © Marcio Portes
```

---

## 7. ARQUITETURA TÉCNICA

### Princípio: Mínima Complexidade

O portal v2.0 abandona a abordagem do v1.0 (Next.js + CMS headless + NextAuth + Supabase/Firebase dual) em favor de simplicidade máxima.

### Stack do Portal (Landing Page)

| Camada | Decisão | Justificativa |
|---|---|---|
| Framework | Next.js 15, App Router, RSC | SSR para SEO, mesmo ecossistema Vercel |
| Styling | Tailwind CSS + shadcn/ui | Consistência com o Espelho |
| Deploy | Vercel | Mesmo provider, domínio principal |
| CMS | MDX in-repo (ou Keystatic) | Zero infra extra, Git-native, 2 posts/mês |
| Analytics | GA4 + Vercel Analytics | SEO tracking + Core Web Vitals |
| Email | Resend | API moderna, React Email templates |
| Monitoring | Sentry | Error tracking real |

### Stack do Espelho (já existente)

| Camada | Tecnologia | Status |
|---|---|---|
| Frontend | React 18 / Vite | Produção |
| Backend | Firebase Cloud Functions | Produção |
| Database | Firestore | Produção |
| Auth | Firebase Auth | Produção |
| AI | Anthropic API (Claude) | Produção |
| Deploy | Vercel | Produção |

### Conexão Portal ↔ Espelho

```
marcioportes.com.br          ← Portal (Next.js, Vercel)
        │                       Páginas públicas, SEO, marketing
        │
        │  [Links / CTAs]
        │
        ▼
app.marcioportes.com.br      ← Espelho (React/Vite, mesmo Vercel)
                                Plataforma logada, dados, operação
                                Mesmo Firebase project
```

- **Sem SSO complexo:** São domínios separados com o mesmo Firebase Auth project. O login é no Espelho (app.marcioportes.com.br). O portal é 100% público.
- **Sem banco de dados compartilhado para conteúdo:** O portal usa MDX para blog posts, não Firestore.
- **Sem NextAuth/Auth.js:** Firebase Auth é suficiente. Portal não precisa de auth.

### Custom Domain Setup (Vercel)

```
marcioportes.com.br           → Vercel project: portal
app.marcioportes.com.br       → Vercel project: acompanhamento-2.0
```

Dois projetos Vercel, mesmo domínio raiz, subdomínio para o app. Configuração via DNS (CNAME para app.marcioportes.com.br → cname.vercel-dns.com).

---

## 8. ADAPTAÇÕES TÉCNICAS NO ESPELHO

### Rename Externo (Sem Refactoring)

O que muda:

- `<title>` do HTML → "Espelho — Marcio Portes"
- Logo/header do app → "Espelho"
- Custom domain → `app.marcioportes.com.br`
- Textos de UI que referenciem "Acompanhamento 2.0" → "Espelho"

O que NÃO muda:

- Nome do repo GitHub (`acompanhamento-2.0`)
- Nome do Firebase project
- Nome do Vercel project
- Nomes de collections, functions, variáveis no código
- Documentação técnica interna (docs/PROJECT.md etc.)

### Modo Self-Service (Issue #098)

Detalhado no documento separado: `issue-098-espelho-self-service.md`

Resumo: adaptações para que alunos sem mentor extraiam valor da plataforma sozinhos. Inclui relatório AI auto-trigger, dashboard self-service, ciclo auto-close, e insights automatizados.

---

## 9. SEÇÃO FIBONACCING — DETALHAMENTO

### Inventário de Conteúdo (a ser curado)

| Tipo | Volume estimado | Status |
|---|---|---|
| Treinamentos gravados | Horas TBD | Organizados (parcialmente) |
| Vídeos YouTube | Horas TBD | Públicos, dispersos |
| Mindmaps | Quantidade TBD | Em PC local, parcialmente organizados |
| Apresentações PPT/PDF | Quantidade TBD | Em PC local |

### Estrutura Proposta para /fibonaccing

```
/fibonaccing
├── Hero: "Tudo sobre Fibonacci aplicado ao trading. Grátis."
├── Trilha de aprendizado (módulos sequenciais):
│   ├── Módulo 1: Fundamentos de Fibonacci
│   ├── Módulo 2: Aplicação em Price Action
│   ├── Módulo 3: [TBD baseado no conteúdo existente]
│   ├── Módulo N: [TBD]
│   └── CTA em cada módulo: "Domine a técnica.
│       Agora descubra o que mais está travando você."
│       → [Fazer o Diagnóstico Comportamental]
├── Biblioteca de vídeos (YouTube embeds, categorizado)
├── Downloads (mindmaps, PDFs, apresentações)
└── CTA final: Diagnóstico Comportamental
```

### Ação Necessária

Marcio precisa fazer inventário completo do conteúdo Fibonaccing existente (PC local + YouTube) para que a curadoria e organização em trilha possam ser feitas. Este é um pré-requisito para a construção da seção /fibonaccing no portal.

---

## 10. DIAGNÓSTICO COMPORTAMENTAL — CONCEITO

### O Que É

Assessment gratuito baseado no Modelo Portes que avalia o perfil comportamental do trader em 5 minutos. Usa IA conversacional (infraestrutura já existente no Espelho: `classifyOpenResponse`, probing questions, rubrics) para gerar um mini-relatório personalizado.

### Por Que É o Lead Magnet #1

- Gera dados sobre o lead (qualificação automática)
- Demonstra o Modelo Portes na prática (experiência, não slide)
- Resultado personalizado (conversão superior a quiz genérico)
- Infraestrutura de IA já existe no Espelho

### Experiência do Usuário

```
1. Usuário acessa /diagnostico (via CTA do portal ou Fibonaccing)
2. Responde 5-8 perguntas comportamentais (formato conversacional)
3. IA classifica respostas usando rubrics do Modelo Portes
4. Resultado: perfil nas 4 dimensões + 2-3 pontos cegos identificados
5. CTA: "Quer acompanhar sua evolução? Conheça o Espelho."
         "Quer corrigir com acompanhamento individual? Mentoria Alpha."
6. Email capturado para follow-up
```

### Dependência Técnica

O Diagnóstico Comportamental pode ser implementado como:
- (a) Página standalone no portal com chamadas à Anthropic API (mais simples)
- (b) Rota pública dentro do Espelho (reutiliza infraestrutura existente)
- (c) Widget embedável (mais flexível, funciona em ambos)

Decisão técnica a ser tomada na implementação.

---

## 11. MACRO-CRONOGRAMA

### Fase 0: Estabilização e Preparação (Abril 2026)

**Objetivo:** Estancar churn, preparar migração de tiers, adaptar Espelho.

| Item | Descrição | Prioridade |
|---|---|---|
| Issue #097 | Finalizar AI Assessment Report (em andamento) | CRÍTICO |
| Issue #098 | Modo self-service do Espelho | CRÍTICO |
| Rename externo | `<title>`, logo, textos UI → "Espelho" | ALTO |
| Custom domain | `app.marcioportes.com.br` → Vercel | ALTO |
| Comunicação grupo | Reposicionar oferta: Espelho + Mentoria Alpha | ALTO |
| Node.js 20 migration | Deadline Firebase: 30/04/2026 | CRÍTICO |
| firebase-functions SDK | 4.9.0 → ≥5.1.0 | CRÍTICO |

### Fase 1: Portal MVP (Maio-Junho 2026)

**Objetivo:** Landing page marcioportes.com.br no ar com funil básico.

| Item | Descrição | Prioridade |
|---|---|---|
| Next.js scaffold | Projeto portal, Vercel, domínio principal | ALTO |
| Landing page | Hero + Problema + Modelo Portes + Como Funciona | ALTO |
| Página /espelho | Vitrine do produto com CTA | ALTO |
| Página /mentoria | Descrição + formulário de aplicação | ALTO |
| Página /sobre | Bio, credenciais, história | MÉDIO |
| Página /contato | Formulário + redes | MÉDIO |
| GA4 + Vercel Analytics | Setup básico | ALTO |
| DNS setup | marcioportes.com.br → portal, app.marcioportes.com.br → Espelho | ALTO |

### Fase 2: Fibonaccing + Diagnóstico (Julho-Agosto 2026)

**Objetivo:** Motor de aquisição e lead magnet ativos.

| Item | Descrição | Prioridade |
|---|---|---|
| Inventário Fibonaccing | Marcio cataloga todo conteúdo existente | PRÉ-REQUISITO |
| Curadoria | Organizar em trilha de aprendizado | ALTO |
| Seção /fibonaccing | Mini-portal com trilha, vídeos, downloads | ALTO |
| Diagnóstico Comportamental | Assessment por IA, página /diagnostico | ALTO |
| Email capture + follow-up | Resend integration, sequência de nurturing | MÉDIO |
| SEO | Meta tags, sitemap, Schema.org, Search Console | MÉDIO |

### Fase 3: Conteúdo e Expansão (Q3-Q4 2026)

**Objetivo:** Conteúdo regular, EAD, escala.

| Item | Descrição | Prioridade |
|---|---|---|
| Blog | Setup MDX + primeiros 10 posts | MÉDIO |
| YouTube integration | Embeds organizados no portal | MÉDIO |
| Formação Marcio Portes | Planejamento EAD (estrutura, plataforma) | FUTURO |
| Livro | Página de pré-venda (se aplicável) | FUTURO |
| Ads | Teste de aquisição paga (Google, LinkedIn) | FUTURO |

---

## 12. DECISÕES TÉCNICAS PENDENTES

| # | Decisão | Opções | Impacto | Quando decidir |
|---|---|---|---|---|
| PEND-01 | Diagnóstico: standalone vs. dentro do Espelho | (a) Portal + API, (b) Rota pública Espelho, (c) Widget | Arquitetura, custo | Fase 2 |
| PEND-02 | Fibonaccing: hosting de vídeos | YouTube embeds vs. player próprio | Custo, controle | Fase 2 |
| PEND-03 | Email provider | Resend vs. Sendgrid vs. Brevo | Custo, DX | Fase 1 |
| PEND-04 | Pricing Mentoria Alpha | Valor diferenciado vs. pricing atual | Revenue | Fase 0 |
| PEND-05 | Espelho: ciclo auto-close | Automático vs. trigger do aluno | UX, dados | Issue #098 |
| PEND-06 | Vite → Next.js migration | Migrar app ou manter separado | Complexidade | Avaliar Q3 |

---

## 13. MÉTRICAS DE SUCESSO

### Norte (12 meses)

| Métrica | Atual | Meta 6 meses | Meta 12 meses |
|---|---|---|---|
| Alunos Espelho (total) | 61 | 80-100 | 150+ |
| Alunos Mentoria Alpha | 13 | 15-20 | 25-30 |
| Churn mensal | Crescente (?) | <5% | <3% |
| Leads via Diagnóstico | 0 | 50/mês | 200/mês |
| Tráfego Fibonaccing | 0 (não existe) | 2.000/mês | 10.000/mês |
| Newsletter subscribers | 0 | 500 | 2.000 |

### Operacionais

| Métrica | Meta |
|---|---|
| Conversão Diagnóstico → Espelho | 10-15% |
| Conversão Espelho → Mentoria Alpha | 15-25% |
| Tempo médio no Diagnóstico | 4-6 minutos |
| NPS alunos Mentoria Alpha | >8 |

---

## APÊNDICE A: Teste de Coerência da Marca

### Boca-a-boca

> "Cara, eu faço a Mentoria Alpha com o Marcio Portes. Ele usa um negócio chamado Espelho que mostra todos os seus padrões de comportamento no trading. Eu descobri que tenho problema de revenge trading pelo Diagnóstico Comportamental que ele tem no site — é grátis, faz em 5 minutos."

### LinkedIn (autoridade)

> "Nos últimos 6 meses, 30 traders passaram pelo Diagnóstico Comportamental do Modelo Portes. O padrão mais comum? 78% não seguem o próprio plano — e não sabem por quê. É exatamente isso que o Espelho torna visível."

### Twitter/X (gancho)

> "Você não tem problema de setup. Tem problema de comportamento. Faça o Diagnóstico gratuito — link na bio."

### Sessão de mentoria

> "Olha seu Espelho aqui: nas últimas 3 semanas seu score emocional caiu toda vez depois de uma perda maior que 2R. Seu TILT está disparando no segundo trade do dia. Vamos trabalhar isso na Mentoria Alpha."

---

## APÊNDICE B: Stack Recomendado Detalhado

### Portal (Landing Page)

| Camada | Tecnologia | Alternativa | Justificativa |
|---|---|---|---|
| Framework | Next.js 15 (App Router, RSC) | — | SSR/SEO, ecossistema Vercel |
| Styling | Tailwind CSS + shadcn/ui | — | Consistência com Espelho |
| Deploy | Vercel | — | Mesmo provider |
| CMS | MDX in-repo | Keystatic (se quiser UI de edição) | Zero infra, Git-native |
| Analytics | GA4 + Vercel Analytics | + PostHog (futuro) | SEO + Web Vitals |
| Email | Resend | Sendgrid | API moderna, React Email |
| Monitoring | Sentry | — | Error tracking |
| AI (Diagnóstico) | Anthropic API (Claude) | — | Já em uso no Espelho |
| Search (futuro) | Algolia ou Typesense | — | Busca interna blog/Fibonaccing |

### Espelho (Plataforma SaaS) — Stack Atual Mantido

| Camada | Tecnologia | Status |
|---|---|---|
| Frontend | React 18 / Vite / Tailwind | Produção |
| UI Components | shadcn/ui | Produção |
| Backend | Firebase Cloud Functions v2 | Produção (migrar SDK ≥5.1.0) |
| Database | Firestore | Produção |
| Auth | Firebase Auth | Produção |
| AI | Anthropic API (Claude) | Produção |
| Deploy | Vercel | Produção |
| Tests | Vitest + jsdom | Produção |
| Monitoring | — | Debt: implementar Sentry |

### Evolução Técnica Recomendada (não urgente)

| Item | O que | Por que | Quando |
|---|---|---|---|
| Zod schemas | `src/domain/schemas.ts` com validação de entidades | Resolver "sistema é dono do dado" sem migrar DB | Q2-Q3 |
| Camada de domínio | Write-path validation obrigatória | Integridade de dados na aplicação | Q2-Q3 |
| Sentry | Error monitoring no Espelho | Profissionalizar ops | Fase 0-1 |
| PostHog | Session replay + funnels + A/B | Substituir Hotjar (se usado) | Fase 2+ |

---

**Documento Version:** 2.0
**Última Atualização:** 29/03/2026
**Status:** Decisões consolidadas — pronto para execução
**Próxima revisão:** Após Fase 0 (final de Abril 2026)
