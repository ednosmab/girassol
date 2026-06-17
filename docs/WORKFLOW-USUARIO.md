# Workflow do Usuário — Operações no App

> Tudo que o usuário faz no app Meu Girassol, passo a passo.

---

## 1. Instalação do PWA

### 1.1 Primeiro Acesso

```
1. Usuário acessa o site no navegador do celular
2. App carrega normalmente (funciona como site)
3. Browser pode mostrar prompt "Adicionar à tela inicial"
4. Usuário confirma → app é instalado como PWA
```

### 1.2 Instalação Manual (Android)

```
1. Menu do navegador (3 pontos)
2. "Adicionar à tela inicial" ou "Instalar app"
3. Confirma → ícone aparece na tela inicial
```

### 1.3 Instalação Manual (iOS)

```
1. Botão compartilhar (quadrado com seta)
2. "Adicionar à Tela de Início"
3. Confirma → ícone aparece na tela inicial
```

---

## 2. Tela Principal — Meu Diário

### 2.1 Visão Geral

```
┌─────────────────────────────────────┐
│           Header (logo)             │
│                                     │
│  ┌───────────────────────────────┐  │
│  │    Calendário de Carinho      │  │
│  │                               │  │
│  │  Última Rega    Banho de Sol  │  │
│  │   12/06/26       15/06/26     │  │
│  │                               │  │
│  │  Último Adubo                 │  │
│  │   01/06/26                    │  │
│  │                               │  │
│  │  [💧 Registrei que Reguei]    │  │
│  │  [☀️ Garanti as 6h de Sol]    │  │
│  │  [🌱 Coloquei o Fertilizante] │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │ Próx. Rega    Próx. Sol      │  │
│  │  14/06/26      Vence hoje!   │  │
│  │  Próx. Adubo                 │  │
│  │   16/06/26                   │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │ 📝 Anotações e Lembretes     │  │
│  │                               │  │
│  │ [textarea...]                 │  │
│  │ [Salvar Anotações]            │  │
│  │                               │  │
│  │ ┌─────────────────────────┐   │  │
│  │ │ Brotou uma folhinha... │ ✕ │  │
│  │ │ 12/06/2026              │   │  │
│  │ └─────────────────────────┘   │  │
│  └───────────────────────────────┘  │
│                                     │
│  [Toast: Registrado! Próxima       │
│   rega em 2 dias ✓]                │
└─────────────────────────────────────┘
```

### 2.2 Registrar Cuidado (Rega / Sol / Adubo)

```
1. Usuário clica no botão do cuidado
   - "💧 Registrei que Reguei Hoje"
   - "☀️ Garanti as 6h de Sol Forte"
   - "🌱 Coloquei o Fertilizante"

2. App processa:
   a. Salva registro no IndexedDB
   b. Cria evento na outbox (para sync)
   c. Agenda push notification (fire-and-forget)

3. UI atualiza:
   - "Último [cuidado]" mostra a data de hoje
   - "Próximo [cuidado]" recalcula a data

4. Toast aparece (centralizado, com barra de progresso):
   - "Registrado! Próxima rega em 2 dias"
   - "Sol todos os dias!"
   - "Registrado! Próximo adubo em 15 dias"
   (desaparece automaticamente após 3.5 segundos)

5. Se offline:
   - Dados ficam salvos localmente
   - Sincroniza automaticamente quando voltar online
```

### 2.3 Criar Anotação / Lembrete

```
1. Usuário digita no textarea
   - Placeholder: "Ex: Brotou uma folhinha nova hoje..."
   - Enter cria a anotação (Shift+Enter para nova linha)

2. Usuário clica "Salvar Anotações" (ou pressiona Enter)

3. App salva no IndexedDB:
   - titulo: texto digitado
   - criadoEm: data/hora atual
   - ativo: true

4. Anotação aparece na lista com data de criação
```

### 2.4 Excluir Anotação / Lembrete

```
1. Usuário clica no botão ✕ ao lado da anotação

2. App marca como inativa (soft-delete)
   - ativo: false
   - Dados permanecem no IndexedDB

3. Anotação some da lista
```

---

## 3. Navegação

### 3.1 Menu Hamburguer

```
1. Usuário clica no botão ☰ (canto superior direito)

2. Menu lateral abre com 4 abas:
   🌻 Meu Diário
   💧 Guia de Cuidados
   🌍 Origem & História
   ✨ Mistérios da Flor

3. Usuário clica na aba desejada

4. Menu fecha automaticamente
```

### 3.2 Abas Disponíveis

| Aba | Conteúdo |
|-----|----------|
| 🌻 Meu Diário | Calendário de Carinho + Anotações |
| 💧 Guia de Cuidados | Dicas de rega, sol e adubo |
| 🌍 Origem & História | História do girassol |
| ✨ Mistérios da Flor | Curiosidades |

---

## 4. Notificações Push

### 4.1 Solicitação de Permissão

```
1. Usuário clica em um botão de cuidado (Rega/Sol/Adubo)

2. Se permissão ainda não foi concedida:
   a. App salva o cuidado localmente primeiro
   b. Browser exibe dialog: " Permitir notificações?"
   c. Usuário clica "Permitir"

3. App aguarda resolução da permissão:
   - Concedida: subscription push é criada e enviada ao servidor
   - Negada: cuidado já foi salvo, notificação é ignorada silenciosamente

4. Toast confirma: "Registrado! Próxima rega em 2 dias"
```

### 4.2 Receber Notificação

```
1. Cron diário (08:00 BRT) verifica lembretes pendentes

2. Se há cuidado vencido:
   - Push notification é enviada
   - Exemplo: "Hora de regar! 🌱 Seu girassol precisa de água..."

3. Usuário vê notificação na barra do sistema

4. Usuário clica na notificação:
   - App abre ou foca
   - Navega para a tela inicial
```

### 4.3 Tipos de Notificação

| Cuidado | Título | Frequência |
|---------|--------|------------|
| Rega | "Hora de regar! 🌱" | A cada 2 dias |
| Sol | "Sol para o girassol! ☀️" | Diário |
| Adubo | "Adubo para crescer! 🌿" | A cada 15 dias |

---

## 5. Instalação do App (PWA)

### 5.1 Prompt de Instalação

```
1. App detecta que pode ser instalado
   (beforeinstallprompt event)

2. Modal ou banner aparece: "Instalar Meu Girassol"

3. Usuário clica "Instalar"

4. App é instalado na tela inicial

5. Ícone: girassol com fundo laranja
```

### 5.2 Após Instalação

```
1. App abre em modo standalone (sem barra do navegador)

2. Splash screen laranja aparece ao abrir

3. Ícone na tela inicial para acesso rápido

4. Funciona offline (dados em IndexedDB)
```

---

## 6. Fluxo Offline

### 6.1 Sem Conexão

```
1. Usuário abre app (pode estar offline)

2. App carrega normalmente (assets em cache pelo SW)

3. Usuário pode:
   - Registrar cuidados ✓
   - Criar anotações ✓
   - Navegar nas abas ✓

4. Dados são salvos localmente no IndexedDB
```

### 6.2 Voltando Online

```
1. Usuário reconecta à internet

2. SyncContext detecta conectividade

3. Eventos pendentes são sincronizados automaticamente:
   - Cuidados → /api/sync-events
   - Push subscriptions → /api/salvar-subscription

4. Dados locais → servidor (não o contrário)
```

---

## 7. Resumo das Ações do Usuário

| Ação | Onde | Resultado |
|------|------|-----------|
| Registrar rega/sol/adubo | Calendário de Carinho | Cuidado salvo + push agendado + toast |
| Criar anotação | textarea + "Salvar" | Anotação salva com data |
| Excluir anotação | Botão ✕ | Soft-delete (some da lista) |
| Navegar entre abas | Menu hamburguer | Troca de view |
| Instalar app | Prompt ou menu do browser | PWA na tela inicial |
| Receber notificação | Push notification | Lembrete de cuidado |
| Clicar na notificação | Barra do sistema | Abre/foca o app |

---

## 8. O Que Acontece nos Bastidores

| Evento | Ação Técnica |
|--------|-------------|
| Usuário clica "Registra" | `registrarCuidadoComOutbox()` → IndexedDB + outbox |
| Toast aparece | Componente `Toast.tsx` com barra de progresso (3.5s) |
| App fica em background | SW verifica atualização |
| App volta ao foreground | Sync processa eventos pendentes |
| Cron 08:00 BRT | Envia push para lembretes vencidos |
| Usuário abre app | SW detecta nova versão se disponível |
| Usuário muda de aba | SW ativa em background se houver update |

### 8.1 Modal de Boas-Vindas

O modal de boas-vindas aparece apenas uma vez, controlado por `localStorage`:

```
1. Usuário abre o app pela primeira vez
2. App verifica: localStorage['girassol_boas_vindas_visto']
3. Se não existe → exibe modal de boas-vindas
4. Ao fechar → salva flag no localStorage
5. Nas próximas aberturas → modal não aparece
```
