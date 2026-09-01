import React from 'react'

/**
 * Formata um valor numérico ou string numérica com vírgula e separador de milhar no padrão brasileiro.
 * Exemplo: 1250.5 -> "1.250,50"
 */
export function formatCurrency(value) {
  if (value === undefined || value === null || value === '') return ''
  const num = typeof value === 'number' ? value : Number(String(value).replace(/\./g, '').replace(',', '.'))
  if (isNaN(num)) return ''
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

/**
 * Formata entrada em tempo real para máscara de moeda.
 * Digitação progressiva da direita para a esquerda.
 */
export function maskCurrency(value) {
  if (value === undefined || value === null || value === '') return ''
  
  // Se for número vindo do banco (ex: 350 ou 3.5), converte para centavos
  let digits = ''
  if (typeof value === 'number') {
    digits = Math.round(value * 100).toString()
  } else {
    digits = String(value).replace(/\D/g, '')
  }

  if (!digits) return ''
  const num = Number(digits) / 100
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

/**
 * Extrai o valor float numérico a partir da máscara ("1.250,50" -> 1250.50)
 */
export function parseCurrency(value) {
  if (typeof value === 'number') return value
  if (!value) return 0
  const cleanStr = String(value).replace(/\./g, '').replace(',', '.')
  return parseFloat(cleanStr) || 0
}

/**
 * Componente Input de Moeda com prefixo R$ e máscara automática
 */
export function CurrencyInput({
  value,
  onChange,
  className = '',
  placeholder = '0,00',
  disabled = false,
  autoFocus = false,
  id,
  name,
  required = false
}) {
  const displayValue = maskCurrency(value)

  const handleChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '')
    if (!raw) {
      onChange(0)
    } else {
      const num = Number(raw) / 100
      onChange(num)
    }
  }

  return (
    <div className="relative flex items-center">
      <span className="absolute left-3 text-gray-400 font-bold text-xs select-none pointer-events-none">
        R$
      </span>
      <input
        id={id}
        name={name}
        type="text"
        inputMode="numeric"
        disabled={disabled}
        autoFocus={autoFocus}
        required={required}
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        className={`input pl-9 font-mono font-bold ${className}`}
      />
    </div>
  )
}
