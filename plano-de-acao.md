# Plano de Ação - Correções Críticas de Segurança

## 1. Eliminação de IDOR e Controle de Acesso a Registros
- **`src/pages/MediacaoSalaExterna.jsx` (L21-65):** Bloquear acesso anônimo sem token assinado; impedir homologação indevida de acordos via `updateDoc`.
- **`src/pages/ValidaVisitante.jsx` (L24-72) & `ValidaConvidado.jsx`:** Restringir exibição de dados pessoais completos; validar hash/token de convite em vez de ID sequencial/previsível.
- **`src/pages/OnboardingCandidato.jsx` (L45-54):** Validar se o candidato autenticado corresponde ao ID do registro.
- **`firestore.rules` (L49-51):** Remover regra genérica `match /{document=**} { allow read, write: if isAuthenticated(); }` que concede acesso total a sessões anônimas. Restringir por `request.auth.uid` e roles específicas.

## 2. Autenticação e Autorização nas Rotas da API
- **Middleware JWT / Firebase Auth:** Criar middleware unificado para validar Firebase ID Token (`Authorization: Bearer <idToken>`) em:
  - `api/cora/emitir.js`
  - `api/extract.js`
  - `api/extrato/processar.js`
  - `api/onesignal.js`
  - `api/whatsapp-send.js`
  - `api/whatsapp-status.js`
- **Proteção dos Crons:** Exigir validação de `CRON_SECRET` em:
  - `api/cron/alertas-vencimento.js`
  - `api/manutencoes/lembretes.js`

## 3. Validação Criptográfica de Webhook
- **`api/cora/webhook.js` (L14-42):** Implementar validação de cabeçalho de assinatura / token secreto do Cora antes de atualizar o status do boleto para `Pago` no Firestore.

## 4. Remoção de Credenciais Hardcoded e Variáveis de Ambiente
- **`src/pages/VotacaoPublica.jsx` (L47):** Remover imediatamente o fallback `signInWithEmailAndPassword(auth, 'admin@alpha.com.br', 'admin123')`.
- **`api/extract.js` (L4):** Migrar chave Gemini para `process.env.GEMINI_API_KEY`.
- **`api/extrato/processar.js` (L34):** Migrar senha Gmail para `process.env.GMAIL_APP_PASSWORD`.
- **`api/onesignal.js` (L8-9):** Migrar `APP_ID` e `REST_API_KEY` para variáveis de ambiente.
- **Arquivos WhatsApp / Cron (`alertas-vencimento.js`, `lembretes.js`, `whatsapp-send.js`, `whatsapp-status.js`):** Migrar URL e `API_KEY` da Evolution para `process.env.EVOLUTION_API_KEY` e `process.env.EVOLUTION_API_URL`.

## 5. Proteção contra Força Bruta e Turnstile Real
- **`src/pages/Login.jsx` & `src/components/TurnstileWidget.jsx`:** Substituir o mock por componente Cloudflare Turnstile com carregamento do script oficial e validação do token retornado em endpoint backend (`/api/auth/verify-turnstile`).
- **Rate Limiting no Login:** Implementar bloqueio temporário após 5 tentativas consecutivas com falha no cliente e nas regras de autenticação.

## 6. Validação de Upload por Tipo Real (Magic Bytes) e Bloqueio do Storage
- **`storage.rules` (L6):** Revogar a permissão irrestrita `|| request.resource.size < 20MB`. Exigir autenticação e validar MIME types permitidos no bucket.
- **Verificação de Magic Bytes:** Criar rotina utilitária para validar cabeçalhos binários reais de arquivos (PDF `%PDF-`, JPEG `FF D8 FF`, PNG `89 50 4E 47`) antes do envio ao storage.
