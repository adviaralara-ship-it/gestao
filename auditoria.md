# Auditoria do Sistema

## Stack Utilizada
- **Frontend:** React 19, Vite 7, React Router DOM 7, TailwindCSS 3 / @tailwindcss/vite 4, Lucide React, Recharts.
- **Backend / Serverless:** Node.js (Vercel Serverless Functions), Python (Edge TTS handler), Firebase Admin SDK.
- **Banco de Dados & Storage:** Firebase Firestore, Firebase Storage, Cloudinary (upload não assinado).
- **Autenticação:** Firebase Authentication.
- **Integrações de Terceiros:** Cora Bank API, Evolution API (WhatsApp), OneSignal (Push), Google Gemini API (`@google/generative-ai`), Gmail IMAP (`imap-simple`, `mailparser`).

## Principais Rotas da API
- `GET /api/condomino/[telefone]`: Consulta de débitos e dados de condômino.
- `POST /api/cora/emitir`: Emissão de boletos e cobranças no Cora.
- `POST /api/cora/webhook`: Recebimento de eventos de pagamento do Cora.
- `GET/POST /api/cron/alertas-vencimento`: Cron job de alertas de contas a vencer via WhatsApp.
- `POST /api/extract`: OCR e extração de dados de notas e boletos via Google Gemini.
- `POST /api/extrato/processar`: Conciliação bancária via OFX e integração IMAP com Gmail.
- `GET/POST /api/manutencoes/lembretes`: Disparo de lembretes preventivos de manutenções via WhatsApp.
- `POST /api/onesignal`: Envio de notificações push para usuários.
- `POST /api/whatsapp-send`: Envio de mensagens de texto e mídia via Evolution API.
- `GET /api/whatsapp-status`: Verificação de status das instâncias do WhatsApp.
- `GET /api/gerar-audio`: Geração de áudio MP3 via Edge TTS.

## Tabelas do Banco de Dados (Coleções Firestore)
- `usuarios`: Credenciais, cargos, permissões e dados dos operadores do sistema.
- `moradores`: Cadastro de condôminos e moradores das unidades.
- `condominios`: Dados dos condomínios administrados.
- `boletos`: Registros de cobranças, boletos emitidos, status e pagamentos.
- `financeiro_lancamentos`: Lançamentos contábeis de receitas e despesas.
- `candidatos`: Currículos e dados do processo seletivo (Portal de Vagas).
- `notificacoes`: Alertas e notificações internas do sistema.
- `ponto_registros`: Registros de ponto eletrônico de funcionários.
- `manutencoes`: Agendamento e histórico de manutenções preventivas/corretivas.
- `ocorrencias`: Registro de incidentes e chamados nos condomínios.
- `reservas`: Agendamento de espaços comuns (churrasqueira, salão de festas).
- `eventos`: Cadastro de eventos e listas de convidados.
- `eventos_convidados`: Convidados individuais de eventos.
- `visitantes`: Autorização e registro de entrada de visitantes.
- `enquetes`: Votações e assembleias digitais.
- `mediacoes`: Processos de mediação e acordos de inadimplência (ODR).
- `documentos`: Arquivos e atas dos condomínios.
- `auditoria` / `auditoria_logs`: Logs de operações e trilha de auditoria.
- `prestadores`: Cadastro de fornecedores e prestadores de serviço.
- `veiculos`: Controle de veículos cadastrados nas garagens.
- `encomendas`: Rastreio de encomendas recebidas na portaria.
- `classificados`: Anúncios internos entre condôminos.
- `tarefas`: Quadro de atividades e rotinas da equipe.
