Plano de Implementação Unificado: Web App "Meu Girassol"
Este documento serve como a especificação técnica oficial e o roteiro de execução para o Agente de IA. O objetivo é transformar um protótipo de página única em uma aplicação Web/PWA modular, utilizando IndexedDB para persistência, a Page Visibility API para atualizações dinâmicas, um sistema híbrido de notificações via calendário nativo, infraestrutura pronta para deploy na Vercel e documentação completa via README.md.

🏛️ 1. Arquitetura e Separação de Domínios
Para garantir manutenibilidade e isolamento de escopo, o projeto deve seguir rigorosamente a separação de responsabilidades em camadas (Domain, Data e Presentation):

🛠️ Estrutura de Pastas Obrigatória
Plaintext
src/
├── core/                         # Camada de Domínio e Regras de Negócio (Puras)
│   ├── database/                 # Interface e Adaptação do Banco (IndexedDB)
│   │   └── localforage-db.ts
│   └── use-cases/                # Casos de Uso do Sistema
│       ├── registrar-cuidado.ts
│       ├── buscar-historico.ts
│       ├── gerenciar-lembretes.ts
│       └── agendar-notificacao.ts # Lógica de geração de links de calendário
├── ui/                           # Camada de Apresentação (Interface)
│   ├── components/               # Componentes visuais isolados
│   │   ├── Header.tsx
│   │   ├── Navigation.tsx
│   │   └── AgendaBox.tsx
│   └── views/                    # Telas/Abas gerenciadas pelo roteador SPA
│       ├── DiarioView.tsx
│       └── CuidadosView.tsx
├── public/                       # Arquivos estáticos globais
│   ├── manifest.json             # Manifesto de metadados do PWA
│   └── service-worker.js         # Script de controle de cache e offline
├── vercel.json                   # Configurações de roteamento e cache da Vercel
├── README.md                     # Documentação de Propósito e Stack do Projeto
└── index.html / pages/_app.tsx   # Ponto de entrada global da aplicação
🚀 2. Roteiro de Execução por Etapas
Etapa 1: Setup, Manifesto PWA e Vercel
Ação do Agente: Instalar a biblioteca localforage para abstração assíncrona do IndexedDB.

Configuração PWA: Criar o arquivo public/manifest.json configurando display: "standalone". Linkar o manifesto no <head> do arquivo principal.

Configuração Vercel: Criar o arquivo vercel.json na raiz conforme especificado na Seção 5 deste plano.

Etapa 2: Desenvolvimento dos Casos de Uso (Core)
RegistrarCuidado: Recebe o tipo ('rega' | 'sol' | 'adubo'), gera o timestamp no formato local pt-BR e persiste no IndexedDB via localforage.

AgendarNotificacao: Executa o motor de URLs parametrizadas para o Google Calendar para transferir os alertas para o hardware do sistema operacional (ver Seção 4).

Etapa 3: Componentização e Interface de Usuário (UI)
O Agente deve transpor a identidade visual premium aprovada (fontes Playfair Display e Caveat, botões orgânicos em formato de pétala/folha) para os componentes modulares.

A interface da agenda deve reagir em tempo real aos retornos de sucesso das Promises do banco de dados.

Etapa 4: Engenharia do Ciclo de Vida da Página
Registrar o listener global visibilitychange. Ao detectar document.visibilityState === 'visible', o agente deve orquestrar:

A execução do caso de uso BuscarHistorico para atualizar a tela da usuária.

A chamada a navigator.serviceWorker.ready seguida de .update() para buscar atualizações de software na Vercel.

Etapa 5: Geração do Arquivo de Documentação (NOVO)
Ação do Agente: Criar o arquivo README.md na raiz do projeto contendo a especificação afetiva, técnica e operacional detalhada na Seção 6.

🔔 3. O Sistema de Notificações Híbrido (PWA + Agenda)
Para contornar as restrições de processos em segundo plano dos navegadores mobile (especialmente as travas de Push do ecossistema iOS), o Agente implementará a estratégia híbrida de alertas:

Instalação PWA: O manifesto remove a moldura do navegador, emulando um aplicativo nativo instalado na tela inicial.

Alertas Nativos: A aplicação transfere a responsabilidade do alarme para o aplicativo de calendário padrão do dispositivo. Ao disparar o link parametrizado, o celular se encarrega de apitar e exibir a notificação na tela de bloqueio, mesmo com o PWA completamente fechado.

Lógica do Gerador de Calendário para o Agente:
TypeScript
export function gerarLinkCalendario(tipo: 'rega' | 'sol' | 'adubo'): string {
  const titulos = {
    rega: "💧 Cuidar do Girassol: Hora da Rega",
    sol: "☀️ Cuidar do Girassol: Banho de Sol",
    adubo: "🌱 Cuidar do Girassol: Nutrição e Adubo"
  };

  const descricoes = {
    rega: "Verifique se a terra está seca a dois centímetros de profundidade antes de molhar.",
    sol: "Garanta que ele pegue pelo menos 6 horas de luz solar direta hoje!",
    adubo: "Dia de colocar o fertilizante rico em nitrogênio para crescer forte!"
  };

  const titulo = encodeURIComponent(titulos[tipo]);
  const descricao = encodeURIComponent(descricoes[tipo]);
  
  return `https://www.google.com/calendar/render?action=TEMPLATE&text=${titulo}&details=${descricao}&location=Casa&sf=true&output=xml`;
}
📐 4. Configuração de Infraestrutura e Deploy na Vercel
O Agente deve criar e estruturar o arquivo vercel.json na raiz do projeto. Ele configura os cabeçalhos de controle de cache necessários para evitar o congelamento do Service Worker, permitindo que a estratégia de atualização reativa via visibilitychange funcione perfeitamente.

Conteúdo do vercel.json
JSON
{
  "version": 2,
  "cleanUrls": true,
  "headers": [
    {
      "source": "/service-worker.js",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=0, must-revalidate"
        }
      ]
    },
    {
      "source": "/manifest.json",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=0, must-revalidate"
        }
      ]
    },
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
📄 5. Especificação do Arquivo README.md (A ser criado pelo Agente)
O Agente de IA deve gerar o arquivo README.md exatamente com a seguinte estrutura de conteúdo na raiz do repositório:

Markdown
# 🌻 Meu Girassol - Diário Interativo de Cuidados

An application crafted with premium design principles and specialized accessibility architecture, developed to simplify and enrich the daily care routine for a beloved family member.

## 🎯 O Propósito do Projeto
Cultivating delicate plants like sunflowers requires rigor in checking soil moisture, exposure to sunlight, and chemical fertilization cycles. This software replaces passive interfaces or easy-to-forget paper notes with an interactive digital ecosystem that guides the user safely and clearly.

### Problemas que a Solução Resolve:
* **Esquecimento de Ciclos:** Centraliza a última data/hora exata em que a planta foi cuidada, sem demandar logins ou cadastros complexos.
* **Complexidade Tecnológica (Acessibilidade):** Interface minimalista baseada em botões táteis no formato de pétalas e tipografia de alta legibilidade, ideal para uso móvel intuitivo.
* **Barreira de Notificações Mobile:** Burlar as restrições de push background de navegadores móveis (especialmente Safari do iOS) transmitindo gatilhos de tempo diretamente para o calendário nativo do celular.

## 🛠️ Tecnologias e Componentes Utilizados
* **Core Interface:** HTML5 semântico estruturado no padrão SPA (Single Page Application) com controle de visualizações síncronas.
* **Typography & Design System:** Google Fonts (*Playfair Display*, *Caveat*, *Plus Jakarta Sans*) aplicados sob uma paleta botânica personalizada.
* **Engine de Persistência:** **IndexedDB** via `localforage` para armazenamento transacional seguro, assíncrono e não volátil diretamente no dispositivo da usuária.
* **PWA Capability:** Service Workers ativos para cache adaptativo offline e arquivo `manifest.json` para emulação de aplicativo nativo na tela inicial.
* **Cloud Infrastructure:** Configuração de deploy integrada na **Vercel** com cabeçalhos agressivos de revalidação de cache.

## 🔮 Sugestões para Evoluções Futuras (Roadmap de Melhorias)
Para ciclos subsequentes de desenvolvimento, sugere-se mapear e implementar:
1. **Engine de Análise de Padrões:** Exibir mensagens motivacionais personalizadas com base na frequência de regas salvas no IndexedDB (ex: *"Seu girassol está radiante nesta semana! ☀️"*).
2. **Histórico Visual Expandido:** Criar uma aba de galeria de fotos integrada ao armazenamento local do navegador para registrar o crescimento cronológico em imagem da flor.
3. **Backup Cloud via Supabase:** Adicionar uma camada opcional de sincronização silenciosa em nuvem (Database Serverless gratuito) para blindar os dados caso o aparelho celular seja trocado ou reiniciado de fábrica.
🧪 6. Testes de Garantia de Qualidade (QA)
O Agente deve implementar e rodar a suíte de testes de unidade utilizando Jest para validar as integrações críticas antes do deploy:

Teste do Motor de Notificações (agendar-notificacao.spec.ts)
TypeScript
import { gerarLinkCalendario } from '../core/use-cases/agendar-notificacao';

describe('Sistema de Notificações via Calendário', () => {
  it('deve gerar uma URL parametrizada do Google Calendar com metadados corretos', () => {
    const urlResultante = gerarLinkCalendario('rega');
    
    expect(urlResultante).toContain('action=TEMPLATE');
    expect(urlResultante).toContain('text=%F0%9F%92%A7%20Cuidar%20do%20Girassol%3A%20Hora%20da%20Rega');
    expect(urlResultante).toContain('output=xml');
  });
});
Teste de Sanidade de Compilação Pré-Deploy (build.spec.ts)
TypeScript
import fs from 'fs';
import path from 'path';

describe('Validação do Pacote de Distribuição', () => {
  it('deve garantir a existência física dos artefatos críticos de PWA e Documentação', () => {
    const rootDir = path.join(__dirname, '../../'); 
    const outDir = path.join(__dirname, '../../dist'); 
    
    expect(fs.existsSync(path.join(outDir, 'index.html'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, 'manifest.json'))).toBe(true);
    expect(fs.existsSync(path.join(rootDir, 'README.md'))).toBe(true);
  });
});

📈 7. Diretrizes e Refinamentos Adicionais
    1- Validação de Inputs: Implementar schemas do Zod na inserção de notas/lembretes rápidos, limitando o input a 150 caracteres para prevenir quebras de layout na interface.

    2- Estratégia Cache-First: Forçar o Service Worker a realizar o cache das fontes do Google Fonts durante o ciclo install. O aplicativo não pode perder sua tipografia elegante se estiver operando sem conectividade.

    3- Tratamento de Erros: Proteger as chamadas do localforage com blocos try/catch para capturar falhas de armazenamento de forma silenciosa, sem causar falhas de renderização (crashes) na interface visual.