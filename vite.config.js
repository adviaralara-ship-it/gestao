import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Configuração avançada de segurança e blindagem de código (Anti-Engenharia Reversa)
export default defineConfig(({ mode }) => {
  const isProd = mode === 'production'

  return {
    plugins: [
      react()
    ],
    build: {
      // 1. Desabilita completamente a geração de Source Maps (evita exposição do código original .jsx)
      sourcemap: false,
      // 2. Minificação avançada com Terser para ofuscação de identificadores e funções
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: isProd, // Remove todos os console.log / console.info em produção
          drop_debugger: true,  // Remove breakpoints de debugger
          pure_funcs: isProd ? ['console.log', 'console.info', 'console.debug'] : [],
          passes: 2,
        },
        mangle: {
          toplevel: true, // Renomeia variáveis de nível superior para letras mínimas ilegíveis
          safari10: true,
        },
        format: {
          comments: false, // Remove todos os comentários do código-fonte
        },
      },
      cssMinify: true,
      chunkSizeWarningLimit: 3000,
      rollupOptions: {
        output: {
          compact: true,
        }
      }
    }
  }
})
