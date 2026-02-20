// Formatea un número con separadores de miles sin decimales
export const formatNumber = (value) => {
  if (!value && value !== 0) return ''
  
  // Remover todo excepto números
  const numbers = value.toString().replace(/\D/g, '')
  
  if (!numbers) return ''
  
  // Formatear con separadores de miles (punto como separador)
  return numbers.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

// Parsea un número formateado a número real
export const parseNumber = (value) => {
  if (!value && value !== 0) return 0
  return Number(value.toString().replace(/\./g, ''))
}

