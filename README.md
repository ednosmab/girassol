# 🌻 Meu Girassol - Diário Interativo de Cuidados

An application crafted with premium design principles and specialized accessibility architecture, developed to simplify and enrich the daily care routine for a beloved family member.

## 🎯 O Propósito do Projeto

Cultivating delicate plants like sunflowers requires rigor in checking soil moisture, exposure to sunlight, and chemical fertilization cycles. This software replaces passive interfaces or easy-to-forget paper notes with an interactive digital ecosystem that guides the user safely and clearly.

### Problemas que a Solução Resolve:

* **Esquecimento de Ciclos:** Centraliza a última data/hora exata em que a planta foi cuidada, sem demandar logins ou cadastros complexos.
* **Complexidade Tecnológica (Acessibilidade):** Interface minimalista baseada em botões táteis no formato de pétalas e tipografia de alta legibilidade, ideal para uso móvel intuitivo.
* **Notificações de Sistema Reais:** Utiliza a Web Notification API em conjunto com Service Workers para disparar alertas nativos diretamente na tela de bloqueio do celular, garantindo atenção imediata.
* **Experiência Própria (PWA):** Captura ativa de instalação para fixar o ícone do aplicativo diretamente na tela inicial do celular.

## 🛠️ Tecnologias Usadas

* **Core Interface:** HTML5 semântico estruturado no padrão SPA (Single Page Application) com controle de visualizações síncronas.
* **Typography & Design System:** Google Fonts (*Playfair Display*, *Caveat*, *Plus Jakarta Sans*) aplicados sob uma paleta botânica personalizada.
* **Engine de Persistência:** **IndexedDB** via `localforage` para armazenamento transacional seguro, assíncrono e não volátil diretamente no dispositivo da usuária.
* **PWA Capability & Push:** Service Workers ativos para tratamento offline, escuta de estados reativos e push nativo no sistema operacional.
* **Cloud Infrastructure:** Configuração de deploy integrada na **Vercel** com cabeçalhos agressivos de revalidação de cache.

## 📁 Estrutura do Projeto

```
src/
├── core/
│   ├── database/
│   │   └── localforage-db.ts            # Interface IndexedDB via localforage
│   └── use-cases/
│       ├── registrar-cuidado.ts          # Registro de ações (rega/sol/adubo)
│       ├── buscar-historico.ts           # Consulta ao histórico
│       ├── gerenciar-lembretes.ts        # CRUD de lembretes
│       ├── agendar-notificacao.ts        # Geração de links Google Calendar
│       └── notificacao-nativa.ts         # Notificações nativas via Service Worker
├── ui/
│   ├── components/
│   │   ├── Header.tsx                   # Cabeçalho da aplicação
│   │   ├── Navigation.tsx               # Navegação entre abas
│   │   ├── AgendaBox.tsx                # Box de notificação de cuidados
│   │   └── InstallPrompt.tsx            # Prompt de instalação PWA
│   └── views/
│       ├── DiarioView.tsx               # Tela principal de registro
│       └── CuidadosView.tsx             # Tela de resumo e histórico
├── __tests__/                           # Suíte de testes Jest
├── App.tsx                              # Componente raiz com Page Visibility API
└── main.tsx                             # Ponto de entrada
```

## 🔔 Sistema de Notificações Nativas

Para contornar as restrições de processos em segundo plano dos navegadores mobile, a aplicação utiliza a **Web Notification API** vinculada ao Service Worker:

1. **Solicitação de Permissão:** Ao clicar em um botão de notificação, o app solicita `Notification.requestPermission()` de forma dinâmica.
2. **Disparo Nativo:** Utiliza `registration.showNotification()` para exibir alertas na tela de bloqueio do celular, mesmo com o app fechado.
3. **Instalação PWA:** O evento `beforeinstallprompt` é capturado para exibir um prompt customizado de instalação, permitindo fixar o ícone na tela inicial.

## 📋 Comandos Disponíveis

```bash
npm install          # Instalação de dependências
npm run dev          # Desenvolvimento local
npm run build        # Build de produção
npm test             # Executar testes Jest
npm run test:coverage # Testes com cobertura
npm run lint         # Verificação de tipos TypeScript
```

## 🔮 Sugestões para Evoluções Futuras

1. **Engine de Análise de Padrões:** Mensagens motivacionais baseadas na frequência de cuidados.
2. **Histórico Visual Expandido:** Galeria de fotos integrada ao armazenamento local.
3. **Backup Cloud via Supabase:** Sincronização opcional em nuvem para proteção de dados.
