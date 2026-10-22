# Alpha Soluções Condominiais — Contexto & Diretrizes do Projeto

## 1. Identificação do Repositório e Ambientes
- **Repositório GitHub:** `https://github.com/adviaralara-ship-it/gestao.git` (branch `master`)
- **Diretório Local Oficial:** `C:\Users\ESCRITORIO\Downloads\Automacao\Gestão`
- **Produção (Vercel):** `https://app.alphaadmsc.com.br` (Projeto `alphaadmsc` / equipe `iaralara1812-6030s-projects`)
- **Regra de Idioma:** Português do Brasil (pt-BR) em todas as respostas e mensagens.

## 2. Arquitetura do Sistema
- **Frontend:** React 19 + Vite 7 + Tailwind CSS v3/v4.
- **Backend Serverless:** Vercel Functions em `/api` (Node.js ESM).
  > **IMPORTANTE (Limite Vercel Hobby):** Máximo de **12 funções serverless** em `/api`. Nunca crie um 13º arquivo em `/api` sem mesclar em endpoints existentes (ex: `/api/whatsapp-send`).
- **Banco de Dados & Auth:** Firebase v12 (`alphaadmsc-fdc4e`): Firestore, Authentication, Storage.
- **WhatsApp:** Evolution API (`https://runningfly-evolution.cloudfy.live`), Instância: `InstanciaAlpha`.
- **Inteligência Artificial:** Google Gemini AI via chave no `.env` e Vercel (`GEMINI_API_KEY`).
- **E-mails & Boletos:** Gmail SMTP (`alphaadmsc@gmail.com`) e Cora Bank (`/api/cora`).

## 3. Estrutura de Pastas
- `src/pages/`: Telas do sistema (`Tarefas.jsx`, `Dashboard.jsx`, `Boletos.jsx`, `Manutencoes.jsx`, etc.)
- `src/pages/financeiro/`: Módulos financeiros (`ContasPagar.jsx`, `DashboardFinanceiro.jsx`, etc.)
- `src/components/`: Componentes reutilizáveis (`Header.jsx`, `Layout.jsx`, `ModalLembretesDoDia.jsx`)
- `src/hooks/`: Hooks de dados e automações (`useDailyAutoReminder.js`, `useFirestore.js`, etc.)
- `src/utils/`: Utilitários (`whatsappAutomacao.js`, `crypto.js`, `boletoPdf.js`)
- `api/`: Funções serverless da Vercel (limite estrito de 12 arquivos)

## 4. Comandos Padrão (Sem Desperdício de Tokens)
- **Compilar Frontend com Blindagem Terser:** `npm run build`
- **Deploy de Produção:**
  1. `git add -A && git commit -m "mensagem"`
  2. `git push origin master`
  3. `npx vercel --prod --yes`
- **Anti-Cache:** O `vercel.json` possui cabeçalhos `no-cache, no-store, must-revalidate` para `index.html`.

## 5. Gatilho de Atualização Automática
- Sempre que o usuário disser "atualizar", "atualiza", "subir", "deploy", "publicar" ou quando qualquer alteração de código for solicitada, execute automaticamente:
  `cd "C:\Users\ESCRITORIO\Downloads\Automacao\Gestão"; npm run deploy`
  (ou a sequência: `npm run build` -> `git add -A && git commit` -> `git push origin master` -> `npx vercel --prod --yes`).
- O usuário nunca precisa rodar comandos manuais nem pedir cada etapa: entregue sempre a URL de produção pronta e atualizada.
