import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import crypto from 'crypto'

/**
 * Validação de Assinatura Criptográfica do Webhook Cora
 */
function verifyCoraWebhookSignature(req) {
  const webhookSecret = process.env.CORA_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.warn('CORA_WEBHOOK_SECRET não configurado no servidor.');
    return false;
  }
  
  // 1. Verificação por token em header ou query
  const authHeader = req.headers['authorization'] || '';
  const tokenHeader = req.headers['x-cora-token'] || req.headers['x-webhook-secret'] || '';
  const queryToken = req.query?.token || '';

  if (authHeader === `Bearer ${webhookSecret}` || tokenHeader === webhookSecret || queryToken === webhookSecret) {
    return true;
  }

  // 2. Verificação por assinatura HMAC se o Cora enviar x-cora-signature
  const signature = req.headers['x-cora-signature'];
  if (signature) {
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return true;
    }
  }

  return false;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed')
  }

  // ─── Validação obrigatória da assinatura do Webhook ─────────────────────
  if (!verifyCoraWebhookSignature(req)) {
    console.warn('Tentativa de acesso não autorizado ao Webhook Cora rejeitada.')
    return res.status(401).json({ error: 'Unauthorized: Assinatura de webhook inválida ou ausente.' })
  }

  try {
    const event = req.body
    
    // Check if it's an invoice payment event
    if (event && event.type === 'invoice.paid' && event.data && event.data.invoice) {
      const invoiceId = event.data.invoice.id

      if (!getApps().length) {
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
          initializeApp({
            credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
          })
        } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
          initializeApp({
            credential: cert({
              projectId: process.env.FIREBASE_PROJECT_ID,
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
              privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
            })
          })
        } else {
          initializeApp({
            projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'alphaadmsc-fdc4e'
          })
        }
      }
      const db = getFirestore()
      
      // Find the boleto with this invoice_id in Firestore
      const boletosRef = db.collection('boletos')
      const q = await boletosRef.where('invoice_id', '==', invoiceId).get()
      
      if (!q.empty) {
        const doc = q.docs[0]
        await doc.ref.update({
          status: 'Pago',
          dataPagamento: new Date().toISOString(),
          conciliadoEm: new Date().toISOString(),
          origemBaixa: 'Webhook Cora Verificado'
        })
        console.log(`Boleto ${invoiceId} marcado como Pago via Webhook Seguro`)
      } else {
        console.warn(`Boleto ${invoiceId} não encontrado no Firestore`)
      }
    }
    
    // Acknowledge webhook
    return res.status(200).json({ success: true, message: 'Webhook processado com sucesso.' })

  } catch (error) {
    console.error('Webhook Error:', error)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
}
