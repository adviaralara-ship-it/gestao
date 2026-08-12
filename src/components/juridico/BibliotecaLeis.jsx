import React, { useState } from 'react'
import { BookOpen, Scale, Landmark, MapPin, Building, ChevronDown, Bot, Briefcase, ExternalLink } from 'lucide-react'

export default function BibliotecaLeis() {
  const [openLaw, setOpenLaw] = useState(null)

  const leis = [
    {
      id: 'codigo-civil',
      icone: <Scale className="text-brand-600" size={24} />,
      titulo: 'Código Civil (Condomínios)',
      resumo: 'Art. 1.331 a 1.358 do Código Civil Brasileiro',
      link: 'https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm',
      conteudo: `O Código Civil de 2002 estabelece as regras gerais para condomínios edilícios.
- Art. 1.336: São deveres do condômino: I - contribuir para as despesas do condomínio na proporção das suas frações ideais; II - não realizar obras que comprometam a segurança da edificação; III - não alterar a forma e a cor da fachada, das partes e esquadrias externas; IV - dar às suas partes a mesma destinação que tem a edificação, e não as utilizar de maneira prejudicial ao sossego, salubridade e segurança dos possuidores, ou aos bons costumes.
- Art. 1.348: Compete ao síndico: representar, ativa e passivamente, o condomínio, praticando, em juízo ou fora dele, os atos necessários à defesa dos interesses comuns.`
    },
    {
      id: 'lei-inquilinato',
      icone: <Landmark className="text-brand-600" size={24} />,
      titulo: 'Lei do Inquilinato (Imobiliário)',
      resumo: 'Lei nº 8.245/1991',
      link: 'https://www.planalto.gov.br/ccivil_03/leis/l8245.htm',
      conteudo: `Lei que regula as locações dos imóveis urbanos e os procedimentos a elas pertinentes.
- Art. 22. O locador é obrigado a: I - entregar ao locatário o imóvel alugado em estado de servir ao uso a que se destina; X - pagar as despesas extraordinárias de condomínio.
- Art. 23. O locatário é obrigado a: XII - pagar as despesas ordinárias de condomínio (salários, limpeza, manutenção).`
    },
    {
      id: 'convencao-jp',
      icone: <MapPin className="text-brand-600" size={24} />,
      titulo: 'Legislação e Convenções - João Pessoa (PB)',
      resumo: 'Leis Municipais e Convenção Sindical',
      link: 'https://www.joaopessoa.pb.gov.br/',
      conteudo: `Regras específicas do município de João Pessoa:
- Código de Posturas do Município: Regula os limites de emissão sonora (Lei do Silêncio), descarte de resíduos da construção civil em caçambas e manutenção de calçadas.
- SINDIFICIOS-PB (Sindicato dos Empregados em Edifícios de João Pessoa): O piso salarial vigente para porteiros e zeladores deve respeitar a convenção coletiva anual. Adicional de insalubridade de 20% para funcionários que realizam a coleta de lixo nas dependências do condomínio.`
    },
    {
      id: 'lei-condominio',
      icone: <Building className="text-brand-600" size={24} />,
      titulo: 'Lei do Condomínio',
      resumo: 'Lei nº 4.591/1964',
      link: 'https://www.planalto.gov.br/ccivil_03/leis/l4591.htm',
      conteudo: `Dispõe sobre o condomínio em edificações e as incorporações imobiliárias. Grande parte foi substituída pelo Código Civil, mas a parte de incorporação imobiliária (Capítulo I) continua em pleno vigor, ditando as regras de construção e entrega de condomínios por construtoras.`
    },
    {
      id: 'responsabilidade-sindico',
      icone: <Scale className="text-brand-600" size={24} />,
      titulo: 'Responsabilidade Civil e Criminal do Síndico',
      resumo: 'Art. 186, 927 e Art. 1.348 do Código Civil',
      link: 'https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm',
      conteudo: `O síndico pode responder com seu patrimônio pessoal ou sofrer sanções penais caso haja negligência, imprudência ou má-fé na gestão.
- Responsabilidade Civil: Ocorre quando as atribuições não são cumpridas adequadamente, causando prejuízos ao condomínio ou a terceiros (Ex: não realizar manutenção e uma marquise cair).
- Responsabilidade Criminal: Envolve crimes contra a honra (difamação de moradores), apropriação indébita (desvio de fundos) ou negligência extrema que resulte em lesão corporal ou morte nas dependências do condomínio.`
    },
    {
      id: 'sindico-profissional',
      icone: <Briefcase className="text-brand-600" size={24} />,
      titulo: 'Síndico Profissional / Gerente Contratado',
      resumo: 'Art. 1.347 do Código Civil',
      link: 'https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm',
      conteudo: `A lei exige que todo condomínio tenha um representante legal (o "Síndico"). No entanto, ele NÃO precisa ser um morador.
- Art. 1.347: A assembleia poderá escolher um síndico, que NÃO seja condômino (morador), para administrar o condomínio, por prazo não superior a dois anos, o qual poderá renovar-se.
- Isso permite a contratação de um Gerente Profissional, Síndico Profissional ou uma Empresa Administradora para assumir a responsabilidade legal e operacional do condomínio, mediante remuneração aprovada em assembleia.`
    }
  ]

  return (
    <div className="bg-white rounded-xl shadow-sm border border-cream-200 p-6 animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <BookOpen size={20} className="text-brand-600" />
            Biblioteca de Leis e Regras
          </h3>
          <p className="text-sm text-gray-500">
            Consulte as principais leis sobre condomínios, mercado imobiliário e convenções de João Pessoa. <br/>
            Esses dados são usados pela <strong>Alpha Assist (IA)</strong>.
          </p>
        </div>
        <button 
          onClick={() => window.dispatchEvent(new CustomEvent('open-ai-chat'))}
          className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
          title="Abrir Chat da IA"
        >
          <Bot size={14}/> IA Integrada
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {leis.map(lei => (
          <div key={lei.id} className="border border-cream-300 rounded-xl overflow-hidden">
            <button 
              className="w-full text-left p-4 flex items-center justify-between bg-gray-50 hover:bg-cream-100 transition-colors"
              onClick={() => setOpenLaw(openLaw === lei.id ? null : lei.id)}
            >
              <div className="flex items-center gap-4">
                <div className="bg-white p-2 rounded-lg shadow-sm border border-cream-200">
                  {lei.icone}
                </div>
                <div>
                  <h4 className="font-bold text-gray-800">{lei.titulo}</h4>
                  <p className="text-xs text-gray-500">{lei.resumo}</p>
                </div>
              </div>
              <ChevronDown size={20} className={`text-gray-400 transition-transform ${openLaw === lei.id ? 'rotate-180' : ''}`} />
            </button>
            
            {openLaw === lei.id && (
              <div className="p-4 bg-white border-t border-cream-200">
                <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed mb-4">
                  {lei.conteudo}
                </p>
                {lei.link && (
                  <a 
                    href={lei.link} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-800 bg-brand-50 hover:bg-brand-100 px-4 py-2 rounded-lg transition-colors"
                  >
                    <ExternalLink size={16} />
                    Ler legislação na íntegra
                  </a>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
