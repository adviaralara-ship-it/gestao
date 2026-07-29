import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// You must set FIREBASE_SERVICE_ACCOUNT in Vercel with the JSON of the Firebase Admin SDK to allow backend to write to Firestore
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed')
  }

  try {
    const event = req.body
    
    // Check if it's an invoice payment event
    if (event && event.type === 'invoice.paid' && event.data && event.data.invoice) {
      const invoiceId = event.data.invoice.id

      if (!getApps().length) {
        if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
          console.error("FIREBASE_SERVICE_ACCOUNT is missing")
          return res.status(500).send('Server Error')
        }
        initializeApp({
          credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
        })
      }
      const db = getFirestore()
      
      // Find the boleto with this invoice_id in Firestore
      const boletosRef = db.collection('boletos')
      const q = await boletosRef.where('invoice_id', '==', invoiceId).get()
      
      if (!q.empty) {
        const doc = q.docs[0]
        await doc.ref.update({
          status: 'Pago',
          dataPagamento: new Date().toISOString()
        })
        console.log(`Boleto ${invoiceId} marked as Paid`)
      } else {
        console.warn(`Boleto ${invoiceId} not found in Firestore`)
      }
    }
    
    // Acknowledge webhook
    res.status(200).send('OK')

  } catch (error) {
    console.error('Webhook Error:', error)
    res.status(500).send('Internal Server Error')
  }
}
