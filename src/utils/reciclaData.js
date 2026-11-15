// src/utils/reciclaData.js
// Catálogo Oficial das 10 Campanhas Educativas do Programa Alpha Recicla +
// Identidade Visual Alpha Soluções Condominiais: Profissional, Seguro e Acolhedor

export const TEMAS_RECICLA = [
  'Como separar o lixo em casa',
  'Diferença entre recicláveis e rejeitos',
  'Descarte correto de papelão',
  'Descarte de garrafas e embalagens',
  'Cuidados com restos de alimentos',
  'Descarte de óleo de cozinha',
  'Descarte de pilhas e baterias',
  'Como manter a lixeira organizada',
  'Redução do desperdício',
  'Preservação das áreas comuns'
]

export const CAMPANHAS_PADRAO = [
  {
    idPadrao: 'recicla-01-separacao-em-casa',
    temaId: 1,
    tema: 'Como separar o lixo em casa',
    nome: 'Separação Prática: O Básico Bem Feito em Casa',
    dicaRapida: 'Tenha apenas duas lixeiras em casa: uma para recicláveis secos e outra para lixo comum/rejeitos.',
    sugestaoMaterial: 'Infográfico A4 - Guia dos 2 Baldes Domésticos',
    texto: `Olá, {{nome_morador}}! Tudo bem? 🌱

Você sabia que separar o lixo em casa pode ser muito mais simples do que parece? No {{nome_condominio}}, pequenas atitudes diárias transformam nossa comunidade e preservam o meio ambiente.

💡 *Regra de Ouro dos 2 Baldes:*
1️⃣ *Lixo Comum / Orgânico:* Restos de comida, cascas, papel higiênico, guardanapos sujos e esponjas usadas.
2️⃣ *Recicláveis Secos:* Papéis limpos, papelão, plásticos, latinhas de alumínio e garrafas de vidro.

Basta manter os recicláveis limpos e secos antes de depositar na lixeira do condomínio. Contamos com a sua colaboração para fazer do {{nome_condominio}} uma referência em sustentabilidade!

_Alpha Soluções Condominiais • Programa Recicla +_`,
    status: 'Ativa',
    condominio: 'Todos'
  },
  {
    idPadrao: 'recicla-02-reciclaveis-vs-rejeitos',
    temaId: 2,
    tema: 'Diferença entre recicláveis e rejeitos',
    nome: 'Reciclável ou Rejeito? Aprenda a Identificar em Segundos',
    dicaRapida: 'Papel engordurado, fitas adesivas e cerâmicas NÃO são recicláveis; descarte no lixo comum.',
    sugestaoMaterial: 'Tabela Visual Comparativa - O que Pode e o que Não Pode',
    texto: `Olá, {{nome_morador}}! Tudo bem? ♻️

Muitas vezes temos dúvida na hora de descartar algum material: será que vai pro reciclável ou pro lixo comum? No {{nome_condominio}}, entender essa diferença evita a contaminação de lotes inteiros de reciclagem!

✅ *RECICLÁVEIS (Secos & Limpos):*
• Garrafas PET, potes plásticos e tampinhas
• Latas de alumínio e embalagens metálicas
• Caixas de papelão e papel de escritório
• Vidros inteiros (garrafas e potes)

❌ *REJEITOS (Lixo Comum):*
• Papel higiênico, lenços e fraldas descartáveis
• Guardanapos e caixas de pizza engorduradas
• Espelhos, cerâmicas e louças quebradas
• Esponjas de lavar louça e fitas adesivas

Cada item no lugar certo valoriza o trabalho das cooperativas e o nosso condomínio! Obrigado pela parceria!

_Alpha Soluções Condominiais • Programa Recicla +_`,
    status: 'Ativa',
    condominio: 'Todos'
  },
  {
    idPadrao: 'recicla-03-descarte-papelao',
    temaId: 3,
    tema: 'Descarte correto de papelão',
    nome: 'Papelão e Encomendas: Desmonte Antes de Descartar',
    dicaRapida: 'Desmontar e achatar caixas de encomendas economiza até 70% do espaço na lixeira coletiva.',
    sugestaoMaterial: 'Cartaz Informativo para o Hall de Lixeiras e Encomendas',
    texto: `Olá, {{nome_morador}}! Tudo bem? 📦

Com o aumento das entregas e compras online, o volume de caixas de papelão cresceu bastante no {{nome_condominio}}. Uma única caixa inteira ocupa o espaço de quase 10 caixas desmontadas na nossa lixeira coletiva!

👉 *Passo a passo rápido para descarte de caixas:*
1. Abra o fundo da caixa e remova as fitas adesivas plásticas.
2. Achate completamente a caixa de papelão.
3. Se a caixa molhou ou engordurou (ex: caixa de pizza com resíduos), descarte no lixo comum, pois gordura impede a reciclagem.
4. Deposite as caixas achatadas na área de recicláveis secos.

Com esse gesto de menos de 1 minuto, evitamos que a lixeira transborde e mantemos os corredores limpos e organizados!

_Alpha Soluções Condominiais • Programa Recicla +_`,
    status: 'Ativa',
    condominio: 'Todos'
  },
  {
    idPadrao: 'recicla-04-garrafas-embalagens',
    temaId: 4,
    tema: 'Descarte de garrafas e embalagens',
    nome: 'Garrafas e Potes: Dê um Enxágue Rápido Antes do Descarte',
    dicaRapida: 'Um enxágue rápido com água de reúso evita mau cheiro, baratas e preserva o material.',
    sugestaoMaterial: 'Checklist de Higienização Rápida de Embalagens',
    texto: `Olá, {{nome_morador}}! Tudo bem? 🧴

Sabia que embalagens descartadas com restos de líquidos ou alimentos atraem insetos para a lixeira do {{nome_condominio}} e contaminam os materiais dos vizinhos?

✨ *Como descartar embalagens plásticas e de vidro:*
• Dê um enxágue rápido com água de reúso (não precisa gastar sabão).
• Deixe escorrer o excesso de líquido.
• Amasse garrafas PET para reduzir volume e coloque a tampa (tampinhas também são recicladas!).
• Para vidros quebrados: embale SEMPRE dentro de uma garrafa PET cortada ou caixa de leite fechada, para proteger a integridade física dos nossos zeladores e coletores!

Cuidar do descarte é cuidar de quem cuida do nosso condomínio. Agradecemos o seu apoio!

_Alpha Soluções Condominiais • Programa Recicla +_`,
    status: 'Ativa',
    condominio: 'Todos'
  },
  {
    idPadrao: 'recicla-05-restos-alimentos',
    temaId: 5,
    tema: 'Cuidados com restos de alimentos',
    nome: 'Lixo Orgânico: Como Embalar Restos Sem Vazamentos ou Odores',
    dicaRapida: 'Escorra bem caldos e líquidos e dê dois nós firmes no saco de lixo orgânico.',
    sugestaoMaterial: 'Guia Rápido de Vedação e Sacos Adequados para Resíduos Úmidos',
    texto: `Olá, {{nome_morador}}! Tudo bem? 🍎

Restos de alimentos e matéria orgânica exigem atenção especial na hora do descarte para manter o {{nome_condominio}} sempre limpo, sem odores e livre de pragas urbanas.

🍃 *Dicas essenciais para o descarte orgânico:*
• Escorra caldos e líquidos na pia antes de colocar no lixo.
• Utilize sacos de lixo resistentes e de espessura adequada.
• Dê um nó bem apertado antes de transportar até a lixeira do andar ou contêiner.
• Nunca deixe sacolas depositadas no chão do hall dos elevadores ou escadarias.

Esse respeito mútuo mantém as áreas comuns sempre agradáveis para todos os moradores e visitas. Muito obrigado!

_Alpha Soluções Condominiais • Programa Recicla +_`,
    status: 'Ativa',
    condominio: 'Todos'
  },
  {
    idPadrao: 'recicla-06-oleo-cozinha',
    temaId: 6,
    tema: 'Descarte de óleo de cozinha',
    nome: 'Óleo de Cozinha: Jamais na Pia! Guarde em Garrafa PET',
    dicaRapida: '1 litro de óleo na pia contamina até 25.000 litros de água e entope canos do prédio.',
    sugestaoMaterial: 'Flyer Digital - Rota do Óleo de Cozinha Sustentável',
    texto: `Olá, {{nome_morador}}! Tudo bem? 🍳

Você sabia que despejar óleo de fritura na pia da cozinha é a principal causa de entupimento das tubulações e caixas de gordura do {{nome_condominio}}? Além do prejuízo financeiro com manutenções caras, o óleo polui as águas da nossa região.

🛢️ *Como descartar seu óleo usado com segurança:*
1. Espere o óleo esfriar totalmente após frituras.
2. Com a ajuda de um funil, armazene-o em uma garrafa PET descartável.
3. Feche bem a tampa para não vazar.
4. Quando a garrafa encher, entregue no ponto de coleta de óleo do condomínio ou na portaria.

O óleo recolhido pela Alpha é destinado a parceiros para fabricação de sabão ecológico e biocombustível! Participe!

_Alpha Soluções Condominiais • Programa Recicla +_`,
    status: 'Ativa',
    condominio: 'Todos'
  },
  {
    idPadrao: 'recicla-07-pilhas-baterias',
    temaId: 7,
    tema: 'Descarte de pilhas e baterias',
    nome: 'Pilhas e Baterias: Perigo de Contaminação Química no Lixo Comum',
    dicaRapida: 'Metais pesados tóxicos vazam no solo; descarte exclusivamente no Papa-Pilhas da portaria.',
    sugestaoMaterial: 'Placa Identificadora para o Coletor de Lixo Eletrônico na Portaria',
    texto: `Olá, {{nome_morador}}! Tudo bem? 🔋

Pilhas, baterias de celular e pequenos aparelhos eletrônicos contêm chumbo, mercúrio e cádmio — metais pesados altamente tóxicos que NUNCA devem ser misturados ao lixo comum do {{nome_condominio}}!

⚡ *O que fazer com pilhas e baterias velhas:*
• Junte em um recipiente fechado na sua residência.
• Se notar vazamento ou ferrugem, isole as pontas com fita adesiva.
• Deposite no coletor Papa-Pilhas disponível na portaria / zeladoria do condomínio.

A administração faz a destinação correta através de logística reversa certificada, impedindo a contaminação do solo e da água. Faça a sua parte!

_Alpha Soluções Condominiais • Programa Recicla +_`,
    status: 'Ativa',
    condominio: 'Todos'
  },
  {
    idPadrao: 'recicla-08-organizacao-lixeira',
    temaId: 8,
    tema: 'Como manter a lixeira organizada',
    nome: 'Lixeira Coletiva: Gentileza e Higiene que Todo Vizinho Agradece',
    dicaRapida: 'Lixo sempre dentro das lixeiras com tampas fechadas; nunca sacos deixados no chão.',
    sugestaoMaterial: 'Adesivos de Sinalização para Contêineres de Coleta Seletiva',
    texto: `Olá, {{nome_morador}}! Tudo bem? 🗑️

A área de descarte de resíduos do {{nome_condominio}} é um espaço coletivo essencial e reflete diretamente o nível de cuidado e valorização do nosso patrimônio.

🤝 *Regras de Boa Convivência na Lixeira:*
• Deposite os sacos de lixo SEMPRE dentro dos contêineres apropriados (nunca no chão).
• Mantenha a tampa das lixeiras sempre fechada após o uso (evita odores, moscas e animais).
• Respeite as cores e sinalizações de 'Orgânico/Comum' e 'Reciclável Seco'.
• Nunca deixe objetos pontiagudos ou cortantes soltos sem proteção.

Uma lixeira limpa e bem cuidada é um direito e um dever de todos nós. Agradecemos a colaboração!

_Alpha Soluções Condominiais • Programa Recicla +_`,
    status: 'Ativa',
    condominio: 'Todos'
  },
  {
    idPadrao: 'recicla-09-reducao-desperdicio',
    temaId: 9,
    tema: 'Redução do desperdício',
    nome: 'Consumo Consciente: Dicas Práticas para Reduzir o Lixo Diário',
    dicaRapida: 'O melhor resíduo é aquele que não é gerado: adote sacolas retornáveis e garrafas térmicas.',
    sugestaoMaterial: 'Guia de Hábitos Minimalistas e Sustentáveis para Condomínios',
    texto: `Olá, {{nome_morador}}! Tudo bem? 🌍

Ainda melhor do que reciclar é evitar a geração excessiva de resíduos! No {{nome_condominio}}, valorizamos atitudes sustentáveis que trazem economia financeira e qualidade de vida.

🌱 *3 Hábitos Simples para Reduzir o Desperdício:*
1. *Prefira reutilizáveis:* Troque sacolas plásticas por ecobags e dispense copos descartáveis.
2. *Aproveitamento integral dos alimentos:* Talos, folhas e cascas enriquecem receitas e reduzem o volume de lixo úmido.
3. *Economia de recursos:* Feche a torneira ao escovar os dentes e relate qualquer goteira em áreas comuns.

Praticar o consumo consciente hoje é garantir qualidade de vida para as próximas gerações. Vamos juntos!

_Alpha Soluções Condominiais • Programa Recicla +_`,
    status: 'Ativa',
    condominio: 'Todos'
  },
  {
    idPadrao: 'recicla-10-preservacao-areas-comuns',
    temaId: 10,
    tema: 'Preservação das áreas comuns',
    nome: 'Áreas Verdes e Lazer: Nosso Refúgio Coletivo Bem Cuidado',
    dicaRapida: 'Bitucas nas floreiras e chicletes no piso degradam o patrimônio de todos os moradores.',
    sugestaoMaterial: 'Manual de Convivência Sustentável em Áreas de Lazer e Jardins',
    texto: `Olá, {{nome_morador}}! Tudo bem? 🌳

Os jardins, piscinas, halls e garagens do {{nome_condominio}} formam a extensão da nossa casa. Viver em um ambiente verde, limpo e harmonioso valoriza o imóvel e proporciona momentos inesquecíveis para toda a família!

✨ *Como preservar o que é de todos:*
• Nunca atire bitucas de cigarro pela janela, nas garagens ou floreiras — além de poluir, gera risco de incêndio.
• Ao circular com seu animalzinho de estimação, recolha as fezes imediatamente com saquinhos adequados.
• Ao desfrutar do espaço gourmet, salão de festas ou quiosque, embale todos os resíduos e deixe o local pronto para o próximo vizinho.

Condomínio sustentável e bem preservado é orgulho para quem mora e referência para quem visita. Conte sempre com a Alpha!

_Alpha Soluções Condominiais • Programa Recicla +_`,
    status: 'Ativa',
    condominio: 'Todos'
  }
]

/**
 * Interpola variáveis de mensagem dinâmicas: {{nome_morador}} e {{nome_condominio}}
 * Suporta espaços internos opcionais como {{ nome_morador }} e insensibilidade a maiúsculas
 */
export function interpolarMensagem(texto = '', { nomeMorador = 'Morador(a)', nomeCondominio = 'Condomínio' } = {}) {
  if (!texto) return ''
  
  // Tratamento refinado do nome do morador (remove títulos comuns se houver segundo nome)
  let primeiroNome = 'Morador(a)'
  if (nomeMorador && typeof nomeMorador === 'string') {
    const partes = nomeMorador.trim().split(/\s+/).filter(Boolean)
    if (partes.length > 0) {
      const primeiro = partes[0]
      const titulos = ['sr', 'sra', 'sr.', 'sra.', 'dr', 'dra', 'dr.', 'dra.', 'dona', 'seu']
      if (titulos.includes(primeiro.toLowerCase()) && partes.length > 1) {
        primeiroNome = `${primeiro} ${partes[1]}`
      } else {
        primeiroNome = primeiro
      }
    }
  }

  const condoNome = (nomeCondominio && typeof nomeCondominio === 'string' && nomeCondominio.trim())
    ? nomeCondominio.trim()
    : 'Condomínio'

  return texto
    .replace(/\{\{\s*nome_morador\s*\}\}/gi, primeiroNome)
    .replace(/\{\{\s*nome_condominio\s*\}\}/gi, condoNome)
}

/**
 * Normaliza e sanitiza número de telefone celular brasileiro para o padrão E.164 (55 + DDD + 9 dígitos)
 * Trata automaticamente operadoras de longa distância (ex: 015, 021), zeros à esquerda e DDI 55.
 */
export function normalizarTelefone(numero = '') {
  if (!numero) return ''
  let digits = String(numero).replace(/\D/g, '')

  if (!digits || digits.length < 10) return ''

  // Se tiver 13 dígitos e começar com 55 (formato E.164 já pronto)
  if (digits.length === 13 && digits.startsWith('55')) {
    return digits
  }

  // Se tiver 12 dígitos e começar com 55 (formato legado de 8 dígitos)
  if (digits.length === 12 && digits.startsWith('55')) {
    return digits
  }

  // Se o número tiver mais de 11 dígitos (por exemplo com prefixo de operadora 015, 021, ou 55 com operadora),
  // no Brasil o telefone celular é composto exatamente pelos últimos 11 dígitos (DDD de 2 dígitos + celular de 9 dígitos).
  if (digits.length >= 11) {
    const ultimos11 = digits.slice(-11)
    // Verifica se os últimos 11 começam com DDD válido (11 a 99) e celular iniciando com 9
    const ddd = parseInt(ultimos11.slice(0, 2), 10)
    const primeiroDigitoCelular = ultimos11[2]
    if (ddd >= 11 && ddd <= 99 && primeiroDigitoCelular === '9') {
      return `55${ultimos11}`
    }
  }

  // Telefone fixo ou formato legado de 10 dígitos (DDD + 8 dígitos)
  if (digits.length === 10) {
    return `55${digits}`
  }

  // Se começar com zero e tiver 11 dígitos (ex: 0 + DDD + 8 dígitos)
  if (digits.length === 11 && digits.startsWith('0')) {
    return `55${digits.slice(1)}`
  }

  return ''
}

/**
 * Validação rigorosa de telefone para recebimento de WhatsApp
 */
export function validarTelefoneWhatsApp(numero = '') {
  if (!numero || String(numero).trim() === '') {
    return { valido: false, numeroE164: '', motivo: 'Telefone ausente' }
  }

  const e164 = normalizarTelefone(numero)
  if (!e164) {
    return { valido: false, numeroE164: '', motivo: 'Formato inválido ou incompleto (menos de 10 dígitos)' }
  }

  // Analisa código de área e prefixo
  // Exemplo E.164: 55 83 988887777 -> ddd: 83, numeroLocal: 988887777
  const ddd = e164.slice(2, 4)
  const local = e164.slice(4)

  // DDDs válidos no Brasil variam de 11 a 99
  const dddNum = parseInt(ddd, 10)
  if (isNaN(dddNum) || dddNum < 11 || dddNum > 99) {
    return { valido: false, numeroE164: e164, motivo: `DDD (${ddd}) inexistente no Brasil` }
  }

  // Celulares no Brasil possuem 9 dígitos e começam com o dígito 9
  if (local.length === 8) {
    const primeiroDigito = local[0]
    if (['2', '3', '4', '5'].includes(primeiroDigito)) {
      return { valido: false, numeroE164: e164, motivo: 'Telefone fixo residencial (não suporta WhatsApp)' }
    }
    return { valido: false, numeroE164: e164, motivo: 'Número celular incompleto (formato antigo de 8 dígitos)' }
  }

  if (local.length === 9) {
    if (local[0] !== '9') {
      return { valido: false, numeroE164: e164, motivo: 'Número inválido (celular brasileiro deve iniciar com 9)' }
    }
    return { valido: true, numeroE164: e164, motivo: 'Válido' }
  }

  return { valido: false, numeroE164: e164, motivo: 'Extensão de dígitos incompatível' }
}

/**
 * Filtra e higieniza lista de moradores para disparos seguros:
 * - Exclui moradores com opt-out ativo (LGPD)
 * - Exclui telefones ausentes, fixos ou inválidos
 * - Remove duplicações de telefone no mesmo condomínio (evita mensagens repetidas para a mesma linha)
 */
export function filtrarMoradoresElegiveis(moradoresList = [], optoutSet = new Set()) {
  const elegiveis = []
  const bloqueadosOptOut = []
  const telefonesInvalidos = []
  const telefonesDuplicados = []
  const telefonesProcessados = new Set()

  for (const m of moradoresList) {
    const rawTel = m.tel || m.telefone || m.whatsapp || m.celular || ''
    const telLimpo = String(rawTel).replace(/\D/g, '')
    const telE164 = normalizarTelefone(rawTel)

    // 1. Checagem de Opt-out (pelo ID do morador OU pelo telefone)
    const isOptOut = optoutSet.has(String(m.id)) ||
                     (telLimpo && optoutSet.has(telLimpo)) ||
                     (telE164 && optoutSet.has(telE164))

    if (isOptOut) {
      bloqueadosOptOut.push({ ...m, motivoBloqueio: 'Opt-out solicitado (LGPD)' })
      continue
    }

    // 2. Validação do Telefone
    const validacao = validarTelefoneWhatsApp(rawTel)
    if (!validacao.valido) {
      telefonesInvalidos.push({ ...m, motivoInvalido: validacao.motivo, telefoneOriginal: rawTel })
      continue
    }

    // 3. Controle de Duplicidade (mesmo telefone celular para múltiplos moradores do condomínio)
    if (telefonesProcessados.has(validacao.numeroE164)) {
      telefonesDuplicados.push({
        ...m,
        motivoDuplicado: 'Telefone compartilhado já listado para disparo neste lote',
        telefoneE164: validacao.numeroE164
      })
      continue
    }

    // Adiciona aos elegíveis e registra telefone processado
    telefonesProcessados.add(validacao.numeroE164)
    elegiveis.push({
      ...m,
      telefoneE164: validacao.numeroE164
    })
  }

  return {
    elegiveis,
    bloqueadosOptOut,
    telefonesInvalidos,
    telefonesDuplicados,
    estatisticas: {
      totalCadastrados: moradoresList.length,
      elegiveisCount: elegiveis.length,
      optOutCount: bloqueadosOptOut.length,
      invalidosCount: telefonesInvalidos.length,
      duplicadosCount: telefonesDuplicados.length
    }
  }
}

/**
 * Gera chave única de idempotência para fila de disparos (impede disparos duplicados)
 */
export function gerarChaveIdempotencia(campanhaId, moradorId, telefone) {
  const telLimpo = String(telefone || '').replace(/\D/g, '')
  return `${campanhaId}_${moradorId}_${telLimpo}`
}
