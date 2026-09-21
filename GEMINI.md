# 🏢 Projeto Gestão Alpha Soluções (Regras de Contexto & Arquitetura)

Este projeto é um sistema integrado de Gestão Condominial, Locação Imobiliária, RH e Financeiro.
Ao receber comandos sobre este projeto (`C:\Users\ESCRITORIO\Downloads\Automacao\Gestão`), **NÃO faça varreduras completas no diretório**. Vá diretamente aos arquivos mapeados abaixo.

---

## 🛠️ Stack Tecnológica
- **Frontend**: React 19 + Vite + Tailwind CSS (v3 / v4) + Lucide React (ícones) + React Router v7.
- **Backend & Database**: Firebase Firestore (`firebase` v12), Firebase Auth, Firebase Storage.
- **Serverless API**: Vercel Serverless Functions na pasta `/api`.
- **Deploy**: Vercel + Firebase Hosting.

---

## 🗺️ Mapa de Telas e Módulos Principais (`src/pages/`)

| Módulo / Assunto | Arquivo Principal | Descrição / Responsabilidade |
| :--- | :--- | :--- |
| **Locação de Imóveis** | `src/pages/Locacao.jsx` | Contratos de locação (condomínio/avulso), inquilinos, proprietários, repasses. |
| **Inadimplência & Jurídico**| `src/pages/Inadimplencia.jsx` | Cobranças em atraso, régua via WhatsApp, processos jurídicos (`juridico`). |
| **Financeiro & Boletos** | `src/pages/Financeiro.jsx`<br>`src/pages/Boletos.jsx` | Contas a pagar/receber, extratos, categorias, emissão de boletos. |
| **Moradores & Unidades** | `src/pages/Moradores.jsx` | Cadastro de moradores, veículos, dependentes, animais. |
| **Condomínios** | `src/pages/Condominios.jsx` | Cadastro de condomínios atendidos, blocos e unidades. |
| **RH & Colaboradores** | `src/pages/RH.jsx`<br>`src/components/rh/*` | Gestão de colaboradores, folha, ponto eletrônico, convenções coletivas. |
| **Portaria & Visitantes** | `src/pages/Portaria.jsx`<br>`src/pages/Visitantes.jsx` | Controle de acessos, validação de convidados via QR Code. |
| **Comunicação & Mensagens**| `src/pages/Comunicacao.jsx`<br>`src/pages/WhatsApp.jsx` | Avisos, murais, disparos de mensagens e e-mails. |
| **IA & Chatbot** | `src/pages/AlphaAIChat.jsx`<br>`src/components/AlphaAI.jsx` | Assistente inteligente Alpha AI para suporte a condôminos e síndicos. |

---

## 📦 Coleções Principais no Firebase Firestore

- `locacao_contratos`: Contratos de locação de imóveis (condomínio ou avulso).
- `locacao_repasses`: Registros de pagamentos, retenção de taxa e repasse ao locador.
- `financeiro`: Movimentações de receita/despesa, datas de vencimento e status (`Atrasado`, `Pago`, `Pendente`).
- `juridico`: Processos judiciais, réu/morador, vara, honorários e status.
- `condominios`: Dados dos condomínios administrados.
- `moradores`: Dados dos condôminos/moradores.
- `usuarios`: Usuários do sistema, permissões e perfis de acesso (`Administrador`, `Sindico`, etc.).

---

## ⚡ Hooks e Utilitários Padrão
- **`useFirestore('colecao')`** (`src/hooks/useFirestore.js`): Hook padrão com `items`, `addItem`, `updateItem`, `deleteItem`.
- **`useAuth()`** (`src/context/AuthContext.jsx`): Usuário autenticado, `user.role`, `user.permissoes`.
- **Estilos CSS globais**: Classes utilitárias do Tailwind: `.input`, `.btn-primary`, `.btn-secondary`, `.label`, `.modal-overlay`, `.modal-content`.
- **Formatação de moeda/data**: Padrão brasileiro (`pt-BR`, `R$`, `dd/MM/yyyy`).
