export default async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  )

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const clientId = process.env.CORA_CLIENT_ID
  const clientSecret = process.env.CORA_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Credenciais do Cora não configuradas no servidor.' })
  }

  try {
    const { nome, cpf, email, valor, vencimento, descricao } = req.body

    if (!nome || !cpf || !valor || !vencimento) {
      return res.status(400).json({ error: 'Faltam dados obrigatórios (Nome, CPF, Valor, Vencimento).' })
    }

    // 1. Obter o Token de Acesso do Cora
    const tokenResponse = await fetch('https://matriz.cora.com.br/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret
      })
    })

    if (!tokenResponse.ok) {
      const err = await tokenResponse.text()
      console.error('Erro de Autenticação Cora:', err)
      return res.status(500).json({ error: 'Falha na autenticação com o banco Cora.' })
    }

    const { access_token } = await tokenResponse.json()

    // 2. Criar a Cobrança (Boleto)
    const boletoPayload = {
      code: "BOL-" + Date.now(),
      customer: {
        name: nome,
        document: cpf.replace(/\D/g, ''),
        email: email || ''
      },
      services: [
        {
          name: descricao || "Taxa de Condomínio",
          amount: Math.round(Number(valor) * 100) // em centavos
        }
      ],
      payment_terms: {
        due_date: vencimento // YYYY-MM-DD
      },
      payment_forms: ["BANK_SLIP", "PIX"]
    }

    const boletoResponse = await fetch('https://matriz.cora.com.br/invoices', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `IDEMP-${Date.now()}`
      },
      body: JSON.stringify(boletoPayload)
    })

    if (!boletoResponse.ok) {
      const err = await boletoResponse.json()
      console.error('Erro ao emitir boleto Cora:', err)
      return res.status(400).json({ error: 'Erro ao registrar o boleto no Cora.', details: err })
    }

    const boletoData = await boletoResponse.json()

    // boletoData contains url, barcode, pix
    return res.status(200).json({
      success: true,
      invoice_id: boletoData.id,
      url: boletoData.payment_options?.bank_slip?.url,
      barcode: boletoData.payment_options?.bank_slip?.barcode,
      pix_emv: boletoData.payment_options?.pix?.emv
    })

  } catch (error) {
    console.error('Erro interno na emissão Cora:', error)
    return res.status(500).json({ error: 'Erro interno ao processar a requisição.' })
  }
}
