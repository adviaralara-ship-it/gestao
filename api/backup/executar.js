// api/backup/executar.js
// Endpoint seguro para extração completa de dados (backup) do sistema Alpha
// Utilizado para download direto pelo painel e para automações (n8n / Google Drive / Cron / E-mail)

import nodemailer from 'nodemailer';
import { applyCors, verifyUserAuth, requireRole, safeCompare, getFirebaseAdmin } from '../_middleware/auth.js';

export const config = {
  api: {
    responseLimit: '15mb',
  },
};

const COLECOES_SISTEMA = [
  'condominios', 'moradores', 'financeiro_lancamentos', 'boletos', 
  'cotacoes', 'manutencoes', 'apolices', 'ocorrencias', 'assembleias', 
  'avisos', 'reservas', 'usuarios', 'pets', 'veiculos', 'visitantes', 
  'documentos', 'encomendas', 'tarefas', 'notas_fiscais'
];

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, POST, OPTIONS')) return;

  // 1. Validação de Autorização Estrita
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.split('Bearer ')[1]?.trim() : '';
  const secretKey = process.env.API_SECRET_KEY;
  const cronSecret = process.env.CRON_SECRET;

  const isSecretKey = Boolean(token && ((secretKey && safeCompare(token, secretKey)) || (cronSecret && safeCompare(token, cronSecret))));

  let isAuthorized = isSecretKey;

  if (!isAuthorized) {
    const user = await verifyUserAuth(req, res);
    if (user && requireRole(user, ['Administrador', 'admin'], res)) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Acesso restrito ao cofre de segurança Alpha.' });
  }

  try {
    const adminInst = getFirebaseAdmin();
    const db = adminInst.firestore();

    const dadosExportados = {};
    let totalDocs = 0;

    for (const colName of COLECOES_SISTEMA) {
      try {
        const snap = await db.collection(colName).get();
        dadosExportados[colName] = snap.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }));
        totalDocs += snap.docs.length;
      } catch (errCol) {
        console.warn(`Aviso ao exportar coleção ${colName}:`, errCol.message);
        dadosExportados[colName] = [];
      }
    }

    const agora = new Date();
    const dataIso = agora.toISOString().slice(0, 10);
    const horaIso = agora.toTimeString().slice(0, 8).replace(/:/g, '-');
    const nomeArquivo = `alpha_backup_completo_${dataIso}_${horaIso}.json`;
    const jsonStr = JSON.stringify(dadosExportados, null, 2);

    // 2. Destino do cofre é ESTRITAMENTE o endereço oficial do sistema (imune a manipulação externa)
    const deveEnviarEmail = req.query?.enviarEmail === 'true' || req.body?.enviarEmail === true;
    const destinoEmail = process.env.COFRE_EMAIL || 'cofrealpha29@gmail.com';
    let emailStatus = null;

    if (deveEnviarEmail) {
      try {
        const gmailUser = process.env.GMAIL_USER || 'alphaadmsc@gmail.com';
        let rawPass = process.env.GMAIL_APP_PASSWORD || '';

        // Fallback local se não estiver no ambiente
        if (!rawPass) {
          try {
            const fs = await import('fs');
            if (fs.existsSync('.env')) {
              const envContent = fs.readFileSync('.env', 'utf8');
              for (const line of envContent.split('\n')) {
                if (line.startsWith('GMAIL_APP_PASSWORD=')) {
                  rawPass = line.split('=')[1].trim().replace(/["']/g, '');
                  break;
                }
              }
            }
          } catch (e) {
            // ignore
          }
        }

        const effectivePass = rawPass.replace(/[\s"']/g, '');

        if (effectivePass) {
          const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: {
              user: gmailUser,
              pass: effectivePass
            }
          });

          const mailOptions = {
            from: `"Cofre Alpha Soluções" <${gmailUser}>`,
            to: destinoEmail,
            subject: `🔒 [Cofre Alpha] Cópia de Segurança do Sistema - ${agora.toLocaleDateString('pt-BR')}`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0f172a; padding: 24px; color: #f8fafc;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 16px; border: 1px solid #334155; padding: 24px;">
                  <h2 style="color: #38bdf8; margin-top: 0;">🛡️ Cofre de Segurança Alpha</h2>
                  <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6;">
                    Olá, Iara! A cópia de segurança completa do sistema <strong>Alpha Soluções Condominiais</strong> foi gerada com sucesso e está anexada a este e-mail.
                  </p>
                  
                  <div style="background-color: #0f172a; padding: 16px; border-radius: 12px; margin: 20px 0; border: 1px solid #334155;">
                    <p style="margin: 4px 0; font-size: 13px;">📅 <strong>Data de Referência:</strong> ${agora.toLocaleDateString('pt-BR')} às ${agora.toLocaleTimeString('pt-BR')}</p>
                    <p style="margin: 4px 0; font-size: 13px;">📑 <strong>Total de Registros:</strong> ${totalDocs} itens salvos</p>
                    <p style="margin: 4px 0; font-size: 13px;">📂 <strong>Coleções Exportadas:</strong> ${COLECOES_SISTEMA.length} categorias (moradores, condomínios, financeiro, boletos, manutenções, cotações, notas fiscais, etc.)</p>
                    <p style="margin: 4px 0; font-size: 13px;">📁 <strong>Arquivo Anexo:</strong> ${nomeArquivo}</p>
                  </div>

                  <p style="font-size: 12px; color: #94a3b8; line-height: 1.5;">
                    Este arquivo JSON preserva todos os dados do banco de dados na nuvem. Você pode guardá-lo com segurança no seu Google Drive ou usá-lo para restauração a qualquer momento.
                  </p>
                  
                  <hr style="border: none; border-top: 1px solid #334155; margin: 20px 0;" />
                  <p style="font-size: 11px; color: #64748b; text-align: center; margin-bottom: 0;">
                    Alpha Soluções Condominiais • Gestão Inteligente & Segura
                  </p>
                </div>
              </div>
            `,
            attachments: [
              {
                filename: nomeArquivo,
                content: Buffer.from(jsonStr, 'utf-8'),
                contentType: 'application/json'
              }
            ]
          };

          await transporter.sendMail(mailOptions);
          emailStatus = { enviado: true, destino: destinoEmail };
        } else {
          emailStatus = { enviado: false, motivo: 'GMAIL_APP_PASSWORD não configurada' };
        }
      } catch (mailErr) {
        console.error('Erro ao enviar backup por e-mail:', mailErr);
        emailStatus = { enviado: false, erro: mailErr.message };
      }
    }

    // Se o pedido for para download direto no navegador
    if (req.query?.download === 'true') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
      return res.status(200).send(jsonStr);
    }

    // Retorno estruturado para consumo de APIs (n8n, Google Drive, integrações, frontend)
    return res.status(200).json({
      success: true,
      dataCriacao: agora.toISOString(),
      dataReferencia: agora.toLocaleDateString('pt-BR'),
      nomeArquivo,
      totalDocumentos: totalDocs,
      colecoes: Object.keys(dadosExportados),
      resumoColecoes: Object.entries(dadosExportados).map(([nome, docs]) => ({
        nome,
        total: docs.length
      })),
      emailStatus,
      payload: dadosExportados
    });
  } catch (error) {
    console.error('Erro na execução do backup do sistema:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Falha ao gerar o arquivo de backup'
    });
  }
}
