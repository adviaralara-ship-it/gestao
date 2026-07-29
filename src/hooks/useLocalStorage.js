import { useState, useEffect } from 'react'

/**
 * useLocalStorage — substituto para useState que persiste no localStorage.
 * Dados são carregados ao montar e salvos automaticamente em cada mudança.
 * @param {string} key  — chave única no localStorage (ex: 'alpha_moradores')
 * @param {any} init    — valor inicial se não houver nada salvo
 */
export function useLocalStorage(key, init) {
  const [value, setValue] = useState(() => {
    try {
      const saved = localStorage.getItem(key)
      return saved !== null ? JSON.parse(saved) : init
    } catch {
      return init
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {}
  }, [key, value])

  return [value, setValue]
}
