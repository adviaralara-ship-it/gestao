---
name: alpha-gestao
description: >-
  Instruções oficiais e mapa de arquitetura do sistema Alpha Soluções Condominiais.
---

# Alpha Soluções Condominiais — Skill do Projeto

## Diretórios e Arquivos Chave
- Projeto: `C:\Users\ESCRITORIO\Downloads\Automacao\Gestão`
- GitHub: `https://github.com/adviaralara-ship-it/gestao.git`
- Deploy: `https://app.alphaadmsc.com.br`

## Regras Críticas
1. **Limite Serverless Vercel:** Máximo de 12 funções em `/api`. Nunca ultrapassar 12 arquivos em `/api`.
2. **WhatsApp:** Evolution API `InstanciaAlpha`. Requisições do frontend devem passar por `/api/whatsapp-send`.
3. **Blindagem de Código:** Mantida em `vite.config.js` com Terser e `sourcemap: false`.
4. **Deploy:** `git push origin master` seguido de `npx vercel --prod --yes`.
