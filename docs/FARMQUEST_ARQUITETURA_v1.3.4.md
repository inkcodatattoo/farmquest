# FARMQUEST — ARQUITETURA TÉCNICA E REGRAS DE NEGÓCIO

**Versão:** 1.3.4  
**Data:** 2026-09-28  
**Status:** CONSOLIDADA PARA IMPLEMENTAÇÃO — FINAL  
**Substitui:** v1.0, v1.1, v1.2, v1.3, v1.3.1, v1.3.2 e v1.3.3 integralmente (as versões anteriores passam a ser apenas histórico)  
**Objetivo:** ser a única fonte de verdade para implementação no VS Code com Codex/Claude, sem reinterpretação de regras de negócio já fechadas.

---

## 0. COMO USAR ESTE DOCUMENTO

### 0.1. Documento autossuficiente

A v1.3.4 é completa. O agente de implementação **não precisa e não deve** consultar v1.0, v1.1, v1.2, v1.3, v1.3.1, v1.3.2 ou v1.3.3 para implementar.

A v1.3.4 foi montada assim:

1. Todas as regras `[FECHADA]` da v1.2 foram copiadas **sem alteração de conteúdo**.
2. Regras de produto escritas na v1.0 (documento original do produto) que nenhuma versão posterior contradisse foram incorporadas como `[FECHADA · v1.0]`.
3. O conteúdo técnico da v1.1 que continua válido foi incorporado como `[TÉCNICA]`.
4. Os "padrões adotados" da v1.1 que nunca foram aprovados pelo produto **não** viraram regra: aparecem como `[PENDENTE]`, com comportamento provisório explícito.
5. A v1.3.1 aplicou hardening técnico sobre a v1.3 (idempotência, corridas, ledger, estados) — seção 46.
6. A v1.3.2 é revisão apenas operacional/técnica para desenvolvimento remoto e segurança do Protótipo 0.1 — seção 47. Nenhuma regra de produto foi alterada. Histórico anterior na seção 43.
7. A v1.3.3 foi um adendo técnico normativo: modelo temporal/snapshot linearizável; matriz de FKs e privilégios; versionamento de definições econômicas; contratos Zod/OpenAPI do 0.1; manifesto de fixtures; erratas de Twitch, OAuth, PD-03, aleatoriedade e outbox.
8. A v1.3.4 incorpora integralmente esse adendo ao documento principal, tornando esta versão novamente única e autossuficiente. Nenhuma regra `[FECHADA]` foi alterada.

### 0.2. Regra de precedência

1. **Regra de negócio fechada não pode ser alterada por agente de IA, desenvolvedor ou implementação técnica sem decisão explícita do responsável pelo produto.**
2. Decisões técnicas podem ser refinadas apenas quando o refinamento:
   - não altera comportamento de produto;
   - não muda economia;
   - não muda permissões;
   - não muda regras de comunidade;
   - não muda comportamento Twitch;
   - não muda limites funcionais já aprovados.
3. Em caso de conflito entre comentário de código, seed, migration, teste, implementação, documento antigo ou decisão provisória, **esta v1.3.4 prevalece**.
4. Se uma regra necessária para codificação não estiver definida nesta v1.3.4 nem na especificação funcional aprovada, ela deve ser marcada como `PENDENTE_PRODUTO` e não deve ser inventada.
5. Valores de balanceamento podem ser configuráveis em banco/seed, mas tornar um valor configurável **não autoriza alterar o valor aprovado**.
6. Toda feature econômica deve possuir teste de invariantes, concorrência e idempotência antes de ser considerada pronta.
7. `[PENDENTE]` continua pendente. O agente não pode transformar comportamento provisório em regra definitiva.
8. Nenhuma correção técnica pode mudar regra de negócio aprovada.

**Especificação funcional aprovada:** `[PENDENTE PD-01]` — informar aqui o caminho do arquivo no repositório (ex.: `docs/ESPECIFICACAO_FUNCIONAL.md`). Enquanto não houver caminho, o agente só conhece as regras deste documento.

### 0.3. Classificação normativa

| Marcador | Significado |
|---|---|
| `[FECHADA · v1.0]` / `[FECHADA · v1.2]` | Regra de negócio aprovada; a origem indica de onde veio. Implementação não pode alterá-la. |
| `[TÉCNICA]` | Decisão de arquitetura; pode ser refinada sem mudar comportamento funcional. |
| `[PENDENTE PD-xx]` | Decisão que ainda depende do produto. Quando houver **Provisório**, ele pode ser implementado no protótipo, isolado e fácil de trocar (valor em config ou função única com comentário `PENDENTE PD-xx`). Quando estiver escrito **Bloqueia**, não implementar. |
| `[COMPLIANCE]` | Barreira de conformidade: proíbe implementar um mecanismo sem revisão jurídica e decisão de produto. Não altera regra existente. |

Lista completa de pendências: seção 41.

---

# 1. VISÃO DO PRODUTO

FarmQuest é um jogo de fazenda jogado pelo navegador e conectado ao ecossistema Twitch. O jogador mantém fazendas, evolui por ações do jogo, participa de comunidades ligadas a streamers, recebe benefícios comunitários, participa de eventos coletivos e pode negociar itens no Marketplace.

## 1.1. Superfícies

1. **Web:** interface completa da fazenda, inventário, comunidade, mercado, Marketplace, rankings, eventos e administração.
2. **Twitch:** interface complementar por comandos de chat; nunca é a autoridade das regras do jogo.

O site e a Twitch usam as mesmas regras no backend. `[FECHADA · v1.0]`

## 1.2. Autoridade

A API é a autoridade única sobre: moedas; XP; inventário; plantações; animais; mercado; Marketplace; comunidade; eventos; recompensas; permissões; idempotência; progressão.

O frontend web e o bot Twitch são clientes da API.

---

# 2. PRINCÍPIOS DE ARQUITETURA

## 2.1. Backend autoritativo [TÉCNICA]

Nenhum cliente calcula ou confirma resultado econômico. O cliente pode exibir prévias, timers e probabilidades, mas a confirmação final ocorre no servidor.

- o navegador não decide quantos itens foram colhidos;
- o bot não altera saldo nem concede XP;
- o browser não marca uma planta como colhida sem resposta da API;
- o Marketplace não confia no preço total enviado pelo cliente;
- o cliente envia intenção ("quero colher"); nunca `coins`, `xp` ou `quality`.

## 2.2. Regras puras e determinísticas [TÉCNICA]

Regras reaproveitáveis ficam em `packages/game-rules`:

- funções puras sempre que possível;
- `now` recebido como argumento quando o tempo influencia o resultado;
- nenhuma dependência implícita de `Date.now()` dentro da regra pura;
- UTC em persistência;
- inteiros para moedas e quantidades; `bigint` para saldos e ledger;
- basis points ou inteiros para percentuais econômicos;
- nenhuma aritmética monetária com `float`/`double`.

## 2.3. Monólito modular [TÉCNICA]

A arquitetura de produção inicial é um monólito modular. Não transformar em microsserviços antes de necessidade comprovada.

Cada módulo é responsável por seu domínio. Operações que atravessam módulos são coordenadas por um application service/use case usando a mesma transação de banco quando a atomicidade exigir.

## 2.4. Banco como última barreira de integridade [TÉCNICA]

Regras críticas não podem depender apenas de `if` em TypeScript. Reforçar invariantes com `UNIQUE`, índices parciais, `CHECK`, foreign keys, updates condicionais, locks de linha, transações e ledger append-only.

## 2.5. Estado temporal derivado [TÉCNICA]

- Não criar timer/job por planta, animal ou cooldown.
- Persistir timestamps e derivar o estado com `now`.
- Prazos definidos por configuração são **congelados no registro** quando ele é criado (ex.: `grows_at`, `rots_at`, `withdraw_available_at`). Mudar a configuração depois afeta só registros novos.

## 2.6. Uma ação = uma transação [TÉCNICA]

Toda ação que altera estado roda em **uma** transação que é idempotente (seção 23), grava ledger quando muda moeda, item ou XP (seção 21) e grava outbox quando há efeito externo (seção 24).

Locks: **toda ação que altera uma fazenda trava a `Farm`; ações que alteram outras entidades travam a entidade apropriada** (ex.: `Streamer`, `CommunityEvent`, `CommunityGoal`, `MarketplaceListing`), obedecendo a ordem global da seção 22.3. Ações que não alteram fazenda não travam `Farm` só por precaução.

## 2.7. Tempo real é aviso [TÉCNICA]

Mensagens Socket.IO avisam; a verdade é o REST. O cliente sempre pode refazer o GET.

## 2.8. Consequência obrigatória nunca se perde [TÉCNICA]

Toda consequência assíncrona que não pode se perder nasce dentro da transação que a causa, como `OutboxMessage internal.*`, e também é recuperável a partir do estado de domínio por varredura (seção 24). É proibido depender de `boss.send()` executado só depois do commit.

## 2.9. Instante do fato [TÉCNICA]

Consequências são datadas pelo instante em que o fato aconteceu (ex.: `completed_at` da meta), não pelo instante em que um job as processou. Atraso de worker não muda resultado econômico.

## 2.10. Modelo temporal e linearização [TÉCNICA · v1.3.4]

### 2.10.1. Quatro tempos distintos

Não usar um único `created_at` para representar conceitos diferentes.

| Campo conceitual | Significado |
|---|---|
| `received_at` | request/evento chegou à aplicação; observabilidade |
| `linearized_at` | instante autoritativo em que a decisão de domínio é tomada |
| `effective_at` | quando o efeito começa a valer, se diferente |
| `created_at` | quando o registro foi persistido |

Persistência: `timestamptz`, UTC. Regras civis continuam usando `America/Sao_Paulo` somente para converter fronteiras de calendário (ex.: `price_date`).

### 2.10.2. `linearized_at` autoritativo

Para mutações econômicas/temporais:

1. iniciar transação;
2. obter idempotência/dedupe;
3. adquirir todos os locks necessários à decisão, na ordem R0–R7;
4. reler o estado protegido;
5. executar `SELECT clock_timestamp()` no PostgreSQL;
6. esse valor vira `linearized_at`;
7. funções puras de `game-rules` recebem esse instante;
8. todas as comparações temporais daquela ação usam o mesmo valor;
9. persistir o resultado e commit.

`Date.now()` não é instante econômico oficial. `transaction_timestamp()` também não é o instante autoritativo porque é congelado no início da transação e pode anteceder espera por lock.

Exemplos:

```text
plantação pronta         := linearized_at >= grows_at
plantação podre          := linearized_at >= rots_at
cooldown livre           := linearized_at >= next_harvest_at
listing retirável        := linearized_at >= withdraw_available_at
meta aceita contribuição := linearized_at < ends_at
evento aceita ação       := linearized_at < ends_at
```

### 2.10.3. Replay idempotente

Replay da mesma idempotency key:

- não captura novo `linearized_at`;
- devolve o resultado persistido da primeira execução;
- não refaz sorteio;
- não recalcula XP;
- não move prazos.

Quando observável no contrato, a resposta repetida devolve o `linearizedAt` original.

### 2.10.4. Snapshot linearizável

Elegibilidade histórica que depende de estado concorrente não deve ser reconstruída depois usando apenas timestamps. Quando um fato precisa congelar um conjunto de estados, a transação que registra o fato materializa um snapshot por `INSERT ... SELECT` após os locks do próprio fato e com `snapshot_at = linearized_at`.

Mudança já commitada antes desse statement é observada; mudança ainda não commitada pode ser ordenada logicamente depois do fato. O worker posterior lê o snapshot imutável e não tenta reconstruir o passado. Detalhes: 18.8.

### 2.10.5. Snapshot de definições

Toda ação econômica grava ou referencia a versão da regra usada. Exemplos: `PlantedCrop` registra a revisão da cultura aplicável; `RewardBoxOpening` registra loot table/version; `CommunityGoal` e `CommunityEvent` congelam os valores de suas definições; ledgers mantêm o valor efetivamente movimentado. Política completa: 27.3.

---

# 3. STACK E ESTRUTURA DO REPOSITÓRIO

## 3.1. Stack principal [TÉCNICA]

| Camada | Escolha |
|---|---|
| Runtime | Node.js 24 LTS (versão fixada na imagem Docker) |
| Linguagem | TypeScript |
| Web | Next.js (output `standalone`), React, Socket.IO client |
| API | NestJS, REST sob `/api/v1`, Socket.IO |
| Banco | PostgreSQL 17 (versão maior fixada na imagem) |
| ORM | **Prisma 7.x — versão fixada** (ver 3.2) |
| Jobs | pg-boss (fila e agendamento dentro do PostgreSQL) |
| Validação | Zod (schemas compartilhados entre web, api, worker e bot) |
| Bot | Node.js/TypeScript, EventSub + Twitch API |
| Monorepo | pnpm workspaces + Turborepo |
| Testes | Vitest, PostgreSQL real (service container no CI; Testcontainers onde houver Docker), fast-check, k6, Playwright |
| Deploy | Docker Compose via EasyPanel; imagens construídas no GitHub Actions e publicadas no GitHub Container Registry |
| Desenvolvimento | Remoto: GitHub + GitHub Actions + VPS DEV; GitHub Codespaces opcional. Nada instalado no computador do desenvolvedor (34.9) |

Não introduzir Redis no MVP sem gargalo demonstrado (gatilhos na seção 34.8).

## 3.2. Versão do Prisma [TÉCNICA]

Em setembro/2026 o pacote `prisma` com tag `latest` no npm aponta para o **Prisma 8**, que é Release Candidate, reescrito, com outra CLI e outra API de consulta.

Regras:

- instalar sempre com versão explícita: `prisma@7` e `@prisma/client@7`;
- nunca `npm i prisma` sem versão; nunca seguir tutoriais do Prisma 8;
- manter versões travadas no `package.json` e no lockfile;
- migração para Prisma 8 só com decisão registrada, depois de versão estável.

Limitações do Prisma 7 que exigem SQL:

- `SELECT ... FOR NO KEY UPDATE` (mutex de linha — 22.2): via `$queryRaw` (template tag parametrizada) dentro de `$transaction` interativa;
- exclusion constraints e FKs compostas: SQL na migration;
- índices únicos parciais: preview feature `partialIndexes` (7.4+) ou SQL na migration;
- `CHECK` constraints: SQL escrito na migration;
- `LISTEN/NOTIFY`: conexão dedicada do driver `pg`, não do Prisma.

**Prisma schema não é desculpa para perder constraint PostgreSQL.**

## 3.3. Monorepo [TÉCNICA]

```text
farmquest/
  apps/
    web/              Next.js
    api/              HTTP + Socket.IO + dispatcher do outbox (realtime e chat)
    worker/           jobs pg-boss + consumidores internos do outbox
    twitch-bot/       EventSub + envio de chat; sem banco
  packages/
    domain/           módulos Nest de domínio: use cases, repositórios, regras com IO
    game-rules/       funções puras (estados, sorteios, cooldown, modificadores, dinheiro, slots)
    contracts/        DTOs, schemas Zod, códigos de erro, contratos de eventos e rotas internas
    database/         schema Prisma, migrations, client, seed
    config/           tsconfig, eslint, schemas de GameConfig
    logger/           logger estruturado com redaction
    testing/          fixtures, helpers de banco de teste (CI/Codespaces), checagem de invariantes
  infra/
    docker/
    scripts/
  docs/
    FARMQUEST_ARQUITETURA_v1.3.4.md
```

`packages/domain` é novo na v1.3: é onde vivem as regras de negócio com banco. `apps/api` e `apps/worker` importam os mesmos módulos. **Nenhuma regra de negócio é reescrita no worker.**

## 3.4. Processos e dependências [TÉCNICA]

```text
Navegador ── HTTPS / WebSocket (mesma origem) ──> API
                                                   │  Socket.IO (conexões dos jogadores)
                                                   │  dispatcher do outbox: tópicos realtime.* e chat.*
                                                   │
Twitch Bot ── HTTP interno (comandos) ────────────>│
Twitch Bot <── HTTP interno (mensagens a enviar) ──┘
                                                   │
                                                   v
                                               PostgreSQL <── Worker (pg-boss + tópicos internal.*)
```

Regras:

- O **Socket.IO vive na API**. Só a API emite para navegadores.
- O **worker nunca emite Socket.IO**. Quando um job precisa avisar jogadores, ele grava `OutboxMessage` com tópico `realtime.*`; a API entrega.
- O bot Twitch não acessa PostgreSQL diretamente.
- Mensagens de chat saem do outbox (tópico `chat.*`), são entregues pela API ao bot, e o bot envia para a Twitch.

## 3.5. Regras de dependência entre pacotes [TÉCNICA]

- `game-rules` não importa Nest, Prisma, rede ou banco.
- `domain` importa `game-rules`, `database`, `contracts`.
- `web` pode importar `game-rules` só para exibição (contagem regressiva, prévias). O resultado oficial sempre vem da API.
- `twitch-bot` importa `contracts`; nunca `database` ou `domain`.

---

# 4. ATORES E PAPÉIS

## 4.1. UserRole [FECHADA · v1.2]

```text
PLAYER
SUPPORT
ADMIN
```

"Streamer" não é valor de `UserRole`: é o usuário que possui um `Streamer` aprovado. As permissões de streamer vêm dessa relação. `[TÉCNICA]`

## 4.2. PLAYER

Pode:

- jogar nas próprias fazendas;
- entrar/participar de comunidades conforme regras;
- usar inventário;
- plantar/colher;
- interagir com animais;
- anunciar/comprar no Marketplace;
- participar de eventos;
- visualizar rankings;
- utilizar recursos Twitch permitidos.

Não pode executar operações administrativas.

## 4.3. SUPPORT [FECHADA · v1.2]

Suporte é cargo operacional limitado.

Pode, conforme endpoint específico:

- consultar dados necessários para atendimento;
- visualizar vínculo Twitch;
- executar fluxos de readmissão quando autorizados pela regra do produto;
- auxiliar em vínculo/desvínculo operacional quando existir procedimento aprovado;
- consultar logs/auditoria compatíveis com suporte.

Não pode:

- criar moedas;
- remover moedas arbitrariamente;
- alterar probabilidades;
- alterar preços globais;
- alterar loot tables;
- alterar curva de XP;
- alterar configurações econômicas globais;
- conceder recompensas econômicas manuais sem fluxo administrativo autorizado;
- acessar segredos/tokens descriptografados.

## 4.4. ADMIN [FECHADA · v1.2]

Admin possui acesso às ferramentas administrativas previstas, sempre com auditoria.

Ações econômicas administrativas devem exigir:

- motivo;
- actor/admin id;
- entidade afetada;
- valor anterior e posterior quando aplicável;
- ledger correspondente quando houver moeda/item;
- audit log.

## 4.5. STREAMER (usuário com Streamer aprovado)

Pode, sobre a própria comunidade:

- ativar o jogo no canal com `$abrirfazenda` `[FECHADA · v1.2]`;
- remover e readmitir membros `[FECHADA · v1.0]`;
- enviar a mercadoria da meta comunitária `[FECHADA · v1.0]`.

Toda ação de streamer gera `AuditLog`. `[TÉCNICA]`

---

# 5. IDENTIDADE, TWITCH E CONTA

## 5.1. Identidade principal [FECHADA · v1.2]

O jogador precisa possuir conta FarmQuest vinculada ao fluxo oficial do site.

**O bot não cria automaticamente conta/fazenda de espectador pelo chat.**

Identificador interno principal: `twitch_user_id`. Nunca usar username como identificador. `[FECHADA · v1.0]`

## 5.2. `$abrirfazenda` [FECHADA · v1.2]

- `$abrirfazenda` é comando do **streamer aprovado**;
- serve para ativar o jogo/chat FarmQuest naquele canal;
- não cria conta de espectador;
- não cria fazenda de espectador;
- só funciona para streamer previamente aprovado/habilitado;
- depois de ativado, espectadores podem utilizar comandos permitidos.

Se um espectador ainda não possuir conta FarmQuest, o bot deve orientá-lo a acessar o link oficial e autenticar-se no site.

Fechamento do jogo no canal: `[PENDENTE PD-05]` existe comando de chat para fechar? **Provisório:** fechamento apenas pelo painel do streamer ou pelo ADMIN; grava `chat_game_active = false` e `chat_game_closed_at`.

Alcance da ativação: `[PENDENTE PD-28]` `$abrirfazenda` ativa só o chat ou também o jogo no site daquele streamer? **Provisório:** só o chat; criar e jogar fazenda no site exige apenas streamer `APPROVED`.

Implementação `[TÉCNICA]`: `$abrirfazenda` trava a linha do `Streamer` (R4), valida `approval_status = APPROVED` e `bot_enabled`, grava `chat_game_active = true`, `chat_game_opened_at = now`, gera `AuditLog`.

## 5.3. Estado do streamer [FECHADA · v1.2 + TÉCNICA]

`Streamer` distingue autorização administrativa de ativação funcional do canal. Não usar um único boolean para os três conceitos.

```text
Streamer
  id
  user_id                 UNIQUE
  twitch_user_id          UNIQUE (= broadcaster_user_id)
  twitch_login
  approval_status         PENDING | APPROVED | REJECTED | SUSPENDED
  approved_at
  approved_by_user_id
  bot_enabled             plataforma permite o bot operar nesse streamer
  bot_authorized          streamer concedeu o scope channel:bot        [TÉCNICA]
  bot_is_moderator        verificado pela API (ver 26.4)               [TÉCNICA]
  chat_game_active        streamer executou a abertura; jogo ativo no canal
  chat_game_opened_at
  chat_game_closed_at
  is_live                 EventSub stream.online / stream.offline       [TÉCNICA]
  live_since                                                            [TÉCNICA]
  followers_snapshot      valor na inscrição; não é mantido atualizado  [TÉCNICA]
  main_category           categoria principal informada na inscrição    [v1.0]
  created_at
  updated_at
```

Efeito de `SUSPENDED` sobre as fazendas daquela comunidade: `[PENDENTE PD-03]`. **Provisório:** as fazendas daquele streamer ficam sem acesso jogável e o bot deixa de ouvir o canal.

Implementação `[TÉCNICA]`: o bloqueio é **calculado** pela política de acesso (6.5) a partir de `Streamer.approval_status`; **nada é gravado na fazenda**. Reativar o streamer restaura o acesso automaticamente e nunca libera bloqueio de outra origem (membership `REMOVED`, usuário `BANNED`). A aprovação do streamer cria a `Community` na mesma transação (R4).

Errata técnica v1.3.4 — PD-03 **continua pendente**. Enquanto o provisório estiver ativo:

- `SUSPENDED` bloqueia gameplay por política calculada; nada grava `FROZEN` na `Farm`;
- o bot deixa de processar gameplay daquele canal;
- não iniciar nova meta, novo evento, nova contribuição ou participação;
- processamento de consistência continua: evento já existente pode ser encerrado pelo sweep; meta vencida pode ir para `FAILED/CLOSED`; consequência já registrada no outbox continua; `RewardGrant` já materializado continua; boost já iniciado mantém seu intervalo; cleanup e reconciliação continuam;
- uma ação que já adquiriu os locks necessários e observou `APPROVED` pode terminar e é linearizada antes da suspensão;
- reativação remove somente o bloqueio originado por `SUSPENDED`; nunca remove `REMOVED`, `BANNED` ou outro bloqueio.

Esse esclarecimento é comportamento provisório técnico e **não fecha PD-03**.

## 5.4. Comando de espectador sem conta [FECHADA · v1.2]

1. Twitch envia mensagem/evento ao bot.
2. Bot resolve `twitch_user_id`.
3. API tenta localizar usuário vinculado.
4. Se não existir vínculo:
   - nenhuma entidade econômica é criada;
   - nenhuma fazenda é criada;
   - bot responde com link oficial de autenticação.

## 5.5. Entidades de identidade [TÉCNICA]

```text
User
  id (uuid)
  role                PLAYER | SUPPORT | ADMIN
  status              ACTIVE | BANNED | DELETED
  auth_provider       TWITCH | DEV   (DEV só existe em ambiente de desenvolvimento — 32.10)
  display_name
  avatar_url
  created_at
  last_login_at
  deleted_at

TwitchIdentity
  user_id             UNIQUE
  twitch_user_id      UNIQUE
  twitch_login        (atualizado a cada login)
  twitch_display_name
  linked_at

TwitchCredential      (tokens de bot e de streamer; nunca de jogador)
  id
  owner_type          BOT | STREAMER
  twitch_user_id
  scopes
  access_token_enc    (AES-256-GCM)
  refresh_token_enc
  expires_at
  updated_at

UserSession           (ver 32.2)
```

O token OAuth do jogador não é guardado depois do login (não é necessário).

Primeiro ADMIN: variável `ADMIN_TWITCH_IDS` aplicada no login.

Criação do usuário (fluxo 37.1): `User`, `TwitchIdentity` e `MarketplaceSellerState` são criados **na mesma transação**, no primeiro login pelo site. Assim todo usuário já tem a linha de mutex global do Marketplace (19.3). Usuários anteriores a esta regra recebem a linha por migration de backfill idempotente (`INSERT ... SELECT ... ON CONFLICT DO NOTHING`).

---

# 6. FAZENDAS

## 6.1. Uma fazenda por streamer [FECHADA · v1.0]

Um jogador só pode ter uma fazenda por streamer. Cada fazenda é isolada por jogador + streamer.

Implementação `[TÉCNICA]`: índice único **parcial**

```sql
CREATE UNIQUE INDEX farm_user_streamer_uq
ON farm (user_id, streamer_id)
WHERE status <> 'SOLD';
```

Com `UNIQUE` simples, uma fazenda vendida impediria criar outra no mesmo streamer. A fazenda vendida permanece como histórico (ledger e auditoria apontam para ela).

## 6.2. Limite por usuário [FECHADA · v1.2]

O limite inicial é de **até 5 fazendas por usuário**.

A criação da sexta fazenda deve falhar mesmo sob concorrência. Não basta `count()` seguido de `create()` sem lock.

Implementação `[TÉCNICA]`: lock na linha do `User` antes da contagem e criação (fluxo 37.2).

Teste obrigatório: duas requisições simultâneas tentando ocupar a última vaga.

Fazendas que contam no limite: todas com status diferente de `SOLD`. Fazenda de comunidade em que o jogador está `REMOVED` continua existindo: `[PENDENTE PD-04]` confirmar se conta. **Provisório:** conta.

## 6.3. Entidade Farm [TÉCNICA]

```text
Farm
  id
  user_id
  streamer_id
  community_id        FK composta (community_id, streamer_id) -> Community(id, streamer_id)
  status              ACTIVE | SOLD
  level
  xp                  bigint, CHECK (xp >= 0)
  coins               bigint, CHECK (coins >= 0)
  inventory_slots
  stack_limit
  next_harvest_at     cooldown de colheita (7.7)
  active_title_id     nullable (14.4)
  created_at
  sold_at
```

A linha da `Farm` é o mutex (`FOR NO KEY UPDATE`) de todas as ações daquela fazenda e de todas as suas linhas filhas (canteiros, plantios, inventário, animais, trator, membership, contribuições, recompensas). Ver seção 22.

`Farm.status` não tem estado "congelado". Bloqueios de acesso são **calculados** (6.5). Se um dia existir bloqueio administrativo por fazenda, ele será uma entidade própria com motivo (ex.: `ADMIN_ACTION`, `ECONOMY_REVIEW`), nunca um valor de `Farm.status`, para que remover um motivo não libere bloqueios de outra origem.

## 6.4. Fazenda inicial [FECHADA · v1.0]

- 3 canteiros
- 3 sementes (qual semente: `[PENDENTE PD-23]` valor de balanceamento)
- 100 moedas

Valores gravados em configuração; o valor aprovado não muda por ser configurável.

## 6.5. Acesso à fazenda após expulsão [FECHADA · v1.2]

Quando um jogador for expulso de uma comunidade:

- seu progresso não é apagado;
- seus dados não são resetados;
- a fazenda associada àquela comunidade não fica jogável enquanto o estado for `REMOVED`;
- ao acessar a fazenda, deve receber a mensagem:

> Você foi expulso desta comunidade! Que pena :/

- o bloqueio permanece até readmissão válida.

Implementação `[TÉCNICA]`: toda ação de jogador na fazenda passa pela política de acesso, avaliada **com a fazenda travada**:

```text
FarmAccessPolicy.assertPlayable(farm):
  farm.status = SOLD                              -> FARM_SOLD
  user.status <> ACTIVE                           -> USER_BANNED
  membership.status <> ACTIVE                     -> FARM_ACCESS_REMOVED   (mensagem do produto)
  streamer.approval_status = SUSPENDED            -> FARM_STREAMER_SUSPENDED  (PD-03, provisório)
```

- Leituras da fazenda retornam o mesmo código para a UI exibir a mensagem.
- A remoção de membro trava a mesma fazenda, então nenhuma ação em andamento termina depois da remoção.
- Escritas do sistema que não são ação do jogador (entrega de `RewardGrant` já registrado — 18.7) não passam pela política.
- A política é a única fonte do bloqueio: nada é gravado na fazenda por remoção ou suspensão.

## 6.6. Venda de fazenda [FECHADA · v1.0 + PENDENTE]

Regra aprovada `[FECHADA · v1.0]`:

- a fazenda passa a `SOLD`;
- o progresso daquela fazenda deixa de ser ativo (inventário, plantios, coleção, animais, nível, XP);
- ao criar novamente fazenda naquele streamer: nível 1, XP 0 (nova linha de `Farm`).

`[PENDENTE PD-02]` fórmula e **destino** do valor da venda (as moedas pertencem à fazenda que deixa de existir). **Bloqueia:** o endpoint de venda não deve ser implementado até a decisão.

Pré-condições técnicas, para quando for liberado `[TÉCNICA]`:

- fazenda `ACTIVE` e travada;
- nenhum anúncio `ACTIVE` usando itens desta fazenda;
- tratamento de `RewardGrant` `PENDING`/`AWAITING_SPACE` da fazenda definido pela decisão de PD-02;
- dados não são apagados (histórico).

---

# 7. CANTEIROS, PLANTIO E COLHEITA

## 7.1. Canteiros [FECHADA · v1.0 + TÉCNICA]

```text
Plot
  id
  farm_id
  slot_number         UNIQUE(farm_id, slot_number)
  unlocked
  seeds_capacity
```

Estados de um canteiro `[FECHADA · v1.0]`: `EMPTY`, `PLANTED`, `READY`, `ROTTEN`.

O estado **não é gravado** `[TÉCNICA]`. É calculado por `getPlotState(plantedCrop, now)` em `game-rules`:

| Estado | Condição |
|---|---|
| `EMPTY` | sem `PlantedCrop` ativo (`harvested_at IS NULL`) |
| `PLANTED` | `now < grows_at` |
| `READY` | `grows_at <= now < rots_at` |
| `ROTTEN` | `now >= rots_at` |

Como liberar canteiros além dos 3 iniciais (nível, compra ou ambos): `[PENDENTE PD-23]`.

## 7.2. Culturas [TÉCNICA]

```text
CropDefinition
  id
  key
  name
  seed_item_id          -> ItemDefinition (categoria SEED)
  product_item_id       -> ItemDefinition (categoria CROP)
  yield_per_seed        unidades colhidas por semente
  unlock_level
  growth_seconds
  xp_reward             XP por semente colhida (7.8)
  enabled
  config
```

Preço de referência não fica aqui: fica em `ItemDefinition.base_price`; o preço do dia em `MarketPrice` (10.2). Valores (tempos, rendimento, XP): `[PENDENTE PD-23]`.

## 7.3. Plantio ativo [TÉCNICA]

```text
PlantedCrop
  id
  farm_id               (denormalizado)
  plot_id
  crop_definition_id
  seed_count
  planted_at
  grows_at              congelado na criação
  rots_at               congelado na criação
  tractor_bonus_applied
  harvested_at          NULL = ativo
  result_quality_id     preenchido na colheita
  result_quantity       preenchido na colheita (quantidade integral colhida)
  result_contributed    preenchido na colheita (accepted para a meta; 0 se não houve)
```

Constraints:

```sql
CREATE UNIQUE INDEX planted_crop_active_uq ON planted_crop (plot_id) WHERE harvested_at IS NULL;
CREATE INDEX planted_crop_farm_active_ix ON planted_crop (farm_id) WHERE harvested_at IS NULL;
```

## 7.4. Linha do tempo [FECHADA · v1.0]

```text
PLANTED --(grows_at)--> READY --(+24h)--> ROTTEN
```

`rots_at = grows_at + 24h`. Não é necessário criar um cronjob por plantação; o backend calcula o estado usando o horário atual do servidor.

## 7.5. Plantar — `$plantar milho` [FECHADA · v1.0 + TÉCNICA]

Regra `[FECHADA · v1.0]`: valida sementes, localiza canteiros vazios, **preenche o máximo possível**, remove sementes, cria o plantio.

Detalhes `[TÉCNICA]`:

- a cultura é resolvida pelos aliases do item (`ItemDefinition.aliases`, ex.: "milho", "milhos"); o bot normaliza minúsculas e acentos;
- canteiros vazios e desbloqueados em ordem de `slot_number`, até `seeds_capacity` de cada um;
- valida `unlock_level`;
- consome sementes disponíveis (`quantity - reserved_quantity`);
- aplica o bônus pendente do trator (11.2);
- XP de plantio (13.1).

Fluxo completo: 37.3.

## 7.6. Colher — `$colher` [FECHADA · v1.0 + TÉCNICA]

Regra `[FECHADA · v1.0]`: verifica cooldown, busca **todos** os plantios `READY` e `ROTTEN`, calcula qualidade, calcula XP, atualiza inventário, atualiza comunidade, atualiza cooldown, notifica Twitch e site.

A mesma plantação pode ser acionada simultaneamente por web, Twitch, retry HTTP, clique duplo ou retransmissão. **Somente uma colheita pode produzir efeitos econômicos.** `[FECHADA · v1.2]`

Obrigatório `[TÉCNICA]`:

- transação;
- **lock da `Farm`** (não apenas do canteiro — duas colheitas de canteiros diferentes da mesma fazenda disputam XP, nível e as mesmas linhas de inventário);
- confirmação de não colhida (`UPDATE ... WHERE harvested_at IS NULL`);
- `ItemLedger`;
- XP na mesma transação;
- outbox criado apenas junto com os efeitos confirmados;
- "atualiza comunidade" = contribuição para a meta com teto no alvo (16.4, 16.5);
- ranking **não** é recalculado dentro da colheita; só os read models da própria fazenda são atualizados (seção 20).

Teste obrigatório: duas colheitas simultâneas, esperando uma única recompensa.

Pendências da colheita:

- `[PENDENTE PD-07]` no site, colher por canteiro, "colher tudo" ou ambos, e se o cooldown vale para os dois. **Provisório:** a API oferece as duas rotas (28.4) e ambas respeitam o mesmo `Farm.next_harvest_at`.
- `[PENDENTE PD-08]` inventário cheio. **Provisório:** colhe em ordem de `slot_number` enquanto couber; o que não couber continua no canteiro (e continua apodrecendo); a resposta informa quantos ficaram. O cooldown só é aplicado se ao menos um canteiro for colhido.
  Salvaguarda `[TÉCNICA]`: o espaço de cada canteiro é verificado **antes** do sorteio de qualidade, considerando o pior caso (pilha nova). Se o resultado do sorteio decidisse se o canteiro cabe, o jogador poderia arrumar o inventário para só aceitar qualidades altas e "sortear de novo" as ruins.
- `[PENDENTE PD-09]` qualidade sorteada por plantio ou por unidade. **Provisório:** uma vez por plantio (todas as unidades do canteiro com a mesma qualidade).

Fluxo completo: 37.4.

## 7.7. Cooldown de colheita [FECHADA · v1.0 + TÉCNICA]

Regra `[FECHADA · v1.0]`:

```text
cooldown_final =
  cooldown_do_nível
  - benefício_permanente
  - boost_temporário
  - bônus_evento

Limite mínimo técnico inicial: 5 segundos. Configurável.
```

Implementação `[TÉCNICA]`:

- `cooldown_do_nível` = `LevelDefinition.harvest_cooldown_seconds`;
- os três descontos vêm do `ModifierService` (15.5) como modificadores do alvo `HARVEST_COOLDOWN`;
- resultado limitado ao mínimo (`harvest.min_cooldown_seconds`, inicial 5);
- gravado em `Farm.next_harvest_at = now + cooldown_final`.

## 7.8. XP da colheita [FECHADA · v1.0 + TÉCNICA]

Regra `[FECHADA · v1.0]`: XP de colheita vem da cultura (`CropDefinition.xp_reward`) ajustado pelo multiplicador de XP da qualidade (8.1). Item `ROTTEN` não gera XP.

Fórmula exata `[TÉCNICA]` — única fonte do XP base da colheita:

```text
para cada plantio p colhido nesta ação:
  harvestBaseXp(p)     = CropDefinition.xp_reward × p.seed_count        (xp_reward = XP por semente colhida)
  qualityAdjustedXp(p) = floor( harvestBaseXp(p) × quality(p).xp_multiplier_bps / 10000 )
                         (ROTTEN: xp_multiplier_bps = 0)

optionalActionBonusXp  = ActionXpDefinition(HARVEST_BONUS) ativa ? xp_amount (× plantios não podres, se per = UNIT) : 0

harvestXp              = Σ qualityAdjustedXp(p) + optionalActionBonusXp
finalHarvestXp         = applyModifiers(harvestXp, XP_GAIN)              (uma vez por ação; sem modificador = identidade)
```

- `ActionXpDefinition` **não** replica `CropDefinition.xp_reward`. `HARVEST_BONUS` significa somente bônus adicional explicitamente configurado e **não entra no seed do MVP** (fica 0); a capacidade permanece para o futuro.
- O multiplicador de qualidade é aplicado uma única vez por plantio; o floor é por plantio (determinístico, independente da ordem).
- A contribuição para a meta (16.4) não altera o XP: o XP usa sementes, não unidades recebidas.
- Toda concessão grava `ProgressLedger` (21.4).

Valores: `[PENDENTE PD-23]`.

---

# 8. QUALIDADES

## 8.1. Qualidades [FECHADA · v1.0 + TÉCNICA]

Qualidades iniciais `[FECHADA · v1.0]`: `COMMON`, `GOOD`, `EXCELLENT`, `EXTRAORDINARY`, `ROTTEN`.

Qualidade de sistema `NONE` para itens sem qualidade (sementes, rações, caixas) `[FECHADA · v1.2]`, evitando semântica problemática de `NULL` em chaves compostas.

```text
ItemQualityDefinition
  id
  code
  name
  color
  sell_multiplier_bps     10000 = 1,00x
  xp_multiplier_bps
  weight                  inteiro; chance = weight / soma dos pesos sorteáveis
  tractor_weight          peso usado quando o plantio tem bônus do trator
  drawable                participa do sorteio?
  is_system
  enabled
```

- A "probabilidade" da v1.0 é representada por **pesos inteiros** `[TÉCNICA]`: não precisam somar 100%, e o admin só salva se a soma dos sorteáveis for > 0.
- `ROTTEN` e `NONE`: `drawable = false`.
- Sorteio: `RandomSource` (8.2), sempre no servidor; produção usa `crypto.randomInt`.
- Pesos finais: `[PENDENTE PD-23]`.

## 8.2. Fonte única de aleatoriedade [TÉCNICA · v1.3.4]

Todo sorteio econômico usa uma interface única:

```ts
interface RandomSource {
  int(minInclusive: number, maxExclusive: number): number;
}
```

Produção: `CryptoRandomSource`, implementado com `crypto.randomInt`. Testes: `SeededRandomSource` determinístico.

Regras:

1. nunca usar `Math.random()` para economia;
2. pesos são inteiros positivos;
3. sorteio ponderado usa `total = Σweights`, `r = random.int(0, total)` e faixa cumulativa;
4. `crypto.randomInt` é usado pela implementação de produção para evitar viés de módulo;
5. cada resultado econômico é sorteado uma vez e persistido na mesma transação;
6. retry/replay lê o resultado persistido; nunca rerolla;
7. sorteios agendados usam uma chave de decisão estável, por exemplo `market:<item>:<date>` e `event:<community>:<tick_window>`, para que a mesma janela não sorteie duas vezes por retry.

Persistências mínimas: `PlantedCrop.result_quality_id`, `RewardBoxOpening.results`, `MarketPrice.price` e o fato de um `CommunityEvent` ter sido ou não criado por uma janela idempotente.

---

# 9. INVENTÁRIO E ITEM APODRECIDO

## 9.1. Itens [TÉCNICA]

```text
ItemDefinition
  id
  key               estável: "corn_seed", "corn", "chicken_feed", "hay", "egg", "milk", "farmer_box"...
  name              pt-BR
  category          SEED | CROP | ANIMAL_PRODUCT | FEED | REWARD_BOX | MISC
  has_quality
  base_price        moedas, inteiro
  npc_sellable
  p2p_tradeable
  discardable
  aliases           text[] — usado pelo chat
  enabled
  config            jsonb
```

Colecionáveis não são itens de inventário (11.3).

## 9.2. Inventário [TÉCNICA]

Quantidade é inteira e não negativa.

```text
InventoryItem
  id
  farm_id
  item_definition_id
  quality_id            NOT NULL (NONE para itens sem qualidade)
  quantity              CHECK (quantity >= 0)
  reserved_quantity     CHECK (reserved_quantity >= 0 AND reserved_quantity <= quantity)
  updated_at

UNIQUE(farm_id, item_definition_id, quality_id)
```

- `reserved_quantity` é usado para o Marketplace `[FECHADA · v1.0]`.
- Disponível = `quantity - reserved_quantity`. Toda validação de uso, venda, anúncio ou descarte usa o disponível.
- Reservar **não** reduz `quantity`: a reserva é uma segunda grandeza, registrada no `ItemLedger` em `reserved_delta` (21.3).
- Linha com `quantity = 0` é apagada (e então `reserved_quantity` também é 0). O ledger não referencia a linha por id; usa a chave `(farm_id, item_definition_id, quality_id)`.

## 9.3. Espaço [FECHADA · v1.0 + TÉCNICA]

A fazenda tem `inventory_slots` e `stack_limit` `[FECHADA · v1.0]`.

Regra de ocupação `[TÉCNICA]`: cada linha ocupa `ceil(quantity / stack_limit)` slots (itens reservados continuam ocupando espaço); a soma não pode passar de `inventory_slots`. Função `canFit(inventário, adições, stack_limit, slots)` em `game-rules`. Valores iniciais de `inventory_slots` e `stack_limit`: `[PENDENTE PD-23]`.

**Toda operação que adiciona itens verifica espaço antes de aplicar qualquer efeito**: colheita (PD-08), coleta de animal, compra na loja, compra no Marketplace (19.8), abertura de caixa (18.4), entrega e resgate de `RewardGrant` (18.7).

Expansão (`inventory/expand`): preço e limites `[PENDENTE PD-23]`.

## 9.4. Item apodrecido [FECHADA · v1.2]

A decisão está fechada e não pode aparecer como pendência.

Quando uma colheita apodrece:

- o item apodrecido entra no inventário;
- deve possuir aparência/representação deteriorada na UI;
- sua única ação funcional é **Descartar**;
- não pode ser plantado;
- não pode ser vendido;
- não pode ser anunciado no Marketplace;
- não pode ser utilizado em crafting/ração/etc. sem futura regra explícita.

A ação `Descartar`:

- reduz o inventário de forma transacional;
- gera `ItemLedger` com reason apropriado;
- é idempotente quando receber idempotency key.

Item apodrecido também não conta para metas comunitárias e não gera XP. `[TÉCNICA — consequência de "única ação funcional é Descartar"]`

## 9.5. Recompensas automáticas [TÉCNICA]

Recompensas entregues automaticamente (meta comunitária, evento) são `RewardGrant` (18.6). Com inventário cheio, o grant fica `AWAITING_SPACE` e o jogador resgata pelo site quando liberar espaço (`[PENDENTE PD-11]`, provisório). Nada é perdido.

---

# 10. LOJA, MERCADO GLOBAL E VENDA RÁPIDA

## 10.1. Fonte de sementes, ração e feno [PENDENTE PD-06]

O jogo começa com 3 sementes e 100 moedas, e os animais consomem ração e feno, mas nenhuma regra aprovada define de onde vêm novos itens.

**Provisório:** loja NPC.

```text
ShopOffer
  id
  item_definition_id
  buy_price
  min_level
  enabled
```

Invariante anti-arbitragem `[TÉCNICA]`, validada no admin ao salvar: o `buy_price` de uma oferta tem de ser maior que o maior valor possível de venda rápida do mesmo item. Sem isso, comprar na loja e vender no mercado vira fonte infinita de moedas.

## 10.2. Mercado global [FECHADA · v1.0 + TÉCNICA]

Regra `[FECHADA · v1.0]`: preço do dia por item, com variação; atualização 1x por dia.

```text
MarketPrice
  item_definition_id
  price_date          data no fuso America/Sao_Paulo
  price               inteiro
  variation_bps
  created_at

UNIQUE(item_definition_id, price_date)
```

Implementação `[TÉCNICA]`:

- job `market.daily-prices` às 00:00 America/Sao_Paulo, idempotente (upsert por item e data);
- variação limitada, só com inteiros: `variation_bps` sorteado no servidor via `RandomSource` (8.2) dentro da faixa configurada; `novo = clamp( floor(anterior × (10000 + variation_bps) / 10000), floor(base × min_factor_bps / 10000), floor(base × max_factor_bps / 10000) )`, com `variation_bps` podendo ser negativo;
- fallback: sem preço do dia → último preço conhecido → `base_price`. A venda nunca falha por atraso do job.

Faixa de variação e limites: `[PENDENTE PD-23]`.

## 10.3. Venda rápida [FECHADA · v1.0 + TÉCNICA]

Regra `[FECHADA · v1.0]`: valida estoque, busca preço do dia, aplica a qualidade do item, **aplica taxa de 2%**, remove item, adiciona moedas, registra a transação.

Implementação `[TÉCNICA]`:

- a qualidade não é "calculada" na venda: é lida do item (`sell_multiplier_bps`);
- item `ROTTEN` ou não `npc_sellable` → recusado;
- cálculo único em BigInt com floor no final:

```text
payout = floor( quantidade * preço_do_dia * sell_multiplier_bps * (10000 - 200)
                / 10000 / 10000 )
```

- `CoinLedger` + `ItemLedger` na mesma transação;
- XP de venda (13.1) + `ProgressLedger`.

---

# 11. TRATOR E COLECIONÁVEIS

## 11.1. Trator [FECHADA · v1.0 + TÉCNICA]

Regra `[FECHADA · v1.0]`: 1 uso a cada 24h por fazenda.

```text
TractorUsage
  farm_id                 PK
  last_used_at
  next_available_at
  pending_quality_bonus
```

## 11.2. Bônus no próximo plantio [FECHADA · v1.0 + TÉCNICA]

Regra `[FECHADA · v1.0]`: usar o trator deixa um bônus pendente; o **próximo plantio** recebe o bônus; na colheita desse plantio a qualidade usa probabilidades modificadas.

Implementação `[TÉCNICA]`:

- `pending_quality_bonus` é **consumido na transação do plantio** (volta a `false` ali), e o plantio guarda `tractor_bonus_applied = true`;
- na colheita, plantio com bônus usa `tractor_weight`;
- se a flag já estiver `true`, usar o trator de novo não acumula.

(Se a flag só voltasse a `false` depois da colheita, todo plantio feito até lá ganharia o bônus.)
`[PENDENTE PD-10]` quando um único `$plantar` preenche vários canteiros. **Provisório:** todos os canteiros daquele comando recebem o bônus.

## 11.3. Colecionáveis [FECHADA · v1.0 + TÉCNICA]

Regra `[FECHADA · v1.0]`: o trator pode encontrar colecionáveis; a coleção é separada do inventário.

```text
CollectibleDefinition
  id
  key
  name
  rarity
  weight        inteiro (representa a probabilidade da v1.0)
  enabled

FarmCollection
  farm_id
  collectible_id
  first_found_at
  quantity_found
  UNIQUE(farm_id, collectible_id)
```

Sorteio ao usar o trator: via `RandomSource` (8.2), chance de encontrar algo (`tractor.find_chance_bps`) e, se encontrar, sorteio por `weight`. Valores: `[PENDENTE PD-23]`.

---

# 12. ANIMAIS

## 12.1. Modelo geral [TÉCNICA]

```text
FarmAnimal
  id
  farm_id
  animal_type             CHICKEN | COW | PIG
  status                  ACTIVE | SOLD
  stage                   só PIG: PIGLET | FED_ONCE | ADULT
  cycle_started_at        alimentação que iniciou o ciclo atual
  cycle_units_total
  cycle_units_collected
  next_feed_available_at
  acquired_at
  sold_at
  config
```

Estados de produção são **derivados** de `cycle_*` e `now`, como os canteiros. Ações por animal (rotas 28.7).

Compra e venda de animal usam ledger. Nunca `farm.coins -= 30` sem entrada correspondente no `CoinLedger`. `[FECHADA · v1.2]`

## 12.2. Galinha [FECHADA · v1.0 + TÉCNICA]

Regra `[FECHADA · v1.0]`: 1 Ração → até 3 ovos → 1 ovo a cada 2h. Estados: `IDLE`, `FED`, `PRODUCING`, `FULL`.

Cálculo `[TÉCNICA]`:

```text
produzidos(now) = min(3, floor((now - cycle_started_at) / 2h))
disponíveis     = produzidos - cycle_units_collected
```

| Estado | Condição |
|---|---|
| `IDLE` | sem ciclo, ou ciclo completo (3 produzidos e 3 coletados) |
| `FED` | alimentada, nenhum ovo produzido ainda |
| `PRODUCING` | 1 ou 2 ovos produzidos |
| `FULL` | 3 produzidos e ainda há ovo a coletar |

Alimentar: só em `IDLE`. Coletar: entrega todos os disponíveis.

Preço e limite de galinhas por fazenda: `[PENDENTE PD-23]`.

## 12.3. Vaca [FECHADA · v1.0 + TÉCNICA]

Regra `[FECHADA · v1.0]`: 1 Feno → 3h → 1 Leite → `WAIT_COLLECTION`; após a coleta → `IDLE`.

| Estado | Condição |
|---|---|
| `IDLE` | sem ciclo |
| `PRODUCING` | `now < cycle_started_at + 3h` |
| `WAIT_COLLECTION` | `now >= cycle_started_at + 3h` e não coletado |

Preço e limite de vacas por fazenda: `[PENDENTE PD-23]`.

## 12.4. Porco [FECHADA · v1.0 + FECHADA · v1.2]

Ciclo `[FECHADA · v1.0]`:

```text
PIGLET --alimentação 1--> FED_ONCE --(24h)--> alimentação 2 --> ADULT --venda--> SOLD
```

Valores iniciais `[FECHADA · v1.2]` — não são pendentes:

- compra do filhote: **30 moedas**;
- venda prematura: **15 moedas**;
- venda adulto: **100 moedas**;
- limite inicial: **2 porcos**.

"Venda prematura" = venda em qualquer estágio anterior a `ADULT` (`PIGLET` ou `FED_ONCE`).

Compra valida, dentro da transação: saldo; limite de animais; estado da fazenda; idempotência.
Venda valida: propriedade; estado do animal; valor aplicável conforme estágio; não vendido anteriormente.

Implementação `[TÉCNICA]`: o limite conta porcos `ACTIVE` da fazenda (animais pertencem à fazenda e o limite é validado junto com o estado da fazenda, com ela travada); porcos `SOLD` não contam. Compra: `CoinLedger ANIMAL_BUY`; venda: `UPDATE ... WHERE status = 'ACTIVE'` + `CoinLedger ANIMAL_SELL` com o valor do estágio no momento da venda.

Alimento do porco e demais parâmetros não definidos: `[PENDENTE PD-23]` — não inventar.

## 12.5. Cavalo [FECHADA · v1.0]

```text
FarmUpgrade
  farm_id
  upgrade_type      HORSE (e futuros)
  acquired_at
  UNIQUE(farm_id, upgrade_type)
```

- Benefício: **12h → 10h**, aplicado ao cooldown do anúncio e à retirada no Marketplace.
- Preço inicial: **20.000 moedas**.

Como o cavalo (da fazenda) se combina com o cooldown global por usuário: `[PENDENTE PD-18]` (19.5).

---

# 13. XP, NÍVEL E PROGRESSÃO

## 13.1. Ações que concedem XP [FECHADA · v1.2]

XP pode ser concedido por:

- plantar;
- colher;
- vender;
- eventos;
- missões quando o módulo de missões for implementado.

A ausência do módulo de missões no MVP não autoriza remover a categoria da arquitetura de progressão futura.

`[PENDENTE PD-19]` quais vendas concedem XP: venda rápida, venda no Marketplace P2P, venda de animal? Como o P2P não tem taxa, duas contas do mesmo jogador poderiam vender uma para a outra só para ganhar XP. **Provisório:** XP de venda apenas na venda rápida (`NPC_SELL`); P2P e venda de animal sem XP até decisão.

## 13.2. Curva cumulativa [FECHADA · v1.2]

A interpretação correta da regra inicial é cumulativa.

```text
Nível 1 -> 2 = 100 XP
Nível 2 -> 3 = +200 XP

nível 2 exige 100 XP total
nível 3 exige 300 XP total
```

`xp_required_total` representa XP acumulado mínimo para entrar no nível. Uma ação pode subir vários níveis de uma vez.

## 13.3. Configuração data-driven [TÉCNICA]

```text
LevelDefinition
  level                       PK
  xp_required_total
  harvest_cooldown_seconds    cooldown de colheita do nível (7.7)
  unlocks                     jsonb (canteiros, culturas...)

ActionXpDefinition
  id
  action_type                 PLANT | HARVEST_BONUS | NPC_SELL | EVENT_PARTICIPATION | MISSION
  per                         ACTION | UNIT      (por ação ou por unidade: semente plantada, item vendido...)
  xp_amount                   CHECK (xp_amount >= 0)
  active_from
  active_to                   nullable
  EXCLUDE USING gist (action_type WITH =, tstzrange(active_from, active_to) WITH &&)
```

- No máximo uma definição vigente por `action_type` em cada instante (exclusion constraint), então o XP de uma ação nunca é somado duas vezes.
- XP base da colheita **não** está aqui: vem só de `CropDefinition.xp_reward` (7.8). `HARVEST_BONUS` é bônus adicional opcional, fora do seed do MVP.
- Modificadores de XP (`XP_GAIN`, 15.5) são aplicados uma vez sobre o total da ação.
- A curva em uso só muda por migração controlada com decisão de produto; o nível é recalculado a partir de `xp` (`maior nível com xp_required_total <= xp`).

Não espalhar valores de XP em controllers. Curva completa e XP por ação: `[PENDENTE PD-23]`.

## 13.4. Ganho de XP atômico [TÉCNICA]

A concessão de XP ocorre na mesma transação da ação que a originou:

```text
validar -> bloquear -> gerar itens -> ItemLedger -> XP + ProgressLedger -> nível -> atualização de stats -> Outbox
```

Se a transação falhar, nenhuma dessas etapas permanece parcialmente aplicada. Toda alteração de XP (nível, colecionador, contribuição) grava `ProgressLedger` (21.4).

---

# 14. NÍVEL DE COLECIONADOR, CONTRIBUIÇÃO E TÍTULOS

## 14.1. Progressões separadas [FECHADA · v1.2]

Ranking e perfil precisam suportar, independentemente:

- Nível;
- Nível de Colecionador;
- Nível de Contribuição;
- Dinheiro.

Não derivar todos esses conceitos de `Farm.level`.

## 14.2. Nível de Colecionador [TÉCNICA]

```text
FarmCollectorProgress
  farm_id             UNIQUE
  collector_xp
  collector_level
  updated_at
```

## 14.3. Nível de Contribuição [TÉCNICA]

```text
FarmContributionProgress
  farm_id             UNIQUE
  contribution_xp
  contribution_level
  updated_at
```

Contribuições válidas são contabilizadas de modo idempotente, na mesma transação da contribuição (16.4).

Fontes e valores de XP de colecionador e de contribuição: `[PENDENTE PD-22]`.

## 14.4. Título "Colecionador" [FECHADA · v1.2]

O sistema deve suportar título visível aos demais jogadores da comunidade.

```text
TitleDefinition
FarmUnlockedTitle
Farm.active_title_id
```

O título não deve ser apenas string livre editável pelo usuário.

Implementação `[TÉCNICA]`: `FarmUnlockedTitle` com `PK(farm_id, title_definition_id)`; `Farm.active_title_id` com FK composta `(farm.id, active_title_id) -> FarmUnlockedTitle(farm_id, title_definition_id)`, então o título ativo precisa estar desbloqueado. O jogador escolhe o título ativo pela rota 28.3.

Critério para desbloquear o título: `[PENDENTE PD-22]`.

---

# 15. COMUNIDADES, BENEFÍCIOS E BOOSTS

## 15.1. Conceito [FECHADA · v1.0]

A comunidade é associada ao streamer/canal (uma por streamer) e agrega as fazendas participantes.

```text
Community
  id
  streamer_id         UNIQUE
  UNIQUE(id, streamer_id)          alvo das FKs compostas de Farm
```

`[TÉCNICA]`: `Community` não tem status próprio. "Comunidade suspensa" = `Streamer.approval_status = SUSPENDED` (derivado), evitando dois estados que podem divergir. A comunidade é criada na transação de aprovação do streamer. Nunca é travada (22.3).

## 15.2. Membership [FECHADA · v1.2 + TÉCNICA]

Estados mínimos:

```text
ACTIVE
REMOVED
LEFT
```

Se houver convite/aprovação futuramente, novos estados devem ser adicionados apenas quando a funcionalidade for aprovada.

```text
CommunityMembership
  community_id
  farm_id               UNIQUE
  user_id
  status
  joined_at
  removed_at
  removed_by_user_id
  readmitted_at
  FK (farm_id, community_id) -> Farm(id, community_id)

CommunityMembershipHistory          append-only
  id                    bigserial
  farm_id
  community_id
  status                ACTIVE | REMOVED | LEFT
  changed_at
  changed_by_user_id    nullable
  reason                nullable
```

`[TÉCNICA]`:

- a fazenda nasce como membro `ACTIVE` da comunidade do seu streamer (na mesma transação da criação). Fazenda vendida → `LEFT`;
- toda mudança de membership grava uma linha em `CommunityMembershipHistory` na mesma transação. O estado vigente num instante `t` é a última linha com `changed_at <= t` (empate conta como anterior a `t`). Esse histórico permite avaliar elegibilidade em qualquer momento (18.8);
- membership e histórico são linhas filhas da fazenda (lock R5).

## 15.3. Remoção e readmissão [FECHADA · v1.0 + FECHADA · v1.2]

- O streamer remove e readmite membros da própria comunidade `[FECHADA · v1.0]`.
- SUPPORT pode executar readmissão quando autorizado pela regra do produto `[FECHADA · v1.2]`.
- Efeito da remoção: seção 6.5 `[FECHADA · v1.2]`.
- Toda remoção e readmissão gera `AuditLog` `[TÉCNICA]`.
- Implementação `[TÉCNICA]`: remover e readmitir travam a `Farm` (a membership é linha filha, 22.2), para que nenhuma ação em andamento na fazenda termine depois da remoção. Transição por `UPDATE ... WHERE status = <origem>` + histórico + `AuditLog`.
- Readmissão por SUPPORT: sem procedimento aprovado, a rota responde 501 (`[PENDENTE PD-29]`).

## 15.4. Benefício permanente vs Boost temporário [FECHADA · v1.2]

São mecanismos diferentes e não devem usar a mesma entidade sem distinção semântica.

**Benefício permanente** — depois de desbloqueado, continua ativo segundo a regra da comunidade.

```text
CommunityBenefitDefinition
  id
  key
  name
  modifiers           jsonb (lista de Modifier — 15.5)
  enabled

CommunityUnlockedBenefit
  community_id
  benefit_definition_id
  unlocked_at
  source_ref
  UNIQUE(community_id, benefit_definition_id)      benefício permanente se desbloqueia uma vez
```

**Boost temporário** — efeito temporário após cumprimento de meta/evento. Duração inicial aprovada do boost correspondente: **2 dias**.

```text
CommunityBoostDefinition
  id
  key
  name
  modifiers           jsonb
  duration_seconds    (boost de meta: 172800 = 2 dias)
  enabled

CommunityActiveBoost
  id
  community_id
  boost_definition_id
  source              GOAL | EVENT | ADMIN
  source_ref          NOT NULL (id da meta, do evento ou da ação administrativa)
  starts_at           instante do fato (ex.: completed_at da meta)
  ends_at             starts_at + duration_seconds (congelado)
  ended_announced_at  nullable (só controle do aviso de fim)
  UNIQUE(community_id, source, source_ref, boost_definition_id)
```

`[TÉCNICA]`:

- Boost ativo = `starts_at <= now < ends_at` (derivado; não depende do worker).
- A mesma origem não cria o mesmo boost duas vezes: o `UNIQUE` acima faz a reexecução de um job virar `ON CONFLICT DO NOTHING`. Composição completa (sem índice parcial) porque nenhuma origem legítima cria duas vezes o mesmo boost.
- Depois de criado, o boost não é travado e só `ended_announced_at` é alterado, por `boosts.announce` (25.1), com `UPDATE ... WHERE ended_announced_at IS NULL`. Início e fim nunca mudam.

Quais benefícios e boosts existem além do boost de meta: `[PENDENTE PD-23]`.

## 15.5. ModifierService [TÉCNICA]

Uma única camada calcula os modificadores efetivos considerando:

- benefícios permanentes;
- boosts temporários ativos;
- eventos globais/comunitários aplicáveis;
- regras da fazenda quando existirem (ex.: cavalo, bônus do trator).

Nenhum módulo deve replicar manualmente a lógica de benefícios.

```text
Modifier (estrutura em memória)
  source    BENEFIT | BOOST | EVENT | UPGRADE | TRACTOR | ADMIN
  target    HARVEST_COOLDOWN | GROWTH_TIME | XP_GAIN | QUALITY_WEIGHTS
            | NPC_SELL_PRICE | LISTING_COOLDOWN | ...
  op        ADD | MULTIPLY_BPS
  value
```

Fórmula (função pura em `game-rules`, inteiros/BigInt, floor uma vez no final):

```text
final = clamp( floor( base × Π(multiplicador_bps) / 10000^k ) + Σ(adições), mínimo, máximo )
```

- Efeito de evento vale enquanto `starts_at <= now < COALESCE(ended_at, ends_at)`.
- Modificadores de prazo (ex.: `GROWTH_TIME`) são avaliados no momento da criação e o resultado fica congelado no registro (2.5).
- Membro que não está `ACTIVE` não joga a fazenda (6.5), portanto não recebe modificadores.

---

# 16. META COMUNITÁRIA

## 16.1. Regra [FECHADA · v1.0]

- Cada comunidade tem uma meta de item com quantidade alvo e prazo.
- A colheita atualiza a comunidade: uma porcentagem da colheita do item da meta contribui para ela.
- Frações acumuladas sem perda.
- Ao completar, cada participante recebe a caixa, que entra automaticamente no inventário, e a comunidade recebe um boost (2 dias — 15.4).
- O streamer envia a mercadoria; depois disso o estoque da meta volta a zero.
- A comunidade poderá prosseguir quando o boost terminar.
- Prazo esgotado sem atingir a meta: falha e recomeça (reset).

## 16.2. Máquina de estados [FECHADA · v1.0 + TÉCNICA]

```text
COLLECTING
   |
   +-- prazo acabou --------------> FAILED --> reset (nova meta)
   |
   +-- meta atingida --> COMPLETED
                            |
                            | recompensas + boost
                            v
                     WAITING_SHIPMENT
                            |
                            | streamer envia mercadoria
                            v
                      GOODS_SHIPPED
                            |
                            | boost termina
                            v
                       NEXT_CYCLE (nova meta)
```

Representação `[TÉCNICA]` — `status`: `COLLECTING | COMPLETED | WAITING_SHIPMENT | GOODS_SHIPPED | FAILED | CLOSED`.

Todas as transições ocorrem com a linha da `CommunityGoal` travada (`FOR NO KEY UPDATE`) e por `UPDATE` condicional ao status de origem:

| De | Para | Quem executa | Condição |
|---|---|---|---|
| `COLLECTING` | `COMPLETED` | transação da colheita | `current_quantity = target_quantity`; cria o boost e o outbox `internal.goal.completed` |
| `COLLECTING` | `FAILED` | `goals.sweep` | `now >= ends_at` e `current_quantity < target_quantity` |
| `COMPLETED` | `WAITING_SHIPMENT` | job `goal.complete` | todos os `RewardGrant` criados (16.6); o boost já nasceu na transação da conclusão (16.5) |
| `WAITING_SHIPMENT` | `GOODS_SHIPPED` | streamer (`ship-goods`) | — |
| `GOODS_SHIPPED` | `CLOSED` | job `goal.advance` / `goals.sweep` | boost desta meta encerrado (`now >= boost.ends_at`) |
| `FAILED` | `CLOSED` | job `goal.advance` / `goals.sweep` | sempre |
| `CLOSED` | — | — | terminal |

"reset" e "NEXT_CYCLE" são representados assim: a meta atual vai para `CLOSED` e, **na mesma transação**, é criada uma nova linha `COLLECTING` com `cycle_number + 1`.

Índice de meta aberta:

```sql
CREATE UNIQUE INDEX community_goal_open_uq ON community_goal (community_id) WHERE status <> 'CLOSED';
```

Consequência: `FAILED`, `COMPLETED`, `WAITING_SHIPMENT` e `GOODS_SHIPPED` ocupam a vaga de meta aberta. **Nunca** tentar criar a próxima meta enquanto a anterior não estiver `CLOSED`. O `UPDATE ... SET status = 'CLOSED'` vem antes do `INSERT` da nova meta na mesma transação (o índice parcial é verificado por comando, então o `INSERT` passa). Uma comunidade nunca possui duas metas abertas.

Em `FAILED` não há recompensa (recompensas só existem em `COMPLETED`). `[FECHADA · v1.0]`

Pendências ligadas:

- `[PENDENTE PD-13]` como a próxima meta é escolhida. **Provisório:** sequência cíclica de `CommunityGoalTemplate` definida no admin.
- `[PENDENTE PD-26]` meta concluída cuja mercadoria nunca é enviada. **Provisório:** sem prazo — a meta permanece em `WAITING_SHIPMENT` (leitura literal da regra v1.0); nenhuma ferramenta automática ou administrativa força o envio.
- `[PENDENTE PD-03]` streamer suspenso. **Provisório:** jobs não criam nova meta para streamer `SUSPENDED`; consequências já comprometidas (recompensas registradas) seguem.

## 16.3. Entidade [TÉCNICA]

```text
CommunityGoal
  id
  community_id
  cycle_number
  template_id
  item_definition_id
  target_quantity                 CHECK (target_quantity > 0)
  current_quantity                CHECK (current_quantity >= 0 AND current_quantity <= target_quantity)
  contribution_bps                CHECK (contribution_bps BETWEEN 0 AND 10000)  (representa o contribution_percent)
  starts_at
  ends_at
  status
  completed_at
  failed_at
  shipped_at
  closed_at
  reward_item_definition_id       a caixa
  boost_definition_id

UNIQUE(community_id, cycle_number)
```

Cada participante elegível recebe **1 unidade** de `reward_item_definition_id` (`[FECHADA · v1.0]`: "a caixa entra automaticamente no inventário").

`CommunityGoalTemplate` (item, alvo, porcentagem, duração, recompensa, boost, ordem) fica no admin; a meta copia os valores do template na criação (snapshot).

## 16.4. Contribuição [FECHADA · v1.0 + TÉCNICA]

```text
CommunityGoalContribution
  goal_id
  farm_id
  contributed_units     CHECK (contributed_units >= 0)
  fraction_acc          CHECK (fraction_acc BETWEEN 0 AND 9999)
  updated_at
  PK(goal_id, farm_id)
```

(`reward_status` foi removido: o estado da recompensa vive só em `RewardGrant` — 18.6.)

"Frações acumuladas sem perda" `[FECHADA · v1.0]`, implementado só com inteiros e **sem ultrapassar o alvo** `[TÉCNICA]`.

A meta é **aplicável** a um plantio colhido quando, com a meta travada e relida:

- `status = 'COLLECTING'` e `now < ends_at` (depois do prazo não se contribui, mesmo que o sweep ainda não tenha marcado `FAILED`);
- produto do plantio = `item_definition_id` da meta;
- qualidade do resultado ≠ `ROTTEN`;
- membership da fazenda `ACTIVE` (já garantido pelo acesso — 6.5).

Cálculo por plantio colhido, em ordem de `slot_number` (cada plantio tem a sua qualidade):

```text
remaining = target_quantity - current_quantity            (lido com a meta travada)

para cada plantio p aplicável:
  bruto         = quantidade(p) * contribution_bps + fraction_acc
  candidate     = floor(bruto / 10000)
  fraction_acc  = bruto mod 10000
  accepted      = min(candidate, remaining)
  remaining     = remaining - accepted
  jogador recebe quantidade(p) - accepted                   (PD-12 provisório: descontada)

para plantio não aplicável: accepted = 0; jogador recebe quantidade(p)
```

Regras:

- **Somente `accepted`** aumenta `CommunityGoal.current_quantity`, é descontado da colheita (enquanto o provisório de PD-12 valer), aumenta `contributed_units` e alimenta `FarmContributionProgress`.
- O excedente (`candidate - accepted`) permanece com o jogador.
- A meta nunca ultrapassa `target_quantity` (lógica acima + `CHECK`).
- Quando `remaining` chega a 0, a meta vai para `COMPLETED` na mesma transação (16.5). A partir daí não recebe contribuições; o `fraction_acc` fica apenas como histórico.
- A contribuição não altera o XP da colheita (7.8 usa sementes, não unidades recebidas).

`[PENDENTE PD-12]` a contribuição é descontada da colheita do jogador ou é adicional? **Provisório:** descontada.

Exemplo obrigatório (teste 36.3): meta em 998/1000; fazendas A e B colhem ao mesmo tempo com `candidate = 5` cada. Quem obtiver o lock da meta primeiro aceita 2 e completa a meta (1000/1000); a outra relê `COMPLETED` e aceita 0. Soma aceita = 2; o excedente (3 de uma, 5 da outra) fica com os jogadores; uma única conclusão.

## 16.5. Concorrência na colheita [TÉCNICA]

Sequência dentro da transação da colheita (37.4):

1. lock `Farm` (ordem 22.3, nível R5);
2. calcular plantios a colher, espaço (pior caso, sem desconto) e qualidades;
3. se algum plantio colhido tiver o produto da meta aberta da comunidade com qualidade ≠ `ROTTEN`: `SELECT ... FOR NO KEY UPDATE` na `CommunityGoal` (R7) e **reler** `status`, `current_quantity`, `target_quantity`, `ends_at`;
4. calcular `accepted` por plantio (16.4);
5. gravar inventário, `ItemLedger` (`HARVEST` e `GOAL_CONTRIBUTION`), contribuição, `FarmContributionProgress` e `ProgressLedger`;
6. `UPDATE community_goal SET current_quantity = current_quantity + Σaccepted`;
7. se `current_quantity = target_quantity`: `status = 'COMPLETED'`, `completed_at = linearized_at`; materializar `RewardEligibilitySnapshot` para todos os contribuintes da meta por `INSERT ... SELECT` (18.8); `INSERT CommunityActiveBoost` (`source = GOAL`, `source_ref = goal_id`, `starts_at = completed_at`, `ends_at = completed_at + duração`) e `INSERT OutboxMessage(topic = 'internal.goal.completed', aggregate_id = goal_id)`. O boost e o snapshot nascem na mesma transação da conclusão: valem desde o instante do fato, sem depender do worker (2.9, 2.10);
8. XP, stats, outbox `realtime.*`/`chat.*`; commit.

A leitura sem lock usada no passo 3 só decide **se** é preciso travar a meta; a decisão de quanto aceitar usa sempre a releitura travada. Status só sai de `COLLECTING` para frente; uma meta nova criada em paralelo é tratada como posterior à colheita.

Após o passo 3 a transação só faz escritas curtas, sem chamadas externas.

## 16.6. Conclusão e recompensas [TÉCNICA]

Job `goal.complete:{goal_id}`, disparado pelo outbox `internal.goal.completed` (24.4) e recuperado pelo `goals.sweep` se a meta ficar em `COMPLETED` por mais de 2 minutos.

Transação única, travando **apenas** a `CommunityGoal` (R7):

1. reler; se `status <> 'COMPLETED'` → nada a fazer (já processada);
2. ler os `RewardEligibilitySnapshot` imutáveis desta meta (18.8) e inserir `RewardGrant` (`PENDING` quando `eligible = true`, `NOT_ELIGIBLE` caso contrário, 1 caixa) com `ON CONFLICT DO NOTHING`; o job nunca recalcula o estado histórico;
3. garantir o boost: `INSERT CommunityActiveBoost ... ON CONFLICT DO NOTHING` (normalmente já criado na conclusão — 16.5; aqui é só defesa);
4. `status = 'WAITING_SHIPMENT'`;
5. outbox: `internal.rewards.process` (fonte = esta meta), `realtime` `community.goal.completed`, mensagem de chat;
6. commit.

Garantias:

- recompensas e mudança de status são atômicos: ou tudo, ou nada; o boost já existe desde a conclusão;
- se o número de participantes tornar a transação de grants longa demais para 10s, materializar `RewardGrant` em páginas a partir dos snapshots já congelados: cada página usa `ON CONFLICT DO NOTHING` e só a última muda o status para `WAITING_SHIPMENT`; elegibilidade não é recalculada;
- rodar o job duas vezes não cria nada novo (status + `UNIQUE` de `RewardGrant` e do boost);
- consequências usam o **instante do fato** (`completed_at`), não o instante do processamento: um job atrasado não encurta nem desloca o boost de 2 dias;
- a entrega dos itens acontece depois, por fazenda (18.7).

## 16.7. Envio da mercadoria [FECHADA · v1.0 + TÉCNICA]

- Somente o streamer dono da comunidade `[FECHADA · v1.0]`.
- Trava a `CommunityGoal`; requer `WAITING_SHIPMENT` → `GOODS_SHIPPED`, `shipped_at = now` `[TÉCNICA]`.
- Se o job de conclusão ainda não rodou (status `COMPLETED`), responde `GOAL_NOT_AWAITING_SHIPMENT`.
- Ação auditada; outbox `internal.goal.advance`.

## 16.8. Avanço de ciclo e varredura [TÉCNICA]

Job `goals.sweep` (cron a cada 1 minuto) e job `goal.advance` (via outbox). Cada meta é tratada numa transação própria com a meta travada:

| Situação encontrada | Ação |
|---|---|
| `COLLECTING` e `now >= ends_at` | `FAILED`, `failed_at = ends_at`; outbox `internal.goal.advance` |
| `FAILED` | `CLOSED`, `closed_at = now` + nova meta `COLLECTING` (mesma transação) + outbox |
| `GOODS_SHIPPED` e boost da meta encerrado | `CLOSED` + nova meta `COLLECTING` (mesma transação) + outbox |
| `COMPLETED` há mais de 2 minutos | reenfileira `goal.complete` (recuperação) |
| comunidade de streamer `APPROVED` sem meta aberta | cria a primeira meta (o índice único impede duplicata; conflito = nada a fazer) |

Nenhuma dessas transições depende de job agendado para um horário futuro: o sweep encontra o estado vencido a partir dos dados.

---

# 17. EVENTOS

## 17.1. Definição [FECHADA · v1.0 + TÉCNICA]

Regra `[FECHADA · v1.0]`: eventos têm nome, se valem só com live (`live_only`), duração, probabilidade, cooldown, efeito, mensagem de início e de fim; no máximo 1 evento ativo por comunidade.

```text
EventDefinition
  id
  key
  name
  live_only
  duration_seconds
  probability_bps               chance por rodada de sorteio
  cooldown_seconds
  modifiers                     jsonb (representa effect_type/effect_value — 15.5)
  target_participants           nullable (eventos participativos — 17.2)
  action_command                nullable (ex.: "espantar")
  reward_item_definition_id     nullable (ex.: Caixa do Fazendeiro)
  reward_quantity               nullable, CHECK (reward_quantity > 0)
  boost_definition_id           nullable
  message_start_key             -> BotMessageTemplate
  message_end_key               -> BotMessageTemplate
  enabled
```

## 17.2. Evento com participação [FECHADA · v1.2]

A arquitetura precisa suportar eventos cujo objetivo depende da quantidade de jogadores participantes.

Exemplo aprovado: evento do **Lobo** com meta de **30 jogadores participantes**.

Não basta modelar apenas duração + modifier + comando.

```text
CommunityEvent
  id
  community_id
  definition_id
  starts_at
  ends_at
  status                  ACTIVE | ENDED
  outcome                 NULL | SUCCEEDED | FAILED    (só eventos participativos)
  target_participants     snapshot da definição
  participant_count       CHECK (participant_count >= 0)
                          CHECK (target_participants IS NULL OR participant_count <= target_participants)
  completed_at            instante em que o alvo foi atingido
  ended_at
  rewards_materialized_at nullable (marca de processamento do job de conclusão)

CommunityEventParticipant
  event_id
  farm_id
  user_id
  participated_at
```

Invariantes:

```text
UNIQUE(event_id, farm_id)                                  -- a mesma fazenda não conta duas vezes
UNIQUE(community_id) WHERE status = 'ACTIVE'               -- 1 evento ativo por comunidade [FECHADA · v1.0]
```

Uma comunidade tem uma fazenda por jogador (6.1), então "30 jogadores" = 30 fazendas distintas daquela comunidade.

`status` (ativo/encerrado) e `outcome` (resultado) são separados de propósito: o índice de "1 evento ativo" depende só de `status`, qualquer que seja a decisão de PD-30.

## 17.3. Conclusão [FECHADA · v1.2 + TÉCNICA]

Quando o número válido de participantes atingir `target_participants`:

- exatamente uma conclusão é registrada;
- as recompensas são distribuídas de maneira idempotente;
- a Caixa do Fazendeiro é entregue conforme regra do evento;
- outbox anuncia a conclusão somente após commit.

Concorrência obrigatória: duas participações simultâneas podendo atingir a meta não podem concluir/distribuir duas vezes.

Implementação `[TÉCNICA]`:

- Participação: lock `Farm` (R5) → lock `CommunityEvent` (R6); validar `status = 'ACTIVE'`, `outcome IS NULL` e `now < ends_at` (vale para qualquer decisão de PD-30); inserir participante (`UNIQUE`); `participant_count + 1`.
- Se `participant_count = target_participants`: `outcome = 'SUCCEEDED'`, `completed_at = linearized_at`; materializar `RewardEligibilitySnapshot` para os participantes por `INSERT ... SELECT` (18.8); criar boost da definição, se houver (`starts_at = completed_at`, `ON CONFLICT DO NOTHING`), e `INSERT OutboxMessage('internal.event.completed')` na mesma transação. Participações seguintes encontram o evento concluído e recebem `EVENT_NOT_ACTIVE` (o contador nunca passa do alvo).
- `[PENDENTE PD-30]` o evento participativo termina ao atingir o alvo ou segue até `ends_at`? A falha (alvo não atingido no prazo) tem consequência? **Provisório:** termina na conclusão (`status = 'ENDED'`, `ended_at = completed_at`); falha sem consequência além de não haver recompensa.
- Job `event.complete:{event_id}`: trava só o `CommunityEvent` (R6); se `outcome = 'SUCCEEDED'` e `rewards_materialized_at IS NULL`: lê os `RewardEligibilitySnapshot` imutáveis do evento (18.8) e materializa `RewardGrant` (`ON CONFLICT DO NOTHING`); garante o boost (`ON CONFLICT DO NOTHING`, defesa); `rewards_materialized_at = linearized_at`; outbox `internal.rewards.process`, `realtime`, chat. Rodar duas vezes não cria nada novo e nunca recalcula elegibilidade histórica.
- XP de evento `[FECHADA · v1.2]` — valor e momento: `[PENDENTE PD-23]`. **Provisório:** na participação (`ActionXpDefinition EVENT_PARTICIPATION`).

## 17.4. Sorteio, fim e status da live [TÉCNICA]

- `events.sweep` (cron a cada 1 minuto), por evento, com o evento travado: `ACTIVE` e `now >= ends_at` → `ENDED`, `ended_at = ends_at`, `outcome = 'FAILED'` se era participativo e não atingiu o alvo; outbox `event.ended`. Também reenfileira `event.complete` para eventos `SUCCEEDED` com `rewards_materialized_at IS NULL` há mais de 2 minutos.
- `events.tick` (cron a cada N minutos): primeiro encerra eventos vencidos da comunidade (mesma regra do sweep), depois, para cada comunidade de streamer `APPROVED`, sem evento `ACTIVE`, fora do cooldown e ao vivo (se `live_only`), sorteia via `RandomSource` (8.2) com `probability_bps`; se sair, cria o `CommunityEvent` (o índice único impede dois ativos).
- **Não existe job agendado para `ends_at`**: se o processo cair depois de criar o evento, o sweep o encerra mesmo assim. O efeito vale enquanto `now < ends_at` (derivado), então um sweep atrasado não prolonga efeito.
- Cooldown: contado a partir do `ended_at` do último evento da mesma definição naquela comunidade.
- "Ao vivo" = `Streamer.is_live`, atualizado por EventSub `stream.online`/`stream.offline` e reconciliado a cada 5 minutos pela Twitch API.

`[PENDENTE PD-14]` a live cai durante evento `live_only`. **Provisório:** o evento continua até `ends_at`.

Valores e regras de eventos além do Lobo: `[PENDENTE PD-23]`.

---

# 18. CAIXA DO FAZENDEIRO E RECOMPENSAS AUTOMÁTICAS

## 18.1. A caixa é item real [FECHADA · v1.2]

`REWARD_BOX` não é apenas marcador genérico.

O sistema deve permitir:

- possuir caixa no inventário;
- abrir caixa;
- consumir exatamente uma caixa;
- sortear conteúdo no servidor;
- conceder de **1 a 4 itens**;
- registrar todos os deltas no `ItemLedger`;
- repetir a mesma resposta quando a mesma idempotency key for reenviada, sem abrir nova caixa.

## 18.2. Loot table [TÉCNICA]

```text
ItemDefinition (categoria REWARD_BOX)
  loot_table_id           obrigatório para REWARD_BOX
                          CHECK (category <> 'REWARD_BOX' OR loot_table_id IS NOT NULL)

LootTable
  id
  code
  version                 versão imutável: mudar conteúdo = nova linha
  active
  UNIQUE(code, version)

LootTableDrawCount        quantos sorteios a caixa faz
  loot_table_id
  draws                   CHECK (draws BETWEEN 1 AND 4)
  weight                  CHECK (weight > 0)

LootEntry
  loot_table_id
  item_definition_id
  quality_id
  weight                  CHECK (weight > 0)
  min_quantity            CHECK (min_quantity >= 1)
  max_quantity            CHECK (max_quantity >= min_quantity)
  conditions_json         nullable
```

Garantia de "1 a 4 itens" `[TÉCNICA]`: o admin só ativa uma loot table se `max(draws) × max(max_quantity) ≤ 4` e `min(draws) × min(min_quantity) ≥ 1`. Na configuração inicial, toda entrada usa `min_quantity = max_quantity = 1`. Assim a caixa entrega de 1 a 4 sorteios **e** de 1 a 4 unidades no total, atendendo às duas leituras possíveis da regra sem escolher entre elas.

Probabilidade nunca é calculada no browser. Conteúdo, pesos e distribuição de sorteios: `[PENDENTE PD-23]`.

## 18.3. Abertura com idempotência permanente [TÉCNICA]

```text
RewardBoxOpening
  id
  farm_id
  idempotency_key         NOT NULL
  request_hash
  box_item_definition_id  a caixa consumida
  loot_table_id
  loot_table_version
  results                 jsonb (itens, qualidades, quantidades)
  opened_at

CREATE UNIQUE INDEX reward_box_opening_idem_uq ON reward_box_opening (farm_id, idempotency_key);
```

- `RewardBoxOpening` **nunca é apagado** (não entra no `cleanup`). A idempotência da abertura é do domínio, independente do TTL de 48h do `IdempotencyRecord` HTTP.
- Dentro da transação, depois de travar a fazenda, a primeira consulta é `RewardBoxOpening` por `(farm_id, idempotency_key)`: se existir e o `request_hash` for o mesmo, devolve `results` persistido (sem sortear, sem consumir); se o hash for diferente, `IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD`.
- Caixas são empilháveis (sem identificador individual). A garantia é: cada `RewardBoxOpening` consome exatamente 1 unidade, na mesma transação em que é criado; uma key gera no máximo uma abertura (`UNIQUE`); logo uma key consome no máximo uma caixa.
- Não alterar retroativamente o resultado de uma caixa já aberta; a versão da loot table usada fica registrada.

## 18.4. Espaço no inventário [TÉCNICA]

Antes de sortear, a API verifica espaço para o **pior caso** da loot table (máximo de sorteios × maior quantidade, cada resultado como pilha nova), calculado **com a caixa já removida**. Sem espaço: `INVENTORY_FULL`; a caixa não é consumida e nada é sorteado.

A verificação vem antes do sorteio de propósito: se dependesse do resultado, o jogador poderia manipular o espaço livre para descartar sorteios ruins.

## 18.5. Compliance [COMPLIANCE]

No estado atual do produto, a Caixa do Fazendeiro só pode ser obtida por gameplay/recompensas previstas.

Não implementar venda de recompensa aleatória, loot box paga, chave paga, giro pago ou mecanismo equivalente envolvendo dinheiro real ou moeda virtual relacionada a pagamento sem revisão jurídica específica e decisão explícita de produto.

(Barreira arquitetural; não é parecer jurídico. Contexto em 32.9.)

## 18.6. RewardGrant — recompensa automática idempotente [TÉCNICA]

Toda recompensa automática (meta, evento e futuras: missões, admin) é um `RewardGrant`. A idempotência está no banco, não no nome do job.

```text
RewardGrant
  id
  farm_id
  source_type               COMMUNITY_GOAL | COMMUNITY_EVENT | MISSION | ADMIN
  source_id
  reward_key                ex.: 'goal_box', 'event_box'
  item_definition_id
  quality_id
  quantity                  CHECK (quantity > 0)
  status                    PENDING | GRANTED | AWAITING_SPACE | NOT_ELIGIBLE
  eligibility_snapshot_at
  eligibility_reason        nullable (motivo quando NOT_ELIGIBLE)
  created_at
  granted_at

UNIQUE(farm_id, source_type, source_id, reward_key)
```

- `source_id` é polimórfico (meta, evento...); sem FK, validado pela aplicação; `source_type` é enum.
- Criado **uma vez** a partir do `RewardEligibilitySnapshot` imutável (18.8), com `PENDING` (elegível) ou `NOT_ELIGIBLE` (registro da decisão). O job de materialização não relê o passado.
- Substitui `PendingReward` e `CommunityGoalContribution.reward_status` (eram fontes paralelas do mesmo estado).

Transições:

| De | Para | Quando |
|---|---|---|
| `PENDING` | `GRANTED` | entregue ao inventário |
| `PENDING` | `AWAITING_SPACE` | inventário cheio na entrega (`[PENDENTE PD-11]`, provisório) |
| `AWAITING_SPACE` | `GRANTED` | jogador resgata com espaço |
| `NOT_ELIGIBLE` | — | terminal |
| `GRANTED` | — | terminal |

## 18.7. Entrega [TÉCNICA]

Job `rewards.process` (disparado pelo outbox `internal.rewards.process`) e `rewards.sweep` (cron a cada 5 minutos, pega `PENDING` com mais de 2 minutos). Cada `RewardGrant` é entregue numa **transação própria**:

1. lock da `Farm` do grant (R5) — o grant é linha filha da fazenda;
2. reler o grant; se não estiver `PENDING` → nada a fazer;
3. se couber (`canFit`): adicionar itens + `ItemLedger` (`REWARD`, referência = grant) + `status = 'GRANTED'`, `granted_at = now`; senão `status = 'AWAITING_SPACE'`;
4. outbox `realtime` para o dono; commit.

- O worker **não recalcula elegibilidade**. A entrega é escrita do sistema, não ação do jogador: não passa pela política de acesso (6.5). Ex.: fazenda `REMOVED` depois do snapshot recebe o item no inventário preservado.
- Processar o mesmo grant duas vezes gera uma única concessão (status + lock).

Resgate (`AWAITING_SPACE`): ação do jogador, passa pela política de acesso; trava a fazenda; verifica espaço; entrega; `GRANTED`.

`[PENDENTE PD-11]` recompensa com inventário cheio. **Provisório:** `AWAITING_SPACE` + resgate pelo site; nada é perdido.

## 18.8. Snapshot de elegibilidade [PENDENTE PD-25 + TÉCNICA · v1.3.4]

A especificação aprovada não define **em que momento** a elegibilidade para a recompensa de meta/evento é congelada, nem se remoção, venda de fazenda ou suspensão entre conclusão e entrega faz o jogador perder a recompensa.

`[PENDENTE PD-25]` continua aberto. A v1.3.4 muda apenas a forma técnica de congelar o provisório: o estado é materializado no próprio fato, não reconstruído mais tarde por timestamps.

```text
RewardEligibilitySnapshot
  id                    bigserial
  source_type           COMMUNITY_GOAL | COMMUNITY_EVENT
  source_id
  farm_id
  snapshot_at           = linearized_at da conclusão
  participation_kind    CONTRIBUTOR | PARTICIPANT
  participation_value   quantidade contribuída ou 1
  membership_status     ACTIVE | REMOVED | LEFT observado no snapshot
  farm_status           ACTIVE | SOLD observado no snapshot
  streamer_status       status observado; diagnóstico
  policy_version        ex.: PD25_PROVISIONAL_V1
  eligible              boolean conforme política provisória
  reason                nullable
  created_at

UNIQUE(source_type, source_id, farm_id)
```

### 18.8.1. Materialização linearizável

Na mesma transação que muda uma meta/evento para concluído, depois dos locks necessários ao fato e com `snapshot_at = linearized_at`, executar um `INSERT ... SELECT` que materializa os candidatos e os estados visíveis naquele statement.

- mudança concorrente já commitada antes do statement é observada;
- mudança ainda não commitada pode ser ordenada logicamente depois da conclusão;
- entrega atrasada não recalcula o passado;
- timestamps deixam de ser usados para adivinhar ordem de commit;
- snapshots são append-only.

`CommunityMembershipHistory` continua útil para auditoria e outras consultas históricas, mas não é a fonte primária de decisão de um snapshot já materializado.

### 18.8.2. Provisório de PD-25

Enquanto PD-25 não for decidido:

```text
snapshot = instante da conclusão (completed_at = linearized_at)
elegível = participou/contribuiu
           AND membership ACTIVE no snapshot
           AND Farm não SOLD no snapshot
mudanças posteriores não revogam a recompensa
policy_version = PD25_PROVISIONAL_V1
```

O job posterior cria `RewardGrant` exclusivamente a partir desses snapshots. Se PD-25 mudar no futuro, muda a política de materialização para fatos novos; snapshots antigos mantêm sua `policy_version`.

---
# 19. MARKETPLACE P2P

## 19.1. Tamanho do anúncio [FECHADA · v1.2]

O anúncio inicial do FarmQuest é uma **pilha completa de 100 unidades**.

```text
quantity = 100
```

Não permitir anúncios de 1 a 99 unidades na regra inicial.

A API não aceita `quantity` livre: define 100 a partir da regra. O lote é a constante 100 de `packages/contracts`; **não** é derivado de `stack_limit` (que é valor de balanceamento, PD-23).

## 19.2. Regras de conteúdo e taxa [FECHADA · v1.0]

- mesmo item;
- mesma qualidade;
- taxa 0%.

Item `ROTTEN` não pode ser anunciado `[FECHADA · v1.2]`. Item precisa ser `p2p_tradeable` `[TÉCNICA]`.

## 19.3. Um anúncio ativo por jogador [FECHADA · v1.2]

O limite é por **jogador/usuário**, não por fazenda. Mesmo que o jogador possua várias fazendas, só pode existir um anúncio ativo simultâneo.

Proteção obrigatória no banco:

```text
MarketplaceSellerState
  user_id           UNIQUE
  next_listing_at   nullable (NULL = nunca anunciou)
  updated_at
```

`[TÉCNICA]`: a linha é criada **na mesma transação em que o `User` é criado** (5.5, 37.1), então todo usuário já possui o mutex antes do primeiro anúncio e não há corrida de criação. Usuários antigos recebem a linha por backfill idempotente. Como defesa extra, criar anúncio faz `INSERT ... ON CONFLICT DO NOTHING` antes do lock — nunca `SELECT` seguido de `CREATE`.

```sql
CREATE UNIQUE INDEX marketplace_listing_one_active_uq
ON marketplace_listing (seller_user_id)
WHERE status = 'ACTIVE';
```

## 19.4. Cooldown global [FECHADA · v1.2]

O cooldown de anúncio/relistagem é global por jogador. Ele não pode ser burlado alternando entre duas fazendas do mesmo usuário.

## 19.5. Duração do cooldown e da retirada [FECHADA · v1.0 + PENDENTE]

- Base **12h**; com cavalo **10h**; vale para o cooldown do anúncio e para a retirada `[FECHADA · v1.0]`.
- `withdraw_available_at = listed_at + duração` (congelado no anúncio) `[TÉCNICA]`.
- `[PENDENTE PD-17]` o cooldown global começa na criação do anúncio, na venda ou na retirada? **Provisório:** na criação (`next_listing_at = listed_at + duração`).
- `[PENDENTE PD-18]` o cavalo é da fazenda, mas o cooldown é global por usuário: qual cavalo vale? **Provisório:** o da fazenda de origem do anúncio.

## 19.6. Sem expiração automática [FECHADA · v1.2]

Anúncio não expira por tempo. Permanece até:

- ser comprado; ou
- ser retirado pelo vendedor quando a retirada estiver liberada pela regra de cooldown.

Não criar `expires_at` funcional para expirar anúncios automaticamente no MVP.

## 19.7. Preço acima da média [FECHADA · v1.2]

Preço acima da média não deve ser bloqueado por um hard cap arbitrário de 300%.

Quando aplicável, exibir aviso:

*Produto com valor acima da média*

Esse aviso é informativo. Não existe faixa rígida de preço.

Validações mínimas de preço: inteiro; positivo; dentro do limite técnico de armazenamento; sem overflow.

`[PENDENTE PD-16]` o que é "a média". **Provisório:** preço do dia do mercado global (10.2) × multiplicador da qualidade, vezes 100 unidades.

## 19.8. Compra [FECHADA · v1.0 + FECHADA · v1.2 + TÉCNICA]

- Comprador diferente do vendedor: `buyer.user_id != seller.user_id`, **mesmo que sejam fazendas diferentes** `[FECHADA · v1.0]`.
- Compra atômica, numa única transação lógica `[FECHADA · v1.2]`. Nunca marcar listing como vendido antes de confirmar todos os efeitos econômicos.
- O comprador compra o lote inteiro (100) e escolhe qual fazenda dele paga e recebe (`buyer_farm_id`) `[TÉCNICA]`.
- A fazenda compradora precisa ter espaço para as 100 unidades; senão `INVENTORY_FULL` antes de qualquer efeito `[TÉCNICA]`.
- Preço: o cliente envia só o preço unitário ao anunciar; o total (`unit_price * 100`) é calculado no servidor `[TÉCNICA]`.
- A fazenda compradora passa pela política de acesso (6.5). A fazenda vendedora não passa: a oferta já foi feita `[TÉCNICA]`.

`[PENDENTE PD-27]` anúncio ativo de fazenda que deixou de ser jogável (membership `REMOVED`, streamer suspenso). **Provisório:** o anúncio segue comprável; a retirada exige fazenda jogável e fica bloqueada até lá.

`[PENDENTE PD-15]` escopo do Marketplace: global (qualquer streamer) ou só dentro da comunidade. **Provisório:** listagem global com filtro opcional por comunidade.

## 19.9. Entidade [TÉCNICA]

```text
MarketplaceListing
  id
  seller_user_id
  seller_farm_id
  item_definition_id
  quality_id
  quantity                CHECK (quantity = 100)
  unit_price              bigint, CHECK (unit_price > 0 AND unit_price <= 10000000000000)
                          (limite técnico: total ≤ 10^15, seguro em BigInt e em JSON)  status                  ACTIVE | SOLD | WITHDRAWN
  listed_at
  withdraw_available_at
  sold_at
  buyer_user_id
  buyer_farm_id
  withdrawn_at

INDEX (status, item_definition_id, quality_id, unit_price)
```

Os 100 itens ficam **reservados** no inventário do vendedor (`reserved_quantity += 100`) `[FECHADA · v1.0]`; na venda saem do vendedor; na retirada voltam a ficar disponíveis (sem precisar de espaço novo). Ledger de cada passo: 21.3.

Fluxos: 37.5 (criar), 37.6 (comprar), 37.7 (retirar).

## 19.10. Concorrência obrigatória [FECHADA · v1.2]

Teste com múltiplos compradores simultâneos no mesmo anúncio:

- somente um compra;
- vendedor recebe exatamente uma vez;
- comprador vencedor paga exatamente uma vez;
- itens são entregues exatamente uma vez;
- demais requisições recebem estado coerente (`MARKETPLACE_LISTING_ALREADY_SOLD`).

---

# 20. RANKINGS

## 20.1. Dimensões e escopos [FECHADA · v1.2]

Dimensões: Nível; Nível de Colecionador; Nível de Contribuição; Dinheiro.

Escopos: Global; Comunidade; Semanal.

Enum da dimensão: `LEVEL | COLLECTOR_LEVEL | CONTRIBUTION_LEVEL | COINS`.

## 20.2. Dinheiro [FECHADA · v1.2]

Ranking de dinheiro utiliza saldo atual materializado; o ledger continua sendo a fonte auditável de movimentações. Não somar o ledger em toda request de ranking.

## 20.3. Pendências [PENDENTE]

- `[PENDENTE PD-20]` o ranking é por fazenda ou por usuário (um jogador tem até 5 fazendas)? **Provisório:** por fazenda.
- `[PENDENTE PD-21]` quando a semana vira. Gravar `week_start_at`/`week_end_at` em UTC não define a virada. **Provisório:** segunda-feira 00:00 America/Sao_Paulo, gravado como instante UTC.

## 20.4. Read models [TÉCNICA]

- `FarmStats` e `FarmStatsWeekly` (XP ganho, moedas ganhas, unidades colhidas, progressões), atualizados na transação da ação (linha da própria fazenda, já travada).
- Consultas de ranking com índice e cache em memória de 60s.
- Fontes por dimensão: `LEVEL` → `Farm.level`/`Farm.xp`; `COLLECTOR_LEVEL` → `FarmCollectorProgress`; `CONTRIBUTION_LEVEL` → `FarmContributionProgress`; `COINS` → `Farm.coins`.
- Ranking **não** é recalculado dentro da colheita.
- `ranking.updated` é emitido periodicamente pelo worker.

---

# 21. ECONOMIA E LEDGERS

## 21.1. Estratégia de saldo [TÉCNICA]

Todo saldo nasce no ledger. Não existe saldo de abertura fora dele: moedas e itens iniciais entram como `INITIAL_GRANT` na transação de criação da fazenda. Como o projeto começa sem dados, não há backfill de ledger.

Consequência: a soma do ledger de qualquer chave é igual ao saldo materializado atual.

## 21.2. CoinLedger [TÉCNICA OBRIGATÓRIA]

Toda alteração monetária cria registro append-only.

```text
CoinLedger
  id                bigserial
  farm_id
  user_id
  delta             bigint (+/-), CHECK (delta <> 0)
  balance_after     CHECK (balance_after >= 0)
  reason
  reference_type
  reference_id
  idempotency_key   nullable
  created_at
```

`Farm.coins` é saldo materializado para performance.

Reasons: `INITIAL_GRANT`, `SHOP_BUY`, `NPC_SELL`, `P2P_BUY`, `P2P_SELL`, `ANIMAL_BUY`, `ANIMAL_SELL`, `UPGRADE_BUY`, `INVENTORY_EXPAND`, `REWARD`, `FARM_SALE`, `ADMIN_ADJUST`.

## 21.3. ItemLedger — estoque e reserva separados [TÉCNICA OBRIGATÓRIA]

O inventário tem duas grandezas: `quantity` (estoque físico) e `reserved_quantity` (parte do estoque presa num anúncio). Reservar **não** reduz `quantity`. Por isso o ledger registra as duas:

```text
ItemLedger
  id                  bigserial
  farm_id
  item_definition_id
  quality_id
  quantity_delta      bigint
  reserved_delta      bigint
  quantity_after      CHECK (quantity_after >= 0)
  reserved_after      CHECK (reserved_after >= 0 AND reserved_after <= quantity_after)
  reason
  reference_type
  reference_id
  idempotency_key     nullable
  created_at

CHECK (quantity_delta <> 0 OR reserved_delta <> 0)
INDEX (farm_id, item_definition_id, quality_id, id)
```

A chave do ledger é `(farm_id, item_definition_id, quality_id)` — a mesma chave única do `InventoryItem`. Não há FK para `InventoryItem.id`, porque linhas com `quantity = 0` são apagadas e o histórico precisa sobreviver.

Deltas por reason:

| Reason | `quantity_delta` | `reserved_delta` |
|---|---|---|
| `INITIAL_GRANT` | + | 0 |
| `PLANT` (sementes) | − | 0 |
| `HARVEST` | + (quantidade colhida integral) | 0 |
| `GOAL_CONTRIBUTION` | − `accepted` | 0 |
| `SHOP_BUY` | + | 0 |
| `NPC_SELL` | − | 0 |
| `DISCARD` | − | 0 |
| `P2P_RESERVE` (criar anúncio) | 0 | +100 |
| `P2P_RELEASE` (retirar anúncio) | 0 | −100 |
| `P2P_SELL` (vendedor, na venda) | −100 | −100 |
| `P2P_BUY` (comprador) | +100 | 0 |
| `BOX_OPEN` (caixa consumida) | −1 | 0 |
| `BOX_LOOT` (conteúdo) | + | 0 |
| `REWARD` (RewardGrant) | + | 0 |
| `ANIMAL_FEED` | − | 0 |
| `ANIMAL_COLLECT` | + | 0 |
| `ADMIN_ADJUST` | ± | 0 (ajuste administrativo não mexe em reserva) |

Exemplo — anúncio de 100 a partir de 200 unidades:

```text
antes                        quantity 200, reserved 0
P2P_RESERVE  (0, +100)       quantity 200, reserved 100
P2P_SELL     (-100, -100)    quantity 100, reserved 0      (vendedor)
P2P_BUY      (+100, 0)       comprador +100
```

Nenhuma operação pode levar a `reserved_quantity < 0` ou `reserved_quantity > quantity`: garantido pelo `CHECK` do `InventoryItem` (9.2) e pelo `CHECK` de `*_after` no ledger.

## 21.4. ProgressLedger — XP e progressões [TÉCNICA OBRIGATÓRIA]

A Definition of Done exige ledger para toda alteração de XP. XP, XP de colecionador e XP de contribuição têm ledger próprio:

```text
ProgressLedger
  id              bigserial
  farm_id
  track           LEVEL_XP | COLLECTOR_XP | CONTRIBUTION_XP
  delta           bigint, CHECK (delta <> 0)
  value_after     CHECK (value_after >= 0)
  reason          PLANT | HARVEST | NPC_SELL | EVENT_PARTICIPATION | GOAL_CONTRIBUTION
                  | COLLECTIBLE | MISSION | ADMIN_ADJUST
  reference_type
  reference_id
  created_at
```

## 21.5. Regras [TÉCNICA]

- Ledger gravado **na mesma transação** da mudança, com a fazenda travada (os `*_after` saem em sequência).
- Ledger é append-only: nunca `UPDATE`, nunca `DELETE`.
- Débito sempre condicional:

```sql
UPDATE farm SET coins = coins - $x WHERE id = $id AND coins >= $x;  -- 0 linhas = saldo insuficiente
```

- Moedas inteiras (`bigint`). Percentuais em basis points (`10000 bps = 100%`). Nunca float.
- Cálculos de valor em BigInt, com **um único floor no final**. O jogador nunca recebe fração.
  (Motivo do BigInt: `100 * 1.000.000 * 10.000 * 10.000 = 10^16` passa do maior inteiro seguro do JavaScript.)
- Ação administrativa econômica: motivo obrigatório + `ADMIN_ADJUST` + `AuditLog` (4.4).

## 21.6. Reconciliação [TÉCNICA]

Jobs diários `reconcile.coins`, `reconcile.inventory` e `reconcile.progress`:

```text
SUM(CoinLedger.delta)          por farm                     = Farm.coins
SUM(ItemLedger.quantity_delta) por (farm, item, quality)    = InventoryItem.quantity           (0 se a linha não existir)
SUM(ItemLedger.reserved_delta) por (farm, item, quality)    = InventoryItem.reserved_quantity  (0 se a linha não existir)
último quantity_after / reserved_after                      = valores atuais da linha
SUM(ProgressLedger.delta)      por (farm, track)            = Farm.xp / collector_xp / contribution_xp
SUM(reserved_quantity) do vendedor para (item, quality)     = 100 × anúncios ACTIVE daquela fazenda/item/qualidade
```

- identificam divergência e registram alerta;
- não "corrigem silenciosamente" sem trilha de auditoria.

---

# 22. TRANSAÇÕES, LOCKS E ORDEM GLOBAL

## 22.1. Regra [TÉCNICA]

Transações econômicas devem ser curtas. Não executar dentro de transação: chamadas Twitch; Socket.IO remoto; HTTP externo; `boss.send()`; espera artificial; renderização pesada.

## 22.2. Tipo de lock e linhas filhas [TÉCNICA]

- Mutex de linha = `SELECT ... FOR NO KEY UPDATE` (via `$queryRaw`), **não** `FOR UPDATE`.
  Motivo: inserir uma linha com FK para a fazenda (ex.: `RewardGrant`, `CommunityGoalContribution`) pega `FOR KEY SHARE` na fazenda referenciada. `FOR UPDATE` bloqueia `FOR KEY SHARE`; `FOR NO KEY UPDATE` não. Com `FOR UPDATE`, o job de conclusão da meta (que segura a meta e insere grants apontando para fazendas) e uma colheita (que segura a fazenda e espera a meta) formariam deadlock.
- Colunas referenciadas por FK (`id` e chaves únicas usadas em FK composta) nunca são atualizadas.
- A linha da `Farm` protege todas as suas linhas filhas: `Plot`, `PlantedCrop`, `InventoryItem`, `FarmAnimal`, `TractorUsage`, `FarmUpgrade`, `FarmCollection`, `FarmCollectorProgress`, `FarmContributionProgress`, `FarmUnlockedTitle`, `FarmStats`, `FarmStatsWeekly`, `CommunityMembership` (+ histórico), `CommunityGoalContribution` e `RewardGrant` da fazenda. Linhas filhas não recebem lock próprio.
- Mesmo com o lock, saldo e estoque são alterados com `UPDATE` condicional (segunda linha de defesa).
- Exceção documentada: `goal.complete` e `event.complete` **inserem** `RewardGrant` de várias fazendas sem travá-las. É seguro porque a linha é nova (ninguém a lê antes do commit), protegida pelo `UNIQUE` (23.3), e toda leitura/alteração posterior do grant (entrega, resgate) trava a fazenda. As contribuições e participações lidas por esses jobs já estão imutáveis (a meta saiu de `COLLECTING`; o evento tem `outcome` definido — novas participações exigem `outcome IS NULL`).

## 22.3. Ordem global de locks [TÉCNICA]

Toda transação adquire locks **somente em ordem crescente de nível**. No mesmo nível, só `Farm` admite várias linhas, sempre em ordem crescente de `id`.

| Nível | Recurso |
|---|---|
| R0 | inserção da chave de idempotência (`IdempotencyRecord`) ou do dedupe Twitch (`TwitchMessageDedupe`) — espera de índice único |
| R1 | `MarketplaceListing` |
| R2 | `User` |
| R3 | `MarketplaceSellerState` |
| R4 | `Streamer` |
| R5 | `Farm` (ordem crescente de id) + linhas filhas |
| R6 | `CommunityEvent` |
| R7 | `CommunityGoal` |

`Community` nunca é travada (não tem estado mutável — 15.1).

Por que não há deadlock: se toda transação só pede um lock de nível maior do que os que já possui, não existe ciclo de espera entre essas linhas (argumento clássico de ordenação de recursos). Inserções com FK durante R6/R7 pegam `FOR KEY SHARE` em fazendas, que é compatível com `FOR NO KEY UPDATE` (22.2), então não criam espera "para trás".

Auditoria por fluxo:

| Fluxo | Sequência | Observação |
|---|---|---|
| Criar usuário (callback OAuth) | sem lock prévio → inserts `User`, `TwitchIdentity`, `MarketplaceSellerState` com `ON CONFLICT` | callback duplicado: conflito no `UNIQUE(twitch_user_id)` → reler o existente |
| Criar fazenda | R0 → R2 `User` → insert `Farm` e filhas | limite de 5 |
| Plantar / descartar / loja / venda rápida / trator / upgrade | R0 → R5 | |
| Colher | R0 → R5 → R7 (só se a meta for aplicável) | 16.5 |
| Animal (comprar, alimentar, coletar, vender) | R0 → R5 | |
| Abrir caixa | R0 → R5 | 18.3 |
| Criar anúncio | R0 → R3 → R5 | 37.5 |
| Comprar anúncio | R0 → R1 → (R3 do vendedor, só se PD-17 mudar para "na venda") → R5 comprador e vendedor por id | 37.6 |
| Retirar anúncio | R0 → R1 → R3 → R5 | 37.7 |
| Participar de evento | R0 ou dedupe → R5 → R6 | 37.9 |
| Remover / readmitir membro | R0 → R5 | membership é filha da fazenda |
| Enviar mercadoria | R0 → R7 | |
| `goal.complete`, `goals.sweep`, `goal.advance` | R7 (uma meta por transação) | inserts com FK em fazendas: `KEY SHARE` compatível |
| `event.complete`, `events.sweep`, `events.tick` | R6 (um evento por transação) | idem |
| Entrega / resgate de `RewardGrant` | R5 (uma fazenda por transação) | 18.7 |
| Aprovar, suspender streamer; abrir/fechar canal | R4 | cria `Community` na aprovação |
| Ajuste econômico administrativo | R0 → R5 | motivo + audit |
| Reconciliação, ranking | sem lock (leitura) | |

Fluxos que leem sem travar recursos de nível menor que o seu (ex.: a política de acesso lê `Streamer.approval_status` e `User.status` depois de travar a fazenda): a leitura é linearizada pelo commit — uma ação que leu "APPROVED" é tratada como anterior à suspensão.

Exceções: nenhuma. Caso de uso novo que precise de outra ordem deve ser revisto antes de implementado; teste de deadlock obrigatório (36.3).

## 22.4. Molde de toda ação econômica [TÉCNICA]

O molde abaixo é o de uma ação que altera uma fazenda. Ações sobre outras entidades seguem o mesmo molde trocando o lock da `Farm` pelo lock da entidade própria, no nível da seção 22.3 (ex.: enviar mercadoria trava só a `CommunityGoal`; `$abrirfazenda` trava só o `Streamer`), e não passam pela política de acesso da fazenda.

```ts
async function acao(ctx, input) {
  return runInTransaction(async (tx) => {
    const replay = await idempotency.begin(tx, ctx.actorUserId, scope, key, hash(input)); // R0
    if (replay) return replay;                             // mesma resposta + linearizedAt original

    await locks.farm(tx, farmId);                          // R5: SELECT ... FOR NO KEY UPDATE
    await access.assertFarmPlayable(tx, farmId);           // política de acesso (6.5)

    const linearizedAt = await clock.databaseNow(tx);      // SELECT clock_timestamp(), após locks

    // validações e cálculos: funções puras de game-rules, recebendo linearizedAt
    // erro de regra: throw new DomainError('CODIGO', details)

    // escritas condicionais + ledgers + stats + outbox.add(tx, ...)
    // consequência obrigatória assíncrona => OutboxMessage internal.* (24.4), nunca boss.send()

    const result = { code: 'HARVEST_OK', linearizedAt, /* ... */ };
    await idempotency.finish(tx, scope, key, result);
    return result;
  }, { timeoutMs: 10_000 });
}
```

Service que recebe `tx` nunca abre transação própria.

O limite de 10s vale também no banco, não só no cliente: o usuário da aplicação tem `transaction_timeout = 10s` (PostgreSQL 17) e `idle_in_transaction_session_timeout = 10s`. Jobs de leitura longa (reconciliação) usam `SET LOCAL transaction_timeout` maior e não escrevem estado de domínio. O snapshot de elegibilidade não depende desse timeout para ordenar fatos: ele é materializado no statement da conclusão (18.8).

## 22.5. Retry [TÉCNICA]

Retry somente para falhas transitórias conhecidas: deadlock (`40P01`); serialization conflict (`40001`) quando utilizado; erro transiente compatível.

Não fazer retry automático de erro de regra de negócio.

Retry deve possuir: limite baixo (até 3); jitter/backoff curto; métricas; mesma idempotency key.

---

# 23. IDEMPOTÊNCIA

Há duas camadas. A **camada de requisição** (HTTP e Twitch) evita reprocessar a mesma chamada. A **camada de domínio** (constraints e status) garante que uma consequência econômica não aconteça duas vezes, mesmo que a camada de requisição falhe ou expire. Jobs dependem só da camada de domínio.

## 23.1. HTTP econômico [TÉCNICA]

Endpoints que alteram economia exigem header `Idempotency-Key` (UUID gerado pelo cliente por intenção de ação): plantar, colher, descartar, comprar na loja, venda rápida, abrir caixa, comprar/vender/alimentar/coletar animal, comprar upgrade, usar trator, criar/comprar/retirar anúncio, participar de evento, resgatar recompensa, criar fazenda, ajuste administrativo.

```text
IdempotencyRecord
  actor_user_id
  scope
  key
  request_hash
  response_status
  response_body     jsonb
  created_at
  expires_at

UNIQUE(actor_user_id, scope, key)
```

- Inserido no início da transação (`INSERT ... ON CONFLICT DO NOTHING`, nível R0) e completado no fim, **na mesma transação**: rollback apaga a chave.
- Requisição concorrente com a mesma chave espera o `UNIQUE` e, após o commit da primeira, lê a resposta gravada.
- Key reutilizada com payload diferente falha: `IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD`.
- Retenção: 48h (job `cleanup`). Depois disso a mesma key é tratada como ação nova, **exceto** onde a idempotência de domínio é permanente (23.3). Clientes não reutilizam keys além de uma sessão de retry.

## 23.2. Twitch [TÉCNICA]

O `message_id` recebido da Twitch é deduplicado de forma persistente (não apenas cache em memória).

```text
TwitchMessageDedupe
  provider              'twitch'
  external_message_id
  broadcaster_user_id
  chatter_user_id
  command
  response_body         jsonb
  created_at

UNIQUE(provider, external_message_id)
```

- Inserido **na mesma transação** do efeito do comando. Se fosse gravado antes, numa transação separada, uma queda entre as duas perderia o comando: a reentrega seria descartada como duplicada sem que nada tivesse acontecido.
- Comando que termina em erro de regra faz rollback; a reentrega é reprocessada e gera o mesmo erro (sem efeito econômico).
- Retenção: 7 dias (job `cleanup`).

## 23.3. Idempotência de domínio (permanente) [TÉCNICA]

| Consequência | Garantia no banco |
|---|---|
| Recompensa automática | `RewardGrant UNIQUE(farm_id, source_type, source_id, reward_key)` + status |
| Abertura de caixa | `RewardBoxOpening UNIQUE(farm_id, idempotency_key)`, nunca apagado |
| Boost de uma origem | `CommunityActiveBoost UNIQUE(community_id, source, source_ref, boost_definition_id)` |
| Benefício permanente | `CommunityUnlockedBenefit UNIQUE(community_id, benefit_definition_id)` |
| Transições de meta/evento | `UPDATE ... WHERE status = <origem>` com a linha travada |
| Conclusão de evento | `rewards_materialized_at` + `UNIQUE` dos grants |
| Participação em evento | `UNIQUE(event_id, farm_id)` |
| Preço do dia | `MarketPrice UNIQUE(item_definition_id, price_date)` |
| Meta aberta / evento ativo / anúncio ativo | índices únicos parciais (seção 30) |

## 23.4. Jobs [TÉCNICA]

Jobs têm chave própria (ex.: `goal.complete:{goal_id}`, `rewards.process:{source_type}:{source_id}`, `market.daily-prices:{price_date}`), usada como `singletonKey` do pg-boss **apenas como otimização** para evitar trabalho repetido. A correção nunca depende dela: rodar qualquer job duas vezes, em paralelo ou depois de um reinício, não duplica efeito por causa da seção 23.3.

---

# 24. OUTBOX TRANSACIONAL E TEMPO REAL

## 24.1. Regras [TÉCNICA OBRIGATÓRIA]

1. Nenhuma mensagem externa anuncia efeito econômico antes do commit correspondente. Na mesma transação que altera o domínio, criar `OutboxMessage`.
2. **É proibido depender de uma chamada a `boss.send()` realizada somente após o commit para garantir consequência obrigatória de uma transação de domínio.** Se o processo cair entre o commit e o `boss.send()`, a consequência se perde.
3. Toda consequência obrigatória (conclusão de meta, conclusão de evento, recompensas, avanço de ciclo, tarefas internas que não podem se perder) nasce como `OutboxMessage` de tópico `internal.*` **dentro** da transação que a causa.
4. Além do outbox, cada consequência obrigatória é recuperável a partir do **estado de domínio** (meta em `COMPLETED`, evento `SUCCEEDED` sem `rewards_materialized_at`, `RewardGrant` em `PENDING`, meta vencida em `COLLECTING`). Os sweeps (25.1) encontram esses estados e reenfileiram. Assim nem uma falha definitiva de job perde a consequência.

Exceção aceita: enviar job ao pg-boss **dentro da mesma transação PostgreSQL** do domínio (pg-boss com adaptador de banco usando a conexão da transação). Só pode ser usado se isso estiver comprovado por teste de integração e isolado num único módulo. O padrão do FarmQuest continua sendo o outbox.

## 24.2. Modelo [TÉCNICA]

```text
OutboxMessage
  id                bigserial
  topic             realtime.* | chat.* | internal.*
  aggregate_type
  aggregate_id
  schema_version     inteiro >= 1
  payload_json
  status            PENDING | IN_FLIGHT | DISPATCHED | EXPIRED
  attempts
  available_at
  lease_until       nullable
  dispatched_at     nullable
  last_error        nullable
  created_at
```

- `EXPIRED` só existe para `realtime.*` e `chat.*` (best effort: chat com mais de 60s, realtime com mais de 5 min).
- `internal.*` **nunca expira**: tenta de novo com espera crescente (limitada) e gera alerta depois de N tentativas.

## 24.3. Quem entrega cada tópico [TÉCNICA]

| Tópico | Processo | Destino |
|---|---|---|
| `realtime.*` | **api** | salas Socket.IO dos navegadores |
| `chat.*` | **api** | bot Twitch (POST interno, em lote) |
| `internal.*` | **worker** | pg-boss (24.4) |

O worker não emite Socket.IO: as conexões dos navegadores ficam no processo da API e, sem Redis, o worker não as alcança.

Mecânica comum:

1. A transação de negócio insere a mensagem e pode executar `NOTIFY outbox`. O `NOTIFY` é somente wake-up/otimização; perder uma notificação nunca pode perder trabalho.
2. Cada processo escuta `LISTEN outbox` numa **conexão dedicada do driver `pg`** (não do Prisma) e também varre a tabela a cada 2s; o polling da tabela é a fonte de recuperação.
3. Reivindica, com `FOR UPDATE SKIP LOCKED`, mensagens `PENDING` com `available_at <= now` **ou** `IN_FLIGHT` com `lease_until < now`; marca `IN_FLIGHT` com novo `lease_until` e faz commit (transação curta, separada).
4. Entrega fora de transação; marca `DISPATCHED` somente após confirmação de persistência/entrega conforme o tópico.
5. Falha: `attempts++`, `available_at` com espera crescente; lease vencido é reclamável sem operação manual.
6. Limpeza: mensagens `DISPATCHED`/`EXPIRED` há mais de 7 dias podem ser apagadas (`cleanup`). `internal.*` nunca expira antes do despacho confirmado.

Entrega é `at-least-once`: consumidores deduplicam pelo `id` da mensagem ou pela idempotência de domínio (23.3).

Nota de escala: o `NOTIFY` serializa brevemente os commits que o usam. Na carga prevista é irrelevante; se aparecer contenção, trocar por varredura mais frequente sem `NOTIFY`.

## 24.4. Ponte outbox → pg-boss [TÉCNICA]

| Tópico `internal.*` | Job pg-boss | Seção |
|---|---|---|
| `internal.goal.completed` | `goal.complete` | 16.6 |
| `internal.goal.advance` | `goal.advance` | 16.8 |
| `internal.event.completed` | `event.complete` | 17.3 |
| `internal.rewards.process` | `rewards.process` | 18.7 |

O dispatcher do worker faz apenas: ler a mensagem → criar o job com identidade determinística derivada de `OutboxMessage.id` → confirmar que o job ficou persistido no pg-boss → marcar `DISPATCHED`. Se cair depois da criação do job e antes de marcar, a mensagem é reenviada, mas produz o mesmo job lógico; o handler continua idempotente no domínio (23.3/23.4). Não confiar apenas no nome humano do job. Retentativas, espera e falha do job ficam no pg-boss; a recuperação final fica nos sweeps (24.1, regra 4).

`schema_version` é obrigatório no outbox. Consumidor aceita somente versões conhecidas; payload desconhecido vira erro observável e nunca é interpretado silenciosamente.

## 24.5. Salas e eventos realtime [FECHADA · v1.0 + TÉCNICA]

Salas `[TÉCNICA]`: `user:{userId}`, `farm:{farmId}` (só o dono), `community:{communityId}`, `global`. O handshake autentica pelo cookie de sessão e autoriza cada sala. **Nenhuma mutação trafega pelo Socket.IO**: toda ação é REST (com CSRF e idempotência).

Eventos `[FECHADA · v1.0]` (todo payload leva `version` e `serverTime`):

```text
farm.updated
inventory.updated
crop.harvested
xp.updated
level.up
market.updated
community.goal.updated        (no máximo 1 a cada 2s por comunidade)
community.goal.completed
event.started
event.ended
ranking.updated
notification.created
```

Adicionados `[TÉCNICA]`: `marketplace.updated`, `event.participation.updated`, `reward.granted`, `boost.started`, `boost.ended`.

Removido: `crop.ready` `[TÉCNICA]`. Emiti-lo exigiria um timer por plantação, o que a regra de estado derivado proíbe. O cliente recebe `grows_at`, `rots_at` e `serverTime` no GET e faz a contagem localmente.

Eventos são avisos: ao reconectar, o cliente refaz o GET.

---

# 25. JOBS COM PG-BOSS

## 25.1. Uso [TÉCNICA]

pg-boss processa: consequências obrigatórias (via ponte do outbox — 24.4); varreduras de recuperação; tarefas programadas; manutenção; reconciliação; atualização de read models quando não precisar ser síncrona.

Todos os jobs rodam no **worker**, usam os módulos de `packages/domain`, seguem o molde da seção 22 e são idempotentes (23.3).

| Job | Gatilho | O que faz |
|---|---|---|
| `outbox.internal-dispatch` | contínuo (LISTEN + varredura) | ponte `internal.*` → pg-boss (24.4) |
| `goal.complete` | `internal.goal.completed` / sweep | 16.6 |
| `goal.advance` | `internal.goal.advance` / sweep | 16.8 |
| `goals.sweep` | cron 1 min | expira, fecha, avança, recupera, cria primeira meta (16.8) |
| `event.complete` | `internal.event.completed` / sweep | 17.3 |
| `events.sweep` | cron 1 min | encerra eventos vencidos; recupera conclusões (17.4) |
| `events.tick` | cron N min | encerra vencidos e sorteia novos (17.4) |
| `rewards.process` | `internal.rewards.process` | entrega `RewardGrant PENDING` (18.7) |
| `rewards.sweep` | cron 5 min | reenfileira `PENDING` com mais de 2 min |
| `boosts.announce` | cron 1 min | anuncia fim de boosts (`ended_announced_at IS NULL` e vencidos); só aviso |
| `market.daily-prices` | cron 00:00 America/Sao_Paulo | 10.2 |
| `streams.reconcile` | cron 5 min | status ao vivo pela Twitch API |
| `ranking.broadcast` | cron N min | `ranking.updated` |
| `reconcile.coins` / `reconcile.inventory` / `reconcile.progress` | cron diário | 21.6 |
| `cleanup` | cron diário | idempotência HTTP > 48h, dedupe Twitch > 7d, outbox > 7d, sessões expiradas, IPs antigos (nunca `RewardBoxOpening`, ledgers, `RewardGrant`) |

**Nenhum job é agendado para um horário futuro (`startAfter`) como único meio de causar uma consequência.** Fim de evento, fim de boost e avanço de meta são encontrados pelos sweeps a partir dos timestamps. Se o processo cair depois de criar um evento, o sweep o encerra mesmo assim; nada fica "ativo para sempre" bloqueando os índices únicos.

## 25.2. Não duplicar filas [TÉCNICA]

Não criar simultaneamente fila customizada em tabela, pg-boss e Redis/BullMQ para o mesmo problema. O outbox (24) não é fila de jobs: é o registro durável do que precisa ser entregue; a execução de trabalho assíncrono é sempre do pg-boss.

Cron dentro do processo da API não é usado: com duas instâncias rodaria duas vezes, e agendamentos em memória somem num reinício.

---

# 26. TWITCH BOT

## 26.1. Responsabilidade [FECHADA · v1.2 + TÉCNICA]

O bot:

- recebe eventos/comandos;
- normaliza identidade e contexto;
- envia comando à API;
- recebe resultado;
- coloca resposta de chat em fila/rate limiter;
- agrega respostas quando necessário.

O bot não:

- calcula XP;
- calcula loot;
- movimenta moedas;
- acessa Prisma diretamente;
- modifica inventário;
- decide se evento foi concluído.

## 26.2. Comandos [FECHADA · v1.0 + FECHADA · v1.2]

| Comando | Quem | Regra |
|---|---|---|
| `$abrirfazenda` | streamer aprovado | ativa o jogo no canal (5.2) |
| `$plantar <cultura>` | jogador com conta e fazenda no canal | 7.5 |
| `$colher` | jogador com conta e fazenda no canal | 7.6 |
| comandos de evento (ex.: `$espantar`) | jogador | 17 |

Normalização `[TÉCNICA]`: minúsculas, sem acentos, espaços extras removidos; itens resolvidos por aliases.

Comando de jogador em canal com `chat_game_active = false` → `CHANNEL_GAME_NOT_ACTIVE` (alcance da ativação: `[PENDENTE PD-28]`, 5.2).

Jogador com conta mas sem fazenda naquele canal → `NO_FARM_IN_CHANNEL`; o bot orienta a criar a fazenda pelo site (o chat nunca cria fazenda — 5.1).

## 26.3. Integração com a Twitch [TÉCNICA · ERRATA v1.3.4]

Scopes, limites, tipos de token e transportes Twitch são dependência externa. Manter configuráveis/documentados e **revalidar a documentação oficial imediatamente antes da implementação real**. Não codificar números de rate limit em `game-rules`; token Twitch nunca vai ao browser.

Referência técnica incorporada da v1.3.3 (verificada em 28/09/2026; revalidar quando implementar):

### Transporte e token

```text
EventSub Webhook   -> criação da subscription usa App Access Token
EventSub WebSocket -> criação usa User Access Token; não tratar App Token como válido nesse fluxo direto
EventSub Conduit   -> gerenciamento/criação usa App Access Token
```

Para o FarmQuest, chatbot em nuvem:

- preferir **Webhook ou Conduit** com App Access Token para `channel.chat.message`;
- Conduit pode distribuir para shards; não confundir isso com uma subscription EventSub WebSocket direta;
- `stream.online` / `stream.offline` atualizam o estado da live;
- IRC não é a estratégia do projeto.

### Autorizações do cloud chatbot

Conta do bot concede ao app:

```text
user:read:chat
user:write:chat
user:bot
```

Broadcaster/streamer concede:

```text
channel:bot
```

O onboarding continua verificando/moderando `bot_is_moderator`, mas a estratégia explícita do FarmQuest é solicitar `channel:bot`.

### Envio de chat

A Twitch API `Send Chat Message` pode usar App Access Token quando as autorizações prévias exigidas existem. Mensagem continua limitada pelo limite externo vigente da Twitch; o valor é configuração, não regra de produto.

### Tokens

- App Access Token: Client Credentials; não possui refresh token; quando necessário, gerar outro;
- User Access Token de bot/streamer: Authorization Code Grant; refresh token armazenado criptografado quando necessário;
- tokens mantidos pela aplicação devem ter expiração/renovação/validação tratadas;
- jogador comum não tem token persistido depois do login.

## 26.4. Limites de envio e agregação [TÉCNICA]

Valores de referência da documentação em set/2026 (configuráveis, não regra de negócio): conta comum envia até 20 mensagens/30s se não for moderador do canal, ou 100/30s se for; e até 1 mensagem/s por canal se não for moderador; estourar faz a Twitch ignorar o bot por 1 hora. A verificação de bots (limites maiores) estava pausada.

Consequências:

- 500 comandos/min por streamer não podem receber uma resposta cada no chat;
- bot moderador em cada canal é item do onboarding (`Streamer.bot_is_moderator`);
- balde global com margem (ex.: 80% do limite) e limite por canal;
- respostas do mesmo canal agregadas por alguns segundos numa única mensagem (máx. 500 caracteres):
  `@ana colheu 12 milho Bom | @beto plantou 3 trigo | @caio aguarde 40s`;
- prioridade: eventos da comunidade > subida de nível e itens raros > respostas comuns;
- erros repetidos (ex.: cooldown) respondidos no máximo 1 vez por minuto por usuário.

Em canal movimentado, o bot agrega respostas para respeitar limites de chat. A resposta individual detalhada continua disponível no site.

## 26.5. Mensagens de chat são best effort [FECHADA · v1.2 + TÉCNICA]

Política explícita: mensagens de chat são efêmeras e **best effort**.

- economia nunca depende da entrega da mensagem;
- se o bot cair depois do commit, o estado do jogo continua correto;
- resposta perdida não pode causar rollback econômico;
- mensagem com mais de 60s sem entrega é descartada (resposta atrasada confunde o chat);
- a fila em memória do bot pode se perder num reinício.

## 26.6. Mensagens configuráveis [FECHADA · v1.0 + TÉCNICA]

```text
BotMessageTemplate
  key           = código de resultado/erro da API (31)
  text          ex.: "{player} encontrou: {item}!!"
  enabled
  variables
```

O bot só substitui variáveis; não decide texto por regra de jogo. O admin valida o limite de 500 caracteres.

## 26.7. Rotas internas [TÉCNICA]

Bot → API:

```text
POST /internal/v1/twitch/commands
POST /internal/v1/twitch/channel/open
POST /internal/v1/twitch/stream-status
GET  /internal/v1/twitch/channels
```

API → Bot:

```text
POST /internal/chat/send          (lote de mensagens)
```

Todas: somente na rede interna do Docker (o proxy público não roteia `/internal`); autenticação service-to-service (`Authorization: Bearer INTERNAL_API_TOKEN`); validação Zod; `X-Request-Id = message_id` da Twitch (rastreio ponta a ponta).

A API confia no `twitch_user_id` enviado pelo bot. Por isso essas rotas nunca podem ficar públicas.

---

# 27. CONFIGURAÇÃO

## 27.1. GameConfig [TÉCNICA]

```text
GameConfig
  key
  value           jsonb
  version
  updated_by
  updated_at
```

- Cada chave tem schema Zod em `packages/config`; o admin só salva valor válido.
- Cache em memória em cada processo, invalidado por `NOTIFY config_changed`.
- Regras importantes ficam em tabelas próprias (definições de item, cultura, nível, evento...).
- Valores que definem prazos ou promessas ao jogador são copiados para o registro na criação (2.5).
- Alteração de configuração econômica global: só ADMIN, com `AuditLog` (4.3, 4.4).
- **Tornar um valor configurável não autoriza alterar o valor aprovado** `[FECHADA · v1.2]`.

## 27.2. Valores iniciais aprovados

| Chave | Valor | Origem |
|---|---|---|
| `farm.max_per_user` | 5 | FECHADA · v1.2 |
| `farm.initial_coins` | 100 | FECHADA · v1.0 |
| `farm.initial_plots` | 3 | FECHADA · v1.0 |
| `farm.initial_seeds` | 3 | FECHADA · v1.0 |
| `harvest.min_cooldown_seconds` | 5 | FECHADA · v1.0 |
| `crops.rot_after_seconds` | 86400 | FECHADA · v1.0 |
| `market.quick_sell_fee_bps` | 200 | FECHADA · v1.0 |
| `marketplace.fee_bps` | 0 | FECHADA · v1.0 |
| `marketplace.cooldown_seconds` | 43200 | FECHADA · v1.0 |
| `marketplace.cooldown_with_horse_seconds` | 36000 | FECHADA · v1.0 |
| `tractor.cooldown_seconds` | 86400 | FECHADA · v1.0 |
| `upgrades.horse.price` | 20000 | FECHADA · v1.0 |
| `animals.chicken.eggs_per_feed` | 3 | FECHADA · v1.0 |
| `animals.chicken.egg_interval_seconds` | 7200 | FECHADA · v1.0 |
| `animals.cow.production_seconds` | 10800 | FECHADA · v1.0 |
| `animals.cow.milk_per_feed` | 1 | FECHADA · v1.0 |
| `animals.pig.feed_interval_seconds` | 86400 | FECHADA · v1.0 |
| `animals.pig.buy_price` | 30 | FECHADA · v1.2 |
| `animals.pig.premature_sell_price` | 15 | FECHADA · v1.2 |
| `animals.pig.adult_sell_price` | 100 | FECHADA · v1.2 |
| `animals.pig.max_per_farm` | 2 | FECHADA · v1.2 |

Valores fechados que vivem em tabelas de definição, não em `GameConfig` (uma única fonte para cada valor):

- duração do boost de meta: `CommunityBoostDefinition.duration_seconds = 172800` (2 dias) no seed `[FECHADA · v1.2]`;
- alvo do evento Lobo: `EventDefinition.target_participants = 30` `[FECHADA · v1.2]`.

O lote do Marketplace (100) **não** é configuração: é constante em `packages/contracts` e `CHECK` no banco `[FECHADA · v1.2]`.

Valores ainda não definidos usam fixture provisória claramente marcada no seed (`PENDENTE PD-23`).


## 27.3. Política de versionamento das definições econômicas [TÉCNICA · v1.3.4]

Uma definição econômica `ACTIVE` que já foi utilizada **não muda de significado**.

Estados normativos:

```text
DRAFT
ACTIVE
RETIRED
```

Campos mínimos de revisão, onde aplicável:

```text
key
version                inteiro >= 1
status
valid_from
valid_to               nullable
created_at
created_by_user_id
content_hash

UNIQUE(key, version)
CHECK(version >= 1)
CHECK(valid_to IS NULL OR valid_to > valid_from)
```

`DRAFT` pode ser editada. Campos econômicos de `ACTIVE`/`RETIRED` são imutáveis. Alterar regra econômica significa criar nova versão.

### 27.3.1. Definições sujeitas a versionamento

Obrigatório para as revisões econômicas de:

```text
CropDefinition
ItemQualityDefinition
LevelDefinition / curva
ActionXpDefinition
ShopOffer
CommunityGoalTemplate
EventDefinition
CommunityBenefitDefinition
CommunityBoostDefinition
LootTable
parâmetros econômicos de ItemDefinition
```

`LootTable` já segue esse princípio; esta política torna a regra geral.

### 27.3.2. Identidade estável vs revisão econômica

Não criar “milho v2” como outro item de inventário só porque preço/XP mudou. `ItemDefinition.id/key` continua sendo a identidade lógica estável; mudanças econômicas são revisionadas separadamente ou por versão da própria definição, sem quebrar a identidade do item.

### 27.3.3. Ativação

1. ADMIN cria `DRAFT`;
2. validação Zod;
3. invariantes anti-arbitragem/consistência;
4. testes/preview;
5. transação fecha `valid_to` anterior, ativa nova versão, grava `AuditLog` e `NOTIFY config_changed`;
6. somente fatos novos usam a nova revisão.

### 27.3.4. Snapshot

Valores que representam promessa ao jogador são congelados no fato: `grows_at`, `rots_at`, `withdraw_available_at`, preço do listing, valores da meta/evento, versão da loot table e resultado de caixa. Ledger guarda o valor efetivamente movimentado e nunca é recalculado com definição atual.

Fatos econômicos críticos carregam `definition_version_id` ou `economic_ruleset_version` quando necessário para responder: **qual regra produziu este resultado?**

---

# 28. API — CONTRATOS PRINCIPAIS

Arquitetura de contrato; nomes finais podem variar mantendo a semântica. Convenções `[TÉCNICA]`: prefixo `/api/v1`; `Idempotency-Key` em rotas econômicas (23.1); `X-CSRF-Token` em mutações (32.3); respostas de erro no formato da seção 31; valores `bigint` (moedas, preços, XP) trafegam como **string** no JSON para não perder precisão.

## 28.1. Auth

```text
GET  /api/v1/auth/twitch/start
GET  /api/v1/auth/twitch/callback
POST /api/v1/auth/logout
GET  /api/v1/auth/me
GET  /api/v1/auth/csrf
POST /api/v1/auth/dev-login     só quando habilitado fora de produção (32.10); caso contrário a rota não existe (404)
```

## 28.2. Streamers

```text
GET  /api/v1/streamers/active
GET  /api/v1/streamers/:streamerId
POST /api/v1/streamers/apply
GET  /api/v1/streamers/me
GET  /api/v1/streamers/me/authorize-bot            OAuth channel:bot
GET  /api/v1/streamers/me/authorize-bot/callback
POST /api/v1/streamers/me/channel/close            (PD-05, provisório)
```

## 28.3. Fazendas

```text
GET  /api/v1/farms
POST /api/v1/farms                                 respeita o limite de 5
GET  /api/v1/farms/:farmId
POST /api/v1/farms/:farmId/sell                    BLOQUEADO até PD-02 (responde 501)
PUT  /api/v1/farms/:farmId/active-title            { titleDefinitionId | null } (14.4)
```

## 28.4. Plantio e colheita

```text
GET  /api/v1/farms/:farmId/plots                   estados calculados + serverTime
POST /api/v1/farms/:farmId/plots/:plotId/plant
POST /api/v1/farms/:farmId/plant                   preenche o máximo possível (semântica do $plantar)
POST /api/v1/farms/:farmId/plots/:plotId/harvest
POST /api/v1/farms/:farmId/harvest                 colhe tudo (semântica do $colher)
```

As duas rotas de colheita respeitam o mesmo cooldown (PD-07).

## 28.5. Inventário, coleção e recompensas

```text
GET  /api/v1/farms/:farmId/inventory
POST /api/v1/farms/:farmId/inventory/:inventoryItemId/discard
POST /api/v1/farms/:farmId/inventory/expand                    (valores PD-23)
GET  /api/v1/farms/:farmId/rewards?status=AWAITING_SPACE      RewardGrant (18.6)
POST /api/v1/farms/:farmId/rewards/:rewardGrantId/claim        resgate (PD-11)
GET  /api/v1/farms/:farmId/collection
```

## 28.6. Caixas

```text
POST /api/v1/farms/:farmId/reward-boxes/:inventoryItemId/open
```

## 28.7. Trator, animais e upgrades

```text
GET  /api/v1/farms/:farmId/tractor
POST /api/v1/farms/:farmId/tractor/use

GET  /api/v1/farms/:farmId/animals
POST /api/v1/farms/:farmId/animals/pigs            comprar filhote
POST /api/v1/farms/:farmId/animals/chickens        comprar (preço PD-23)
POST /api/v1/farms/:farmId/animals/cows            comprar (preço PD-23)
POST /api/v1/farms/:farmId/animals/:animalId/feed
POST /api/v1/farms/:farmId/animals/:animalId/collect
POST /api/v1/farms/:farmId/animals/:animalId/sell

POST /api/v1/farms/:farmId/upgrades/horse
```

## 28.8. Loja e mercado

```text
GET  /api/v1/shop?farmId=...                       (PD-06, provisório)
POST /api/v1/farms/:farmId/shop/buy                (PD-06, provisório)
GET  /api/v1/market/prices
POST /api/v1/farms/:farmId/market/quick-sell
```

## 28.9. Marketplace

```text
GET    /api/v1/marketplace/listings
POST   /api/v1/marketplace/listings                  { farmId, itemDefinitionId, qualityId, unitPrice }
POST   /api/v1/marketplace/listings/:listingId/buy   { buyerFarmId }
DELETE /api/v1/marketplace/listings/:listingId       retirar (respeita withdraw_available_at)
```

Criação não aceita `quantity`: o lote é sempre 100.

## 28.10. Comunidade

```text
GET  /api/v1/communities/:communityId
GET  /api/v1/communities/:communityId/members
GET  /api/v1/communities/:communityId/goal
GET  /api/v1/communities/:communityId/events
POST /api/v1/communities/:communityId/events/:eventId/participate

Streamer dono da comunidade (auditado):
POST /api/v1/communities/:communityId/members/:farmId/remove
POST /api/v1/communities/:communityId/members/:farmId/readmit
POST /api/v1/communities/:communityId/ship-goods
```

## 28.11. Rankings

```text
GET /api/v1/rankings/global?dimension=...
GET /api/v1/communities/:communityId/rankings?dimension=...
GET /api/v1/rankings/weekly?dimension=...
```

`dimension` validada por enum: `LEVEL | COLLECTOR_LEVEL | CONTRIBUTION_LEVEL | COINS`.

## 28.12. Admin e Support

Rotas e guards separados: `/api/v1/admin/*` e `/api/v1/support/*`.

Nunca fazer `@Roles('ADMIN', 'SUPPORT')` em todo módulo administrativo por conveniência. Cada ação declara explicitamente o papel autorizado.

Admin: usuários, streamers, fazendas, itens, loja, culturas, níveis, qualidades, colecionáveis, animais, upgrades, mercado, eventos, metas e templates, benefícios, boosts, loot tables, mensagens do bot, configuração, auditoria, ajustes econômicos.

```text
POST /api/v1/admin/farms/:farmId/adjustments      { kind: COINS | ITEM, delta, itemDefinitionId?, qualityId?, reason }
                                                  motivo obrigatório; lock R5; ledger ADMIN_ADJUST; AuditLog
```

Support: consultas de atendimento, vínculo Twitch, logs/auditoria compatíveis (4.3). Ações do SUPPORT com efeito (readmissão, vínculo/desvínculo) respondem 501 até existir procedimento aprovado (`[PENDENTE PD-29]`).

## 28.13. Saúde

```text
GET /api/v1/health/live     processo vivo
GET /api/v1/health/ready    banco pronto e migrations compatíveis
```


## 28.14. Contratos Zod/OpenAPI normativos do Protótipo 0.1 [TÉCNICA · v1.3.4]

### 28.14.1. Fonte canônica

Fonte de verdade:

```text
packages/contracts/src/
```

Zod é canônico. OpenAPI é gerado dos schemas/operações e salvo em:

```text
docs/openapi/farmquest-0.1.json
```

CI executa geração e falha se houver drift:

```text
generate-openapi
git diff --exit-code docs/openapi/farmquest-0.1.json
```

Controllers não mantêm DTO paralelo divergente do Zod.

### 28.14.2. Primitivos

```ts
const Uuid = z.string().uuid();
const BigIntString = z.string().regex(/^(0|[1-9]\d*)$/);
const PositiveBigIntString = z.string().regex(/^[1-9]\d*$/);
const IsoDateTime = z.string().datetime({ offset: true });
const IdempotencyKey = z.string().min(16).max(128);
const RequestId = z.string().min(8).max(128);
```

Moedas e XP trafegam como string no JSON.

### 28.14.3. Headers

Toda mutação econômica:

```text
Idempotency-Key: obrigatório
X-CSRF-Token: obrigatório para sessão por cookie
X-Request-Id: opcional; servidor gera se ausente
```

Login DEV:

```text
X-Dev-Login-Secret: obrigatório
```

### 28.14.4. Envelope

Sucesso:

```json
{
  "data": {},
  "meta": {
    "requestId": "req_...",
    "serverTime": "2026-09-28T17:00:00.000Z",
    "linearizedAt": "2026-09-28T17:00:00.123Z"
  }
}
```

`linearizedAt` pode ser omitido em GET/read-only.

Erro:
```json
{
  "error": {
    "code": "HARVEST_COOLDOWN_ACTIVE",
    "message": "texto para log",
    "details": {}
  },
  "meta": { "requestId": "req_..." }
}
```

### 28.14.5. Login DEV

```text
POST /api/v1/auth/dev-login
```

O endpoint mantém o nome adotado em 32.10. Body vazio/strict; exige `APP_ENV != production`, `DEV_LOGIN_ENABLED=true` e segredo forte no header `X-Dev-Login-Secret`. Não aceita `userId`, `twitchUserId` ou username arbitrário. Resultado: `204` + cookie de sessão.

Também no 0.1:

```text
GET  /api/v1/auth/me
GET  /api/v1/auth/csrf
POST /api/v1/auth/logout
```

### 28.14.6. Views principais

```ts
const FarmView = z.object({
  id: Uuid,
  level: z.number().int().positive(),
  xp: BigIntString,
  coins: BigIntString,
  inventorySlots: z.number().int().positive(),
  stackLimit: z.number().int().positive(),
  nextHarvestAt: IsoDateTime.nullable(),
  status: z.literal("ACTIVE")
});

const PlotView = z.object({
  id: Uuid,
  slotNumber: z.number().int().positive(),
  unlocked: z.boolean(),
  seedsCapacity: z.number().int().positive(),
  state: z.enum(["EMPTY","PLANTED","READY","ROTTEN"]),
  planted: z.object({
    cropDefinitionId: Uuid,
    cropName: z.string(),
    seedCount: z.number().int().positive(),
    plantedAt: IsoDateTime,
    growsAt: IsoDateTime,
    rotsAt: IsoDateTime
  }).nullable()
});
```

### 28.14.7. Plantar

```text
POST /api/v1/farms/:farmId/plant
POST /api/v1/farms/:farmId/plots/:plotId/plant
```

Body:

```ts
z.object({ cropDefinitionId: Uuid }).strict()
```

Resposta mínima:

```ts
z.object({
  code: z.literal("PLANT_OK"),
  plantedPlots: z.array(z.object({
    plotId: Uuid,
    seedCount: z.number().int().positive(),
    growsAt: IsoDateTime,
    rotsAt: IsoDateTime
  })),
  seedsConsumed: z.number().int().positive()
})
```

### 28.14.8. Colher

```text
POST /api/v1/farms/:farmId/harvest
POST /api/v1/farms/:farmId/plots/:plotId/harvest
```

Body vazio/strict. Resposta:

```ts
z.object({
  code: z.literal("HARVEST_OK"),
  harvested: z.array(z.object({
    plotId: Uuid,
    itemDefinitionId: Uuid,
    quality: z.enum(["COMMON","GOOD","EXCELLENT","EXTRAORDINARY","ROTTEN"]),
    quantity: z.number().int().positive(),
    xpGranted: BigIntString
  })),
  totalXpGranted: BigIntString,
  newLevel: z.number().int().positive(),
  nextHarvestAt: IsoDateTime
})
```

### 28.14.9. Inventário e descarte

```text
GET  /api/v1/farms/:farmId/inventory
POST /api/v1/farms/:farmId/inventory/:inventoryItemId/discard
```

Discard:

```ts
z.object({ quantity: z.number().int().positive() }).strict()
```

```ts
const InventoryItemView = z.object({
  id: Uuid,
  itemDefinitionId: Uuid,
  name: z.string(),
  quality: z.enum(["NONE","COMMON","GOOD","EXCELLENT","EXTRAORDINARY","ROTTEN"]),
  quantity: z.number().int().nonnegative(),
  reservedQuantity: z.number().int().nonnegative()
});
```

### 28.14.10. Loja provisória PD-06

```text
GET  /api/v1/shop?farmId=<uuid>
POST /api/v1/farms/:farmId/shop/buy
```

Buy:

```ts
z.object({
  offerId: Uuid,
  quantity: z.number().int().min(1).max(1000)
}).strict()
```

Resposta inclui `coinsSpent`, `coinsAfter` e `itemsAdded`; valores monetários como string.

### 28.14.11. Venda rápida

```text
POST /api/v1/farms/:farmId/market/quick-sell
```

Body:

```ts
z.object({
  inventoryItemId: Uuid,
  quantity: z.number().int().positive()
}).strict()
```

Resposta:

```ts
z.object({
  code: z.literal("QUICK_SELL_OK"),
  quantitySold: z.number().int().positive(),
  grossValue: BigIntString,
  feeValue: BigIntString,
  payout: BigIntString,
  coinsAfter: BigIntString,
  xpGranted: BigIntString
})
```

### 28.14.12. OpenAPI obrigatório

O OpenAPI do 0.1 declara schemas, códigos de erro por rota, headers de idempotência/CSRF e exemplos. Convenção HTTP mínima: `403` autorização/CSRF; `409` conflito de idempotência/estado; `422` regra de domínio inválida quando aplicável; `429` rate limit; `501 PENDING_PRODUCT_DECISION` somente para rota bloqueada por decisão de produto.

---

# 29. MODELO DE DADOS — ENTIDADES

Esta seção não é o schema Prisma completo; define entidades que o schema deve conter.

| Grupo | Entidades |
|---|---|
| Identidade | `User`, `UserSession`, `TwitchIdentity`, `TwitchCredential`, `Streamer` |
| Fazendas e comunidade | `Farm`, `Community`, `CommunityMembership`, `CommunityMembershipHistory`, `CommunityBenefitDefinition`, `CommunityUnlockedBenefit`, `CommunityBoostDefinition`, `CommunityActiveBoost`, `CommunityGoalTemplate`, `CommunityGoal`, `CommunityGoalContribution`, `EventDefinition`, `CommunityEvent`, `CommunityEventParticipant` |
| Cultivo e inventário | `Plot`, `CropDefinition`, `PlantedCrop`, `ItemDefinition`, `ItemQualityDefinition`, `InventoryItem`, `TractorUsage`, `CollectibleDefinition`, `FarmCollection` |
| Animais e upgrades | `FarmAnimal`, `FarmUpgrade` |
| Economia | `CoinLedger`, `ItemLedger`, `ShopOffer`, `MarketPrice`, `MarketplaceListing`, `MarketplaceSellerState` |
| Progressão | `LevelDefinition`, `ActionXpDefinition`, `ProgressLedger`, `FarmCollectorProgress`, `FarmContributionProgress`, `TitleDefinition`, `FarmUnlockedTitle`, `FarmStats`, `FarmStatsWeekly` |
| Recompensas | `LootTable`, `LootTableDrawCount`, `LootEntry`, `RewardBoxOpening`, `RewardGrant`, `RewardEligibilitySnapshot` |
| Consistência e operação | `IdempotencyRecord`, `TwitchMessageDedupe`, `OutboxMessage`, `AuditLog`, `GameConfig`, `BotMessageTemplate` |

Removidas na v1.3.1: `PendingReward` (substituída por `RewardGrant` com `AWAITING_SPACE`); `Farm.status = FROZEN`; `Community.status`; `CommunityGoalContribution.reward_status`; `ItemLedger.delta` e `ItemLedger.inventory_item_id`; `EventDefinition.reward_loot_table_id`.

Convenções `[TÉCNICA]`: tabelas e colunas em `snake_case` (`@@map`/`@map`); código em `camelCase`; enums em `UPPER_SNAKE`; ids `uuid` (ledgers e outbox: `bigserial`); datas `timestamptz` em UTC.

---

# 30. FKs, ÍNDICES, CONSTRAINTS E PRIVILÉGIOS DO BANCO

## 30.1. Índices e constraints críticos

O schema final deve conter equivalentes a estes invariantes. Quando o Prisma não expressar a garantia (índice parcial, `CHECK`, exclusion, FK composta), ela vai em migration SQL, com teste e comentário da razão.

```text
-- Identidade
UNIQUE(TwitchIdentity.twitch_user_id)
UNIQUE(TwitchIdentity.user_id)
UNIQUE(Streamer.twitch_user_id)
UNIQUE(Streamer.user_id)
UNIQUE(MarketplaceSellerState.user_id)                  -- criado junto com o User

-- Fazenda
UNIQUE(farm.user_id, farm.streamer_id) WHERE status <> 'SOLD'
CHECK(farm.coins >= 0)
CHECK(farm.xp >= 0)
UNIQUE(farm.id, farm.community_id)                       -- alvo de FK composta
FK (farm.community_id, farm.streamer_id) -> community(id, streamer_id)
UNIQUE(plot.farm_id, plot.slot_number)
UNIQUE(planted_crop.plot_id) WHERE harvested_at IS NULL
UNIQUE(farm_upgrade.farm_id, farm_upgrade.upgrade_type)
UNIQUE(farm_collection.farm_id, farm_collection.collectible_id)
PK(farm_unlocked_title.farm_id, title_definition_id)
FK (farm.id, farm.active_title_id) -> farm_unlocked_title(farm_id, title_definition_id)   -- título ativo precisa estar desbloqueado

-- Inventário e ledgers
UNIQUE(inventory_item.farm_id, item_definition_id, quality_id)     -- quality_id NOT NULL (NONE)
CHECK(inventory_item.quantity >= 0)
CHECK(inventory_item.reserved_quantity >= 0 AND reserved_quantity <= quantity)
CHECK(item_ledger.quantity_after >= 0)
CHECK(item_ledger.reserved_after >= 0 AND reserved_after <= quantity_after)
CHECK(coin_ledger.balance_after >= 0)
CHECK(progress_ledger.value_after >= 0)

-- Comunidade
UNIQUE(community.streamer_id)
UNIQUE(community.id, community.streamer_id)              -- alvo de FK composta
UNIQUE(community_membership.farm_id)
FK (community_membership.farm_id, community_id) -> farm(id, community_id)
UNIQUE(community_goal.community_id) WHERE status <> 'CLOSED'
UNIQUE(community_goal.community_id, cycle_number)
CHECK(community_goal.target_quantity > 0)
CHECK(community_goal.current_quantity >= 0 AND current_quantity <= target_quantity)
CHECK(community_goal.contribution_bps BETWEEN 0 AND 10000)
PK(community_goal_contribution.goal_id, farm_id)
CHECK(community_goal_contribution.fraction_acc BETWEEN 0 AND 9999)
UNIQUE(community_event.community_id) WHERE status = 'ACTIVE'
UNIQUE(community_event_participant.event_id, farm_id)
CHECK(community_event.target_participants IS NULL OR participant_count <= target_participants)
UNIQUE(community_active_boost.community_id, source, source_ref, boost_definition_id)
UNIQUE(community_unlocked_benefit.community_id, benefit_definition_id)

-- Marketplace
UNIQUE(marketplace_listing.seller_user_id) WHERE status = 'ACTIVE'
CHECK(marketplace_listing.quantity = 100)
CHECK(marketplace_listing.unit_price > 0 AND unit_price <= 10000000000000)

-- Recompensas
UNIQUE(reward_grant.farm_id, source_type, source_id, reward_key)
CHECK(reward_grant.quantity > 0)
UNIQUE(reward_box_opening.farm_id, idempotency_key)
CHECK(item_definition.category <> 'REWARD_BOX' OR loot_table_id IS NOT NULL)
UNIQUE(loot_table.code, version)
CHECK(loot_entry.weight > 0)
CHECK(loot_table_draw_count.draws BETWEEN 1 AND 4)

-- Economia e progressão
UNIQUE(market_price.item_definition_id, price_date)
EXCLUDE USING gist (action_type WITH =, tstzrange(active_from, active_to) WITH &&)   -- action_xp_definition sem sobreposição

-- Snapshot / definições versionadas / outbox
UNIQUE(reward_eligibility_snapshot.source_type, source_id, farm_id)
CHECK(definition_version >= 1)                            -- onde a tabela usar versionamento 27.3
CHECK(valid_to IS NULL OR valid_to > valid_from)          -- onde aplicável
CHECK(outbox_message.attempts >= 0)
CHECK(outbox_message.status <> 'IN_FLIGHT' OR lease_until IS NOT NULL)

-- Consistência
UNIQUE(idempotency_record.actor_user_id, scope, key)
UNIQUE(twitch_message_dedupe.provider, external_message_id)
```

Toda FK que referencia `farm` usa colunas que nunca são atualizadas (22.2).

## 30.2. Matriz lógica completa de FKs [TÉCNICA · v1.3.4]

Política: core econômico/histórico não usa `ON DELETE CASCADE`; entidades operacionais usam soft delete/estado/anônimização. `ON UPDATE` de chave referenciada = `NO ACTION`; IDs/chaves usadas em FK são imutáveis. Referências polimórficas ficam explicitamente sem FK física.

### Identidade

| Origem | Campo | Destino | Observação |
|---|---|---|---|
| `UserSession` | `user_id` | `User.id` | sessão |
| `TwitchIdentity` | `user_id` | `User.id` | 1:1 lógico |
| `Streamer` | `user_id` | `User.id` | `UNIQUE` |
| `Streamer` | `approved_by_user_id` | `User.id` | nullable |
| `MarketplaceSellerState` | `user_id` | `User.id` | mutex 1:1 |
| `AuditLog` | `actor_user_id` | `User.id` | nullable para SYSTEM se necessário |
| `TwitchCredential` | `twitch_user_id` | — | identidade externa; sem FK interna |

### Fazenda e cultivo

| Origem | Campo | Destino |
|---|---|---|
| `Farm` | `user_id` | `User.id` |
| `Farm` | `streamer_id` | `Streamer.id` |
| `Farm` | `(community_id, streamer_id)` | `Community(id, streamer_id)` |
| `Farm` | `(id, active_title_id)` | `FarmUnlockedTitle(farm_id, title_definition_id)` |
| `Plot` | `farm_id` | `Farm.id` |
| `PlantedCrop` | `farm_id` | `Farm.id` |
| `PlantedCrop` | `plot_id` | `Plot.id` |
| `PlantedCrop` | `crop_definition_id` | `CropDefinition.id` |
| `PlantedCrop` | `result_quality_id` | `ItemQualityDefinition.id` |
| `InventoryItem` | `farm_id` | `Farm.id` |
| `InventoryItem` | `item_definition_id` | `ItemDefinition.id` |
| `InventoryItem` | `quality_id` | `ItemQualityDefinition.id` |
| `TractorUsage` | `farm_id` | `Farm.id` |
| `FarmAnimal` | `farm_id` | `Farm.id` |
| `FarmUpgrade` | `farm_id` | `Farm.id` |
| `FarmCollection` | `farm_id` | `Farm.id` |
| `FarmCollection` | `collectible_id` | `CollectibleDefinition.id` |

### Definições e catálogo

| Origem | Campo | Destino |
|---|---|---|
| `CropDefinition` | `seed_item_id` | `ItemDefinition.id` |
| `CropDefinition` | `product_item_id` | `ItemDefinition.id` |
| `ItemDefinition` | `loot_table_id` | `LootTable.id` |
| `ShopOffer` | `item_definition_id` | `ItemDefinition.id` |
| `MarketPrice` | `item_definition_id` | `ItemDefinition.id` |
| `EventDefinition` | `reward_item_definition_id` | `ItemDefinition.id` |
| `EventDefinition` | `boost_definition_id` | `CommunityBoostDefinition.id` |
| `EventDefinition` | `message_start_key` | `BotMessageTemplate.key` |
| `EventDefinition` | `message_end_key` | `BotMessageTemplate.key` |

### Comunidade

| Origem | Campo | Destino |
|---|---|---|
| `Community` | `streamer_id` | `Streamer.id` |
| `CommunityMembership` | `(farm_id, community_id)` | `Farm(id, community_id)` |
| `CommunityMembership` | `user_id` | `User.id` |
| `CommunityMembership` | `removed_by_user_id` | `User.id` |
| `CommunityMembershipHistory` | `farm_id` | `Farm.id` |
| `CommunityMembershipHistory` | `community_id` | `Community.id` |
| `CommunityMembershipHistory` | `changed_by_user_id` | `User.id` |
| `CommunityUnlockedBenefit` | `community_id` | `Community.id` |
| `CommunityUnlockedBenefit` | `benefit_definition_id` | `CommunityBenefitDefinition.id` |
| `CommunityActiveBoost` | `community_id` | `Community.id` |
| `CommunityActiveBoost` | `boost_definition_id` | `CommunityBoostDefinition.id` |
| `CommunityGoal` | `community_id` | `Community.id` |
| `CommunityGoal` | `template_id` | `CommunityGoalTemplate.id` |
| `CommunityGoal` | `item_definition_id` | `ItemDefinition.id` |
| `CommunityGoal` | `reward_item_definition_id` | `ItemDefinition.id` |
| `CommunityGoal` | `boost_definition_id` | `CommunityBoostDefinition.id` |
| `CommunityGoalContribution` | `goal_id` | `CommunityGoal.id` |
| `CommunityGoalContribution` | `farm_id` | `Farm.id` |
| `CommunityEvent` | `community_id` | `Community.id` |
| `CommunityEvent` | `definition_id` | `EventDefinition.id` |
| `CommunityEventParticipant` | `event_id` | `CommunityEvent.id` |
| `CommunityEventParticipant` | `farm_id` | `Farm.id` |
| `CommunityEventParticipant` | `user_id` | `User.id` |

Sem FK física deliberadamente: `CommunityActiveBoost.source_ref` e `CommunityUnlockedBenefit.source_ref` (origem polimórfica, preservada como histórico).

### Progressão

| Origem | Campo | Destino |
|---|---|---|
| `FarmCollectorProgress` | `farm_id` | `Farm.id` |
| `FarmContributionProgress` | `farm_id` | `Farm.id` |
| `FarmUnlockedTitle` | `farm_id` | `Farm.id` |
| `FarmUnlockedTitle` | `title_definition_id` | `TitleDefinition.id` |
| `FarmStats` | `farm_id` | `Farm.id` |
| `FarmStatsWeekly` | `farm_id` | `Farm.id` |

### Marketplace e ledgers

| Origem | Campo | Destino |
|---|---|---|
| `MarketplaceListing` | `seller_user_id` | `User.id` |
| `MarketplaceListing` | `seller_farm_id` | `Farm.id` |
| `MarketplaceListing` | `buyer_user_id` | `User.id` |
| `MarketplaceListing` | `buyer_farm_id` | `Farm.id` |
| `MarketplaceListing` | `item_definition_id` | `ItemDefinition.id` |
| `MarketplaceListing` | `quality_id` | `ItemQualityDefinition.id` |
| `CoinLedger` | `farm_id` | `Farm.id` |
| `CoinLedger` | `user_id` | `User.id` |
| `ItemLedger` | `farm_id` | `Farm.id` |
| `ItemLedger` | `item_definition_id` | `ItemDefinition.id` |
| `ItemLedger` | `quality_id` | `ItemQualityDefinition.id` |
| `ProgressLedger` | `farm_id` | `Farm.id` |

Sem FK física: `CoinLedger.reference_id`, `ItemLedger.reference_id`, `ProgressLedger.reference_id`; a dupla `reference_type + reference_id` é histórica.

### Recompensas

| Origem | Campo | Destino |
|---|---|---|
| `LootTableDrawCount` | `loot_table_id` | `LootTable.id` |
| `LootEntry` | `loot_table_id` | `LootTable.id` |
| `LootEntry` | `item_definition_id` | `ItemDefinition.id` |
| `LootEntry` | `quality_id` | `ItemQualityDefinition.id` |
| `RewardBoxOpening` | `farm_id` | `Farm.id` |
| `RewardBoxOpening` | `box_item_definition_id` | `ItemDefinition.id` |
| `RewardBoxOpening` | `loot_table_id` | `LootTable.id` |
| `RewardGrant` | `farm_id` | `Farm.id` |
| `RewardGrant` | `item_definition_id` | `ItemDefinition.id` |
| `RewardGrant` | `quality_id` | `ItemQualityDefinition.id` |
| `RewardEligibilitySnapshot` | `farm_id` | `Farm.id` |

`RewardGrant.source_id` e `RewardEligibilitySnapshot.source_id` são polimórficos; sem FK física.

### Operação

`OutboxMessage.aggregate_id`, `AuditLog.entity_id` e referências de idempotência são deliberadamente polimórficos; não criar FK genérica falsa.

## 30.3. Privilégios do PostgreSQL [TÉCNICA · v1.3.4]

Roles:

```text
farmquest_owner       NOLOGIN — dono do database/schema
farmquest_migrator    LOGIN   — somente migrate one-shot
farmquest_app         LOGIN   — API + worker no MVP inicial
farmquest_backup      LOGIN   — pg_dump / validação de restore read-only
```

Web e twitch-bot não recebem credencial de banco.

| Ação | owner | migrator | app | backup |
|---|---:|---:|---:|---:|
| CONNECT | sim | sim | sim | sim |
| CREATE/ALTER/DROP schema/tabela | sim | sim | não | não |
| SELECT domínio | sim | sim | sim | sim |
| INSERT/UPDATE domínio mutável | sim | sim | sim | não |
| DELETE domínio econômico | sim | só migration | não | não |
| INSERT ledger/audit/history/snapshot | sim | sim | sim | não |
| UPDATE/DELETE ledger/audit/history/snapshot | sim | só migration excepcional | **não** | não |
| outbox SELECT/INSERT/UPDATE | sim | sim | sim | SELECT |
| outbox DELETE por retenção | sim | sim | sim | não |
| cleanup sessão/idempotência | sim | sim | sim | não |
| TRUNCATE | sim | só migration explícita | **não** | não |
| superuser/createdb/createrole/replication | não necessário | **não** | **não** | **não** |

Hardening obrigatório:

```sql
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON DATABASE farmquest FROM PUBLIC;
```

- schema da aplicação: `farmquest`;
- `search_path = farmquest, pg_catalog`;
- `farmquest_owner` é `NOLOGIN` e dono dos objetos; `farmquest_migrator` é a única role de login autorizada a `SET ROLE farmquest_owner` durante migrations (preferir membership `NOINHERIT`/uso explícito);
- `farmquest_app` e `farmquest_backup` não são membros de `farmquest_owner`;
- usar `ALTER DEFAULT PRIVILEGES` para que novos objetos recebam grants coerentes para `app`/`backup`;
- PostgreSQL sem porta pública;
- `farmquest_app` não é dono de tabela;
- ledgers, `AuditLog`, `CommunityMembershipHistory`, `RewardBoxOpening` e `RewardEligibilitySnapshot` são append-only para `farmquest_app`;
- migration cria grants explícitos e nunca roda com `farmquest_app`;
- novos objetos não herdam privilégio público;
- RLS não é obrigatório no MVP; autorização continua na aplicação, sem justificar privilégios amplos.

---

# 31. CÓDIGOS DE ERRO DE DOMÍNIO

Formato `[TÉCNICA]`:

```json
{ "error": { "code": "HARVEST_COOLDOWN_ACTIVE", "message": "texto para log", "details": { "remainingSeconds": 42 } } }
```

Códigos estáveis em `packages/contracts` (enum único para api, web, worker e bot):

```text
FARM_LIMIT_REACHED
FARM_NOT_FOUND
FARM_SOLD
FARM_ACCESS_REMOVED
FARM_STREAMER_SUSPENDED
USER_BANNED
TWITCH_ACCOUNT_REQUIRED
STREAMER_NOT_APPROVED
CHANNEL_GAME_NOT_ACTIVE
NO_FARM_IN_CHANNEL
UNKNOWN_CROP
CROP_LOCKED_BY_LEVEL
NOT_ENOUGH_SEEDS
NO_EMPTY_PLOTS
PLOT_NOT_READY
PLOT_ALREADY_HARVESTED
NOTHING_TO_HARVEST
HARVEST_COOLDOWN_ACTIVE
INSUFFICIENT_COINS
INVENTORY_INSUFFICIENT
INVENTORY_FULL
ITEM_ROTTEN
ITEM_NOT_SELLABLE
ANIMAL_LIMIT_REACHED
ANIMAL_INVALID_STATE
TRACTOR_COOLDOWN_ACTIVE
TITLE_NOT_UNLOCKED
MARKETPLACE_ACTIVE_LISTING_EXISTS
MARKETPLACE_COOLDOWN_ACTIVE
MARKETPLACE_WITHDRAW_LOCKED
MARKETPLACE_LISTING_NOT_ACTIVE
MARKETPLACE_LISTING_ALREADY_SOLD
MARKETPLACE_SELF_BUY_FORBIDDEN
REWARD_BOX_ALREADY_OPENED
REWARD_NOT_CLAIMABLE
GOAL_NOT_AWAITING_SHIPMENT
EVENT_ALREADY_PARTICIPATED
EVENT_NOT_ACTIVE
FORBIDDEN_SUPPORT_ACTION
FORBIDDEN
CSRF_INVALID
RATE_LIMITED
IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD
PENDING_PRODUCT_DECISION              (HTTP 501 — ponto bloqueado por pendência)
```

Sucesso de comando também tem código (`PLANT_OK`, `HARVEST_OK`, ...) + dados.

A UI e o bot mapeiam código para texto amigável. Para `FARM_ACCESS_REMOVED`, preservar a mensagem de produto: *Você foi expulso desta comunidade! Que pena :/*

---

# 32. SEGURANÇA

## 32.1. OAuth Twitch [TÉCNICA · ERRATA v1.3.4]

Fluxo oficial adotado: Authorization Code Grant server-side.

Obrigatório no FarmQuest:

- `state` anti-CSRF;
- `redirect_uri` exata, fixa por ambiente e cadastrada no console da Twitch;
- troca de `code` server-side com `client_secret` conforme o fluxo oficial;
- validação da identidade retornada;
- token do jogador usado somente para resolver/validar identidade e **não persistido** depois do login;
- tokens de bot/streamer persistidos apenas quando necessários, criptografados em repouso (AES-256-GCM, `TOKEN_ENCRYPTION_KEY`), com refresh token quando o tipo de token possuir refresh.

**PKCE não é requisito arquitetural do FarmQuest enquanto o Authorization Code Grant oficial adotado pela Twitch não o documentar para esse fluxo.** Não adicionar PKCE por pressuposição genérica. Se a Twitch passar a exigir/suportar formalmente outro fluxo, registrar ADR antes da mudança.

Se no futuro o login puro migrar para OIDC Authorization Code Grant, isso é refinamento técnico e exige ADR; não altera identidade econômica baseada em `twitch_user_id`.

## 32.2. Sessão web [TÉCNICA]

```text
UserSession
  id              uuid (identificador interno; nunca vai ao cliente)
  token_hash      sha256 do token do cookie (o token puro só existe no cookie), UNIQUE
  user_id
  csrf_version    inteiro, começa em 1
  created_at
  expires_at
  last_seen_at
  revoked_at
  ip
  user_agent
```

- identificador de sessão opaco (não JWT);
- cookie `HttpOnly`; `Secure` em produção; `SameSite=Lax`; `Path=/`;
- rotação/invalidação; logout revoga a sessão no servidor;
- banimento e suspensão revogam na hora.

## 32.3. CSRF [TÉCNICA]

Para mutações autenticadas por cookie, proteção explícita, **ligada à sessão** (nunca um token global da aplicação):

```text
csrf_token = base64url( HMAC-SHA256( CSRF_SECRET, session.id + ":" + session.csrf_version ) )
```

- `GET /api/v1/auth/csrf` (exige sessão válida) devolve o token da sessão atual; o frontend guarda em memória e envia em `X-CSRF-Token` em toda mutação;
- a API recalcula o HMAC da sessão do cookie e compara em tempo constante (`timingSafeEqual`); diferente → 403 `CSRF_INVALID`;
- rotação: nova sessão no login e em mudança de privilégio (novo `session.id` = novo token); `csrf_version + 1` invalida o token sem encerrar a sessão;
- logout, banimento e expiração revogam a sessão e, com ela, o token;
- o cookie de sessão continua `HttpOnly`; o token CSRF é entregue ao frontend de forma deliberada, pelo endpoint acima;
- nenhuma mutação trafega pelo Socket.IO (24.5), então não há caminho sem CSRF.

## 32.4. Validação [TÉCNICA]

Todos os payloads externos passam por schema validation (Zod). Validar ids, enums, limites, strings, quantidades, números inteiros, overflow e payload excessivo. Inclui rotas internas.

## 32.5. Rate limit [TÉCNICA]

Aplicar pelo menos em: auth; callbacks sensíveis; endpoints internos Twitch; ações econômicas sujeitas a abuso; admin. Separado por usuário, fazenda, comando, canal e IP.

No MVP, em memória (uma instância da API). Limitações conhecidas: zera ao reiniciar; não vale para várias instâncias (34.8). Camadas: bot (anti-spam barato) → API (regra oficial).

Rate limiting nunca substitui idempotência/transação.

## 32.6. Admin, Support e auditoria [TÉCNICA]

Ações sensíveis podem exigir sessão administrativa mais curta ou reautenticação.

Audit log obrigatório para: ajuste econômico; suspensão; readmissão administrativa; vínculo/desvínculo sensível; alteração de configuração global; ações de streamer (remover/readmitir membro, enviar mercadoria, abrir/fechar canal).

```text
AuditLog
  actor_user_id
  actor_role        ADMIN | SUPPORT | STREAMER | SYSTEM
  action
  entity_type
  entity_id
  reason
  before_json
  after_json
  ip
  request_id
  created_at
```

Append-only. Ações comuns de jogador ficam no ledger, não no `AuditLog`.

## 32.7. Logs [TÉCNICA]

Não registrar: access token completo; refresh token; cookie de sessão; segredo interno; header `Authorization`; payload sensível sem necessidade. Redaction centralizado em `packages/logger`.

## 32.8. Infraestrutura [TÉCNICA]

- PostgreSQL sem porta publicada; roles e grants seguem a matriz least-privilege da seção 30.3; `farmquest_app` nunca é superuser nem dono do schema.
- Rotas `/internal` fora do proxy público.
- Cabeçalhos de segurança (helmet/CSP) no web e na API.
- Socket.IO valida origem e sessão no handshake e autoriza cada sala.
- `$queryRaw` sempre com template tag parametrizada; nunca concatenação.
- Dependências: Renovate/Dependabot + auditoria no CI.
- Secrets só no ambiente do EasyPanel; nunca no Git (manter `.env.example` sem valores).

## 32.9. Privacidade e legislação [TÉCNICA]

(Orientação técnica, não parecer jurídico.)

- **LGPD:** dados pessoais mínimos (id Twitch, login, nome, avatar; IP e user agent em sessão/auditoria). Política de privacidade e termos publicados antes do lançamento público. Pedido de exclusão: anonimizar o usuário mantendo o id pseudônimo no ledger. IP com retenção limitada (ex.: 90 dias).
- **Twitch:** seguir o Developer Services Agreement (uso de dados, marca, remoção). Revisar antes do lançamento.
- **ECA Digital (Lei 15.211/2025, em vigor desde 17/03/2026):** proíbe caixas de recompensa pagas (itens aleatórios obtidos mediante pagamento) em jogos acessíveis a crianças e adolescentes; a Twitch aceita usuários a partir de 13 anos. A Caixa do Fazendeiro hoje é recompensa gratuita. Regras de projeto: nunca vender caixa ou item aleatório por dinheiro real; evitar vender aleatoriedade por moeda do jogo; qualquer monetização futura passa por revisão jurídica antes. Barreira formal: bloco `[COMPLIANCE]` da seção 18.5.

## 32.10. Login de desenvolvimento [TÉCNICA]

O Protótipo 0.1 não usa Twitch OAuth (prova só o núcleo econômico) e roda numa VPS exposta à internet. Por isso o login de desenvolvimento é tratado como superfície de ataque:

- **Desligado por padrão:** `DEV_LOGIN_ENABLED=false`.
- **Só fora de produção:** só pode ser ligado quando `APP_ENV` for `development` ou `staging`. Usa-se `APP_ENV` e não `NODE_ENV`, porque as imagens do CI rodam com `NODE_ENV=production` também no ambiente DEV.
- **Falha no boot:** se `APP_ENV=production` e `DEV_LOGIN_ENABLED=true`, a API se recusa a iniciar.
- **Rota inexistente quando desligado:** o módulo do dev-login nem é registrado; `POST /api/v1/auth/dev-login` responde 404.
- **Token forte:** exige `DEV_LOGIN_TOKEN` (aleatório, mínimo 32 bytes) recebido somente pelo header `X-Dev-Login-Secret`; comparação em tempo constante; a API não inicia com o dev-login ligado e token ausente ou curto.
- **Rate limit** estrito (ex.: 5 tentativas/min por IP) e `AuditLog` de cada uso, com IP.
- **Usuários de desenvolvimento:** criados com marca explícita (`User.auth_provider = DEV`), sem `TwitchIdentity`, e com `MarketplaceSellerState` na mesma transação (como em 37.1); recebem sessão, cookie e CSRF exatamente como um login normal (32.2, 32.3), então o resto do sistema é testado de verdade.
- **Proteção extra no proxy**, quando o EasyPanel permitir: autenticação básica ou allowlist de IP no domínio DEV. Páginas do DEV com `noindex`.
- Quando o Twitch OAuth entrar (0.2), o dev-login continua existindo só em DEV/staging; nunca é caminho de login em produção.

---

# 33. OBSERVABILIDADE

## 33.1. Logs estruturados [TÉCNICA]

JSON com: `request_id`, `user_id`, `farm_id`, `community_id`, `correlation_id` (o `message_id` da Twitch atravessa chat → bot → API → outbox → chat), `module`, `action`, `latency_ms`, `result`, `error_code`.

## 33.2. Métricas mínimas [TÉCNICA]

- request count/latency/error por endpoint;
- saturação do pool do banco;
- retries de transação e deadlocks;
- outbox: backlog e idade da mensagem mais antiga, por tópico;
- profundidade das filas do pg-boss e falhas de job;
- comandos Twitch recebidos/processados/rejeitados e latência p95;
- fila de chat do bot: tamanho, mensagens agregadas e descartadas;
- compras no Marketplace: sucesso/conflito;
- replays de idempotência;
- divergências de reconciliação (moedas, estoque, reserva, progressão);
- `RewardGrant` em `PENDING` (quantidade e idade do mais antigo) e em `AWAITING_SPACE`;
- itens recuperados pelos sweeps (metas, eventos, recompensas) — qualquer valor > 0 indica falha a investigar;
- tempo de espera pelo lock da `CommunityGoal` (contenção em pico).

## 33.3. Health e readiness [TÉCNICA]

- liveness: processo está vivo (`/api/v1/health/live`);
- readiness: banco pronto e migrations compatíveis (`/api/v1/health/ready`);
- worker e bot: `/health` na rede interna (bot inclui estado da conexão EventSub).

A API não recebe tráfego antes de migration compatível e banco pronto.

## 33.4. Alertas [TÉCNICA]

CPU > 80%; RAM > 85%; disco > 80%; erros de API; banco indisponível; bot desconectado; backlog do outbox > 30s; mensagem `internal.*` com muitas tentativas; `RewardGrant PENDING` com mais de 10 min; qualquer recuperação feita por sweep; descartes na fila de chat; job falhando repetidamente; reconciliação com divergência; backup não concluído.

Ferramentas iniciais: monitor externo gratuito batendo em `/api/v1/health/ready`; rastreio de erros (Sentry plano gratuito ou GlitchTip) opcional.

---

# 34. INFRAESTRUTURA E DEPLOY

## 34.1. VPS inicial [TÉCNICA]

Hostinger KVM 1: 1 vCPU; 4 GB RAM; 50 GB; Linux; swap de 2 GB; Docker Compose via EasyPanel.

Adequada para protótipo, primeiros streamers e carga inicial, sujeita a teste real.

Enquanto não houver produção, a KVM 1 hospeda o **ambiente DEV** (`APP_ENV=development`). Quando existir produção, DEV e produção usam banco, segredos e domínios separados; nunca o mesmo banco.

## 34.2. Build e deploy [TÉCNICA]

Não compilar Next/Nest dentro da VPS de 1 vCPU/4 GB.

1. CI (GitHub Actions) roda lint, typecheck e testes (com PostgreSQL real);
2. CI cria as imagens (api, worker, web, bot);
3. push para o GitHub Container Registry (tag = sha do commit);
4. VPS baixa imagens imutáveis (webhook de deploy do EasyPanel);
5. migration one-shot (`prisma migrate deploy`), antes de api e worker;
6. sobe serviços;
7. readiness;
8. proxy libera tráfego.

Migrations: sempre compatíveis com a versão anterior do código durante o deploy (expandir antes, remover depois); nunca editar migration já aplicada; rollback = voltar a imagem anterior. Se o EasyPanel não suportar serviço de execução única, rodar `migrate deploy` no início do container **api** — nunca também no worker.

## 34.3. Serviços e proxy único [TÉCNICA]

```text
web
api
worker
twitch-bot
postgres
migrate      (execução única por deploy)
```

No Protótipo 0.1 sobem apenas `postgres`, `migrate`, `api` e `web`. `worker` e `twitch-bot` entram a partir das fases que os usam (38.2 e 38.3).

**Um único proxy/TLS: o do EasyPanel** (já adotado no projeto). Não subir Caddy junto — dois proxies disputariam as portas 80/443. Caddy só entra se o deploy deixar de usar o EasyPanel.

Apenas o proxy publica portas externamente. PostgreSQL não fica exposto à internet.

## 34.4. Recursos [TÉCNICA]

| Serviço | Estimativa | Limite de heap Node |
|---|---|---|
| Linux + Docker + EasyPanel/proxy | 800 MB – 1 GB | — |
| PostgreSQL | 700 – 900 MB | — |
| api | 350 – 450 MB | 384 MB |
| worker | 200 – 250 MB | 192 MB |
| web (Next standalone) | 200 – 300 MB | 256 MB |
| twitch-bot | 120 – 180 MB | 128 MB |

- Limite de memória por container (evita OOM global).
- `NODE_OPTIONS=--max-old-space-size=<valor>`.
- Logs Docker com rotação: `json-file`, `max-size 10m`, `max-file 3` (sem isso os 50 GB enchem).
- `restart: unless-stopped` (exceto `migrate`).

## 34.5. PostgreSQL [TÉCNICA]

Dois perfis. Começar pelo conservador e só subir quando o teste de carga (36.5) ou as métricas (33.2) pedirem.

| Parâmetro | Perfil 0.1 (web, api, postgres) | Perfil completo (com worker e bot) |
|---|---|---|
| `shared_buffers` | 256MB | 512MB |
| `effective_cache_size` | 768MB | 1536MB |
| `work_mem` | 4MB | 8MB |
| `maintenance_work_mem` | 64MB | 128MB |
| `max_connections` | 20 | 40 |
| Pool da API (Prisma) | 5 | 10 |
| Pool do worker | — (sem worker) | 5 (Prisma) + 3 (pg-boss) |
| Conexão `LISTEN` | 1 (api) | 1 por processo |
| migrate | 1 | 1 |

A API não usa pg-boss (só grava outbox). No perfil 0.1 o dispatcher de `realtime.*`/`chat.*` pode ficar ligado sem consumidores.

Usuário da aplicação: `transaction_timeout = 10s`, `idle_in_transaction_session_timeout = 10s` (22.4). Extensão `btree_gist` habilitada (exclusion constraint de `ActionXpDefinition`).

## 34.6. Variáveis de ambiente [TÉCNICA]

| Serviço | Variáveis |
|---|---|
| api, worker | `DATABASE_URL` (usuário da aplicação), `SESSION_SECRET`, `CSRF_SECRET`, `TOKEN_ENCRYPTION_KEY`, `INTERNAL_API_TOKEN`, `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `TWITCH_BOT_USER_ID`, `APP_URL`, `BOT_INTERNAL_URL`, `ADMIN_TWITCH_IDS`, `GAME_TIMEZONE=America/Sao_Paulo`, `TZ=UTC`, `NODE_ENV`, `LOG_LEVEL`, `SENTRY_DSN` (opcional) |
| migrate | `DATABASE_MIGRATION_URL` (usuário dono do schema) |
| twitch-bot | `API_INTERNAL_URL`, `INTERNAL_API_TOKEN`, `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `TWITCH_BOT_USER_ID`, `TWITCH_EVENTSUB_SECRET` (só se usar Webhook), `NODE_ENV`, `LOG_LEVEL` |
| web | `NODE_ENV`, `APP_ENV` (mesma origem: caminhos relativos `/api/v1`) |
| api (ambiente) | `APP_ENV` = `development` \| `staging` \| `production`; `DEV_LOGIN_ENABLED` (padrão `false`); `DEV_LOGIN_TOKEN` (só DEV/staging) — regras em 32.10 |

Não existe token fixo da Twitch em variável de ambiente: tokens expiram e ficam criptografados no banco.

## 34.7. Domínios e mesma origem [TÉCNICA]

- Gratuito: `farmquest.duckdns.org`. Produção: `farmquest.com.br`.
- Rotas no mesmo domínio: `/` → web; `/api/*` → api; `/socket.io/*` → api; `/admin` → web (exige papel); `/internal` → não roteado.
- Mesma origem elimina CORS e simplifica cookie, `SameSite` e CSRF.
- Alternativa, se o proxy não permitir rota por caminho: `api.<domínio>` com cookie `Domain=<domínio>`, CORS restrito à origem do site e `credentials`.

## 34.8. Escala e quando introduzir Redis [TÉCNICA]

Se a carga mostrar CPU sustentada alta, p95 crescente, backlog de outbox/jobs ou memória em pressão, priorizar upgrade para 2 vCPU / 8 GB antes de micro-otimizações. Depois: separar o PostgreSQL; depois, várias instâncias da API.

Redis só com necessidade real. Gatilho objetivo: **mais de uma instância da API** — a partir daí são necessários adaptador Redis do Socket.IO, rate limiting compartilhado e coordenação do dispatcher do outbox.

Não separar serviços antes da necessidade. Primeiros candidatos: Twitch Bot, worker, Marketplace, realtime.

## 34.9. Desenvolvimento remoto [TÉCNICA]

Padrão do projeto: **GitHub + GitHub Actions + VPS DEV**. Nada precisa ser instalado no computador do desenvolvedor.

1. O código é editado (VS Code com Codex/Claude, ou editor no navegador) e enviado ao GitHub em branch + pull request.
2. **O CI é a validação oficial:** lint, typecheck, testes unitários e de integração com PostgreSQL 17 real (service container do GitHub Actions), incluindo os testes de concorrência e invariantes.
3. Merge na `main` → CI constrói as imagens → GHCR → EasyPanel faz o deploy no ambiente DEV da VPS (34.2).
4. O protótipo é usado pelo domínio DEV, protegido conforme 32.10.

Opcional: **GitHub Codespaces** com `devcontainer` (Node 24 + PostgreSQL 17) para o agente rodar testes e o app pelo navegador antes de abrir o PR. Codespaces acelera o ciclo, mas não substitui o CI: o resultado que vale é o do CI.

Consequência para o agente: sem Codespaces, ele não consegue rodar os testes antes de enviar; cada verificação vira um ciclo de CI. Por isso PRs pequenos, um fluxo por vez.

---

# 35. BACKUP E DISASTER RECOVERY

## 35.1. Protótipo [TÉCNICA]

Backup externo criptografado diário: `pg_dump -Fc` às 04:00 America/Sao_Paulo → criptografia (age ou gpg) → armazenamento externo compatível com S3 (ex.: Backblaze B2, Cloudflare R2). Retenção: 7 diários + 4 semanais + 3 mensais.

## 35.2. Antes do público real [TÉCNICA]

Reduzir o RPO:

- dump externo a cada 6 ou 12 horas;
- retenção definida;
- cópia fora da VPS;
- criptografia;
- teste periódico de restore.

Com crescimento, avaliar WAL/PITR (pgBackRest ou wal-g). Snapshot da VPS é camada extra, nunca a única. Secrets guardados num cofre de senhas, separados do dump.

## 35.3. Restore drill [TÉCNICA]

Antes do lançamento público:

- restaurar o banco em ambiente isolado;
- subir a API contra o restore;
- validar migrations;
- validar saldo/ledger e inventário/ledger;
- registrar duração e procedimento.

Roteiro de recuperação: nova VPS → Docker + EasyPanel → secrets → PostgreSQL vazio → baixar, descriptografar e `pg_restore` → `migrate deploy` → subir api, worker, bot (recria as assinaturas EventSub) e web → DNS → validar health, login, uma colheita de teste e reconciliação. RTO alvo: 2h.

Backup não testado não é considerado recuperação comprovada.

---

# 36. TESTES

## 36.1. Unitários [TÉCNICA]

`packages/game-rules` com cobertura forte para: estado de planta e de animais; XP/nível (fórmula 7.8); modificadores; loot; contribuição com teto (16.4); validações econômicas puras; `canFit`; cooldowns; ranking helpers.

## 36.2. Property-based [TÉCNICA]

- saldo nunca recebe fração;
- inventário nunca fica negativo; `0 <= reserved <= quantity` após qualquer sequência de operações;
- soma dos deltas do `ItemLedger` reproduz `quantity` e `reserved_quantity`;
- caixa entrega de 1 a 4 sorteios e de 1 a 4 unidades para qualquer loot table aceita pelo admin;
- percentuais não causam overflow;
- frações de contribuição nunca perdem unidade enquanto a meta não completa; `accepted <= remaining` sempre;
- progressão de nível é monotônica.

## 36.3. Integração com PostgreSQL real [TÉCNICA]

Não validar concorrência crítica só com mock/in-memory DB.

**Núcleo (herdados)**

1. duas colheitas simultâneas;
2. múltiplas compras simultâneas do mesmo anúncio;
3. criação concorrente da sexta fazenda;
4. dois anúncios simultâneos a partir de fazendas diferentes do mesmo usuário — resultado: apenas um ativo;
5. participação concorrente que completa evento de 30 jogadores;
6. abertura duplicada da mesma Caixa do Fazendeiro com mesma idempotency key;
7. retry de request econômica sem duplicar ledger;
8. `message_id` Twitch duplicado;
9. jogador `REMOVED` tentando acessar/jogar;
10. Support tentando executar ação reservada a Admin;
11. restart da API com Outbox pendente;
12. worker morto durante conclusão/recompensa e posterior retry;
13. reconciliação detectando ledger divergente;
14. retirada/relistagem do Marketplace respeitando cooldown global;
15. colheita pelo chat e pelo site em canteiros diferentes da mesma fazenda ao mesmo tempo (XP e inventário corretos);
16. compra de anúncio + retirada + colheita + conclusão de meta em paralelo, sem deadlock;
17. compra de anúncio com inventário do comprador cheio: nada muda;
18. abrir caixa com inventário cheio: caixa não é consumida, nada é sorteado;
19. queda entre o recebimento do comando Twitch e o efeito: a reentrega é processada;
20. job do worker gera aviso `realtime.*` e a API entrega ao navegador.

**Marketplace (v1.3.1)**

21. primeiro anúncio de um usuário criado em duas requisições simultâneas, inclusive para usuário vindo do backfill de `MarketplaceSellerState`: um anúncio, uma linha de estado, nenhum erro de integridade;
22. reservar 100 itens: `quantity` não muda, `reserved_quantity` +100, ledger `(0, +100)` reconcilia;
23. venda P2P: vendedor `quantity −100` e `reserved −100`; comprador `quantity +100`; exatamente uma transferência de moedas e de itens; reconciliação de `quantity` e `reserved` fecha para os dois.

**Meta comunitária (v1.3.1)**

24. meta em 998/1000 e duas colheitas simultâneas com `candidate = 5`: `current_quantity = 1000`, soma de `accepted = 2`, excedente com os jogadores, uma única conclusão, um único boost, nenhuma recompensa duplicada;
25. job `goal.complete` executado duas vezes (e em paralelo): um `RewardGrant` por fazenda, um boost;
26. meta expira: `FAILED` → `CLOSED` → nova `COLLECTING`; em nenhum instante duas metas abertas;
27. colheita depois de `ends_at` com o sweep ainda não executado: contribuição 0;
28. `CHECK current_quantity <= target_quantity` rejeita escrita direta que ultrapasse o alvo.

**Recompensas (v1.3.1)**

29. o mesmo `RewardGrant` processado duas vezes (dois workers): uma concessão, um `ItemLedger REWARD`;
30. `internal.event.completed` reenviado e `event.complete` repetido: sem recompensa duplicada;
31. jogador removido depois do snapshot (12:00 participa, 12:01 conclui, 12:02 é removido, 12:04 entrega): o resultado segue o `RewardEligibilitySnapshot` materializado às 12:01; o worker não recalcula;
32. inventário cheio na entrega: `AWAITING_SPACE`; resgate posterior entrega uma vez.

**Caixa (v1.3.1)**

33. abrir caixa e repetir a mesma idempotency key depois de expirado o `IdempotencyRecord` HTTP: mesmo resultado, nenhum sorteio novo, nenhum item extra, nenhuma caixa consumida.

**Outbox (v1.3.1)**

34. processo morre depois do commit da conclusão de meta/evento e antes de qualquer operação externa: a mensagem `internal.*` permanece e o processamento é recuperado; com a mensagem apagada à força, o sweep recupera pelo estado de domínio;
35. dispatcher processa a mesma mensagem `internal.*` duas vezes: consequência única;
36. evento criado e processo morto antes de qualquer agendamento: `events.sweep` encerra o evento em `ends_at` e um novo evento pode começar.

**XP (v1.3.1)**

37. uma colheita de plantios com qualidades diferentes: XP = Σ `floor(xp_reward × seed_count × xp_multiplier_bps / 10000)`, sem XP base duplicado, multiplicador aplicado uma vez por plantio, `HARVEST_BONUS` ausente no seed = 0; `ProgressLedger` confere com `Farm.xp`.

**Locks (v1.3.1)**

38. `goal.complete` inserindo grants para fazendas que estão sendo colhidas no mesmo instante: sem deadlock (valida `FOR NO KEY UPDATE`).

**Sessão (v1.3.1)**

39. token CSRF de uma sessão rejeitado em outra; token invalidado no logout e na rotação.

**Ambiente e dev-login (v1.3.4)**

40. com `DEV_LOGIN_ENABLED=false`, `POST /api/v1/auth/dev-login` responde 404;
41. com `APP_ENV=production` e `DEV_LOGIN_ENABLED=true`, a API não inicia; com dev-login ligado e `DEV_LOGIN_TOKEN` ausente ou curto, a API não inicia;
42. token errado → 401 sem sessão criada; tentativas acima do limite → 429; todo uso gera `AuditLog`;
43. sessão criada pelo dev-login passa por CSRF, idempotência e política de acesso como qualquer outra.

Invariantes checadas ao fim de **cada** teste de integração:

```text
farm.coins >= 0 e SUM(CoinLedger.delta) = coins
SUM(ItemLedger.quantity_delta) = quantity e SUM(ItemLedger.reserved_delta) = reserved_quantity (por chave)
0 <= reserved_quantity <= quantity
SUM(ProgressLedger.delta) = xp / collector_xp / contribution_xp
no máximo 1 plantio ativo por canteiro
no máximo 1 anúncio ACTIVE por usuário; reserved do vendedor = 100 × anúncios ativos
no máximo 1 meta aberta por comunidade; current_quantity <= target_quantity
no máximo 1 evento ACTIVE por comunidade; participant_count = COUNT(participantes)
no máximo 1 RewardGrant por (farm, source_type, source_id, reward_key)
no máximo 1 boost por (community, source, source_ref, definição)
```

## 36.4. Bot [TÉCNICA]

Separadamente: ingestão de comandos; autenticação das rotas internas; dedupe; agregação de respostas; rate limiting; comportamento após reconnect.

## 36.5. Carga [TÉCNICA]

Metas `[FECHADA · v1.0]`: esperado 3 streamers e ~10 usuários simultâneos; projeto para 50 simultâneos; teste de carga com 100; teste Twitch com 500 comandos/minuto por streamer.

Cenários separados: HTTP/web; comandos Twitch (simulador chamando `/internal/v1/twitch/commands` com `message_id` falsos — nunca carga no chat real); Marketplace concorrente; Socket.IO; jobs; meta comunitária sob colheitas simultâneas da mesma comunidade (contenção em R7). Meta inicial de entrada: p95 < 300 ms por comando.

Não usar apenas um teste genérico para declarar capacidade.

E2E mínimo (Playwright): login, plantar, colher.

---

# 37. FLUXOS CRÍTICOS DE REFERÊNCIA

Todos seguem o molde 22.4 e a ordem de locks 22.3. "lock" = `FOR NO KEY UPDATE`.

## 37.1. Criar usuário (callback OAuth)

```text
callback -> validar state/PKCE -> transaction
-> INSERT User / TwitchIdentity ON CONFLICT (twitch_user_id) -> reler existente
-> INSERT MarketplaceSellerState(user_id, next_listing_at = NULL) ON CONFLICT DO NOTHING
-> criar UserSession -> commit -> cookie
```

## 37.2. Criar fazenda
```text
request -> auth -> idempotency (R0) -> transaction
-> lock User (R2)
-> contar fazendas com status <> SOLD (< 5)
-> validar streamer APPROVED
-> INSERT Farm (community_id do streamer) + 3 Plots + TractorUsage
-> INSERT CommunityMembership ACTIVE + CommunityMembershipHistory
-> itens e moedas iniciais + ItemLedger + CoinLedger (INITIAL_GRANT)
-> Outbox -> commit
```

## 37.3. Plantar

```text
request -> auth -> idempotency -> transaction
-> lock Farm (R5) -> política de acesso (6.5)
-> validar canteiro(s)/cultura/nível/sementes disponíveis
-> consumir sementes + ItemLedger (PLANT)
-> criar PlantedCrop (grows_at/rots_at congelados)
-> aplicar e consumir bônus do trator (11.2)
-> XP de plantio + ProgressLedger -> nível -> stats
-> Outbox -> commit -> responder
```

## 37.4. Colher (tudo)

```text
request/comando -> auth/contexto -> idempotency ou dedupe Twitch -> transaction
-> lock Farm (R5) -> política de acesso
-> validar now >= next_harvest_at
-> plantios ativos com grows_at <= now, em ordem de canteiro
-> para cada um: verificar espaço (pior caso, sem desconto) -> se não couber, parar (PD-08)
-> sortear qualidade dos que cabem (ROTTEN se now >= rots_at; tractor_weight se bônus)
-> se meta aplicável: lock CommunityGoal (R7) e reler (16.5)
-> para cada plantio, em ordem:
     UPDATE planted_crop SET harvested_at = now ... WHERE harvested_at IS NULL
     accepted (16.4)
     ItemLedger HARVEST (+integral) e GOAL_CONTRIBUTION (−accepted)
     contribuição + FarmContributionProgress + ProgressLedger
-> UPDATE community_goal (+Σaccepted); se = alvo: COMPLETED + boost (starts_at = completed_at) + Outbox internal.goal.completed
-> XP de colheita (7.8) + ProgressLedger -> nível(is) -> stats
-> next_harvest_at = now + cooldown_final
-> Outbox realtime/chat -> commit
```

## 37.5. Criar anúncio

```text
request -> auth -> idempotency -> transaction
-> lock MarketplaceSellerState (R3)   (linha criada com o User; fallback: INSERT ON CONFLICT DO NOTHING e então lock)
-> validar next_listing_at IS NULL ou <= now
-> validar nenhum listing ACTIVE do usuário
-> lock Farm de origem (R5) -> política de acesso
-> validar item p2p_tradeable, qualidade != ROTTEN, disponível (quantity − reserved) >= 100
-> reserved_quantity += 100 + ItemLedger P2P_RESERVE (0, +100)
-> criar listing ACTIVE (quantity 100, withdraw_available_at congelado)
-> next_listing_at (PD-17)
-> aviso "Produto com valor acima da média" (PD-16) na resposta
-> Outbox -> commit
```

## 37.6. Comprar anúncio

```text
request -> auth -> idempotency -> transaction
-> lock Listing (R1) -> validar ACTIVE
-> validar buyer.user_id != seller_user_id e buyer_farm pertence ao comprador
-> (lock SellerState do vendedor — só se PD-17 mudar para "na venda")
-> lock Farms comprador e vendedor em ordem crescente de id (R5)
-> política de acesso da fazenda compradora; espaço para 100
-> total = unit_price × 100 (BigInt)
-> débito condicional do comprador + CoinLedger P2P_BUY
-> crédito do vendedor + CoinLedger P2P_SELL
-> vendedor: ItemLedger P2P_SELL (−100, −100)
-> comprador: ItemLedger P2P_BUY (+100, 0)
-> listing SOLD (buyer_user_id, buyer_farm_id, sold_at)
-> stats (XP de venda conforme PD-19)
-> Outbox -> commit
```

A fazenda vendedora não passa pela política de acesso (a oferta já foi feita); comportamento quando ela deixa de ser jogável: `[PENDENTE PD-27]` (19.8).

## 37.7. Retirar anúncio

```text
request -> auth -> idempotency -> transaction
-> lock Listing (R1) -> validar ACTIVE e dono
-> lock SellerState (R3)
-> validar now >= withdraw_available_at
-> lock Farm de origem (R5) -> política de acesso (PD-27)
-> ItemLedger P2P_RELEASE (0, −100)
-> listing WITHDRAWN
-> Outbox -> commit
```

## 37.8. Abrir Caixa do Fazendeiro

```text
request -> auth -> idempotency -> transaction
-> lock Farm (R5) -> política de acesso
-> RewardBoxOpening por (farm, key)? -> devolver resultado persistido
-> validar caixa disponível >= 1
-> espaço para o pior caso com a caixa removida (18.4)
-> ItemLedger BOX_OPEN (−1)
-> loot table/versão -> sortear no servidor (18.2)
-> ItemLedger BOX_LOOT (+)
-> INSERT RewardBoxOpening
-> Outbox -> commit -> resultado
```

## 37.9. Participar de evento coletivo

```text
comando/request -> auth/contexto -> idempotency ou dedupe -> transaction
-> lock Farm (R5) -> política de acesso
-> lock CommunityEvent (R6) -> validar ACTIVE, outcome IS NULL e now < ends_at
-> inserir participant (UNIQUE(event, farm))
-> participant_count + 1
-> XP de evento (provisório: aqui) + ProgressLedger
-> se participant_count = target: outcome SUCCEEDED, completed_at, (PD-30) ENDED
     + boost da definição, se houver + Outbox internal.event.completed
-> Outbox realtime/chat -> commit
```

## 37.10. Conclusão de meta / evento e entrega

```text
goal.complete / event.complete (R7 ou R6, uma linha):
  status/marca confere? -> snapshot (18.8) -> RewardGrant ON CONFLICT DO NOTHING
  -> garantir boost ON CONFLICT DO NOTHING (já criado na conclusão)
  -> status/marca -> Outbox internal.rewards.process + realtime/chat -> commit

rewards.process (por grant, R5):
  lock Farm -> grant PENDING? -> cabe? GRANTED + ItemLedger REWARD : AWAITING_SPACE -> Outbox -> commit
```

## 37.11. Comando do chat

```text
Twitch EventSub -> bot: parser/normalização
-> POST /internal/v1/twitch/commands (token de serviço; message_id)
-> API: localizar vínculo pelo twitch_user_id
     sem vínculo -> TWITCH_ACCOUNT_REQUIRED (bot responde com link) — nada é criado
-> validar streamer, chat_game_active e fazenda do jogador naquele canal
-> executar o caso de uso (37.3, 37.4, 37.9...) com o dedupe na mesma transação
-> resposta com código -> Outbox chat.* -> API entrega ao bot -> fila agregada -> Twitch
```

---

# 38. FASES DE IMPLEMENTAÇÃO

## 38.0. Escopo do MVP 1.0 [FECHADA · v1.0]

O MVP 1.0 terá: Login Twitch; fazendas por streamer; até 5 fazendas; plantio; colheita; qualidade; apodrecido; inventário; níveis; XP; trator; coleção; animais; mercado; P2P; comunidade; metas; benefícios; boost; eventos; ranking; bot Twitch; admin; realtime.

A implementação começa pelo Protótipo 0.1, não pelo MVP inteiro.

## 38.1. Protótipo 0.1

Objetivo: provar núcleo econômico e concorrência.

- monorepo (`domain`, `game-rules`, `contracts`, `database`);
- auth mínima: login de desenvolvimento protegido (32.10) — sem Twitch OAuth no 0.1;
- PostgreSQL/Prisma 7 fixado; migrations com constraints da seção 30;
- User (com `MarketplaceSellerState`), Streamer e Community de fixture, Farm, Membership; limite de 5 fazendas;
- canteiros, plantio, colheita, qualidade, item apodrecido e descarte;
- inventário e espaço;
- loja e venda rápida com `base_price` (provisório PD-06; necessário para fechar o ciclo plantar → colher → vender → comprar sementes);
- XP (fórmula 7.8) e níveis;
- `CoinLedger`, `ItemLedger` (com `quantity_delta`/`reserved_delta`), `ProgressLedger`, idempotência HTTP, Outbox (tabela e dispatcher; sem consumidores `internal.*` ainda);
- política de acesso (6.5) e lock `FOR NO KEY UPDATE`;
- testes de concorrência e invariantes (36.3: 1, 3, 7, 13, 15, 37 e invariantes aplicáveis);
- CI (GitHub Actions) como validação oficial; deploy no ambiente DEV da VPS; Codespaces opcional (34.9). Sem Docker local.
- contratos Zod/OpenAPI do 0.1 (28.14), `RandomSource` (8.2), definições econômicas versionadas (27.3), roles/constraints do banco (30) e modelo temporal `linearized_at` (2.10) entram desde a base técnica.

Pendências que tocam o 0.1 (todas com provisório isolado ou fixture): PD-06, PD-07, PD-08, PD-09, PD-19, PD-23. Nenhuma pendência bloqueia o 0.1.

Não esperar balanceamento final para começar.

## 38.2. Protótipo 0.2

- identidade Twitch e sessão (CSRF ligado à sessão — 32.3);
- aprovação de streamer e onboarding do bot (`channel:bot`, moderador);
- `$abrirfazenda` correto;
- bot → API; dedupe Twitch;
- `$plantar`, `$colher`;
- realtime web (dispatcher na API);
- fila/agregação de chat.

## 38.3. Alpha econômica

- worker com pg-boss, ponte outbox `internal.*` → jobs e sweeps (24, 25); preço diário;
- animais (porco com valores fechados);
- Marketplace com cooldown global, reserva no ledger (21.3) e compra concorrente;
- rankings iniciais;
- reconciliação.

## 38.4. Alpha comunitária

- memberships; expulsão/readmissão;
- benefícios permanentes; boost de 2 dias;
- meta comunitária com teto no alvo, conclusão via outbox, `RewardGrant` e snapshot (PD-25) e envio de mercadoria;
- contribution progress; collector progress; títulos;
- trator e colecionáveis.

## 38.5. Eventos

- eventos coletivos; evento Lobo; participantes; meta 30;
- Caixa do Fazendeiro (`RewardBoxOpening`, compliance 18.5); loot tables.

## 38.6. Hardening do MVP 1.0

- segurança completa; admin/support; auditoria;
- observabilidade; k6/carga;
- backup externo; restore drill; runbooks;
- limites Twitch verificados contra a documentação oficial vigente;
- revisão final de permissões e invariantes;
- política de privacidade e termos publicados;
- pendências da seção 41 decididas ou com a funcionalidade desligada.

---

# 39. DEFINITION OF DONE E REGRAS PARA O AGENTE

## 39.1. Definition of Done para feature econômica

Uma feature que altera moeda, item, XP, recompensa, reserva ou listing só está pronta quando:

1. regra está em domínio/application layer (`packages/domain` + `game-rules`) e não no controller;
2. input possui validação (Zod);
3. autorização está explícita (papel e dono);
4. política de acesso da fazenda aplicada quando é ação de jogador (6.5);
5. idempotência de requisição implementada (23.1/23.2) e, para consequências permanentes, idempotência de domínio (23.3);
6. transação cobre todos os efeitos atômicos;
7. lock `FOR NO KEY UPDATE` na ordem da seção 22.3;
8. `UPDATE` condicional para saldo, estoque e status;
9. ledger gravado (`CoinLedger`, `ItemLedger` com `quantity_delta`/`reserved_delta`, `ProgressLedger`);
10. constraint de banco protege a invariante crítica (seção 30), com migration SQL quando o Prisma não expressar;
11. outbox gravado na mesma transação quando houver efeito externo; consequência obrigatória assíncrona só via `internal.*` (24.1);
12. existe teste de sucesso;
13. existe teste de regra inválida;
14. existe teste de replay/retry (mesma key, mesma mensagem, job repetido);
15. existe teste concorrente com PostgreSQL real;
16. invariantes da seção 36.3 checadas ao fim dos testes;
17. audit log quando a ação é de ADMIN, SUPPORT ou STREAMER;
18. logs não vazam segredo;
19. erros possuem código estável (seção 31);
20. documentação/contrato API foi atualizado.

## 39.2. Ordem de trabalho do agente (Codex/Claude no VS Code)

1. ler esta v1.3.4 integralmente;
2. localizar código/schema/testes relacionados;
3. listar impactos antes de alterar múltiplos módulos;
4. preservar regras `[FECHADA]`;
5. evitar refatoração não relacionada;
6. escrever migration antes/de forma coordenada com o código que depende da nova invariante;
7. adicionar testes de regressão para cada correção;
8. executar lint/typecheck/tests no Codespaces quando disponível; o resultado que vale é o do CI (34.9);
9. reportar qualquer divergência entre implementação existente e v1.3.4;
10. não "resolver" pendência de produto por suposição.

## 39.3. Política de alteração

Se o agente achar uma alternativa tecnicamente melhor que mude regra de produto:

- não aplicar;
- registrar sugestão separada (seção 42);
- manter a implementação conforme a v1.3.4.

Pendência com **Provisório**: implementar isolado e marcado com `PENDENTE PD-xx`. O agente **não pode** transformar um provisório em regra definitiva (ex.: remover o marcador, espalhar a lógica fora da função isolada, escrever teste que trate o provisório como regra fechada sem o marcador). Pendência com **Bloqueia**: responder `PENDING_PRODUCT_DECISION` (501) ou não expor a rota.

---

# 40. DECISÕES QUE NÃO DEVEM SER REABERTAS

O agente de implementação não deve propor automaticamente alteração das seguintes regras.

Da v1.2:

- backend é autoridade;
- máximo de 5 fazendas por usuário;
- `$abrirfazenda` não cria espectador;
- streamer precisa estar aprovado;
- cargos PLAYER/SUPPORT/ADMIN;
- jogador removido fica bloqueado naquela comunidade;
- Marketplace vende lote de 100;
- um anúncio ativo por jogador;
- cooldown global por jogador;
- anúncio não expira automaticamente;
- preço acima da média gera aviso e não hard cap 300%;
- apodrecido entra no inventário e só descarta;
- porco 30/15/100 e máximo inicial 2;
- benefícios permanentes separados de boost de 2 dias;
- evento Lobo suporta 30 participantes;
- Caixa do Fazendeiro entrega 1 a 4 itens;
- rankings incluem Nível/Colecionador/Contribuição/Dinheiro;
- título Colecionador existe;
- XP inclui plantar/colher/vender/eventos;
- curva de XP cumulativa;
- economia usa ledger;
- operações críticas são idempotentes e transacionais;
- Outbox é transacional;
- Twitch bot não contém regras econômicas.

Da v1.0 (não contraditas depois):

- uma fazenda por jogador por streamer; comunidade por streamer;
- site e Twitch usam as mesmas regras;
- fazenda inicial: 3 canteiros, 3 sementes, 100 moedas;
- `$plantar` preenche o máximo possível; `$colher` colhe tudo que está pronto ou podre;
- apodrece 24h depois de ficar pronto;
- cooldown de colheita por nível, com descontos e mínimo técnico de 5s;
- qualidades COMMON, GOOD, EXCELLENT, EXTRAORDINARY, ROTTEN;
- trator 1 vez a cada 24h por fazenda, bônus no próximo plantio, colecionáveis em coleção separada;
- galinha 1 ração → até 3 ovos, 1 a cada 2h; vaca 1 feno → 3h → 1 leite; porco 2 alimentações com 24h entre elas;
- cavalo 20.000 moedas, 12h → 10h no cooldown do anúncio e na retirada;
- mercado global com preço diário; venda rápida com taxa de 2%;
- Marketplace: mesmo item, mesma qualidade, taxa 0%, itens reservados, comprador diferente do vendedor mesmo com fazendas diferentes;
- meta comunitária com porcentagem da colheita, frações sem perda, caixa automática, envio de mercadoria pelo streamer, falha recomeça;
- no máximo 1 evento ativo por comunidade;
- mensagens do bot configuráveis.

Se o agente detectar conflito entre código existente e esta seção, deve reportar o conflito e corrigir o código, não a regra.

---

# 41. PENDÊNCIAS DE PRODUTO — LISTA MESTRE

Esta é a única lista de pendências. O texto das seções apenas referencia o ID.

| ID | Tema | Seções | Tratamento até decidir | Afeta 0.1? |
|---|---|---|---|---|
| PD-01 | Caminho do arquivo da especificação funcional aprovada | 0.2 | Informar no documento; até lá, só vale este documento | Não |
| PD-02 | Venda de fazenda: fórmula, destino do valor e tratamento de `RewardGrant` pendentes da fazenda | 6.6 | **Bloqueia** (rota responde 501) | Não |
| PD-03 | Efeito da suspensão do streamer sobre fazendas, metas e eventos | 5.3, 6.5, 16.2 | Provisório: acesso bloqueado por cálculo (nada gravado na fazenda); jobs não iniciam metas/eventos novos; consequências já registradas seguem | Não |
| PD-04 | Fazenda com membership `REMOVED` conta no limite de 5? | 6.2 | Provisório: conta | Não |
| PD-05 | Existe comando de chat para fechar o jogo no canal? | 5.2 | Provisório: fechamento só pelo painel | Não |
| PD-06 | Fonte de sementes, ração e feno | 10.1 | Provisório: loja NPC | **Sim** (provisório) |
| PD-07 | Colheita no site: por canteiro, tudo ou ambos; cooldown | 7.6 | Provisório: ambas as rotas, mesmo cooldown | **Sim** (provisório) |
| PD-08 | Colheita com inventário cheio | 7.6 | Provisório: colhe em ordem enquanto couber (checagem antes do sorteio) | **Sim** (provisório) |
| PD-09 | Qualidade sorteada por plantio ou por unidade | 7.6 | Provisório: por plantio | **Sim** (provisório) |
| PD-10 | Bônus do trator em plantio de vários canteiros | 11.2 | Provisório: todos os canteiros do comando | Não |
| PD-11 | Recompensa automática com inventário cheio | 18.6, 18.7 | Provisório: `RewardGrant AWAITING_SPACE` + resgate | Não |
| PD-12 | Contribuição da meta: descontada ou adicional | 16.4 | Provisório: descontada (só `accepted`) | Não |
| PD-13 | Como a próxima meta é escolhida | 16.2 | Provisório: sequência cíclica de templates | Não |
| PD-14 | Live cai durante evento `live_only` | 17.4 | Provisório: continua até `ends_at` | Não |
| PD-15 | Escopo do Marketplace: global ou por comunidade | 19.8 | Provisório: global com filtro opcional | Não |
| PD-16 | Definição de "média" para o aviso de preço | 19.7 | Provisório: preço do dia × qualidade × 100 | Não |
| PD-17 | Início do cooldown global do anúncio | 19.5 | Provisório: na criação | Não |
| PD-18 | Cavalo × cooldown global por usuário | 19.5 | Provisório: cavalo da fazenda de origem | Não |
| PD-19 | "Vender" que concede XP: venda rápida, P2P, venda de animal? | 13.1 | Provisório: só venda rápida | **Sim** (provisório) |
| PD-20 | Ranking por fazenda ou por usuário | 20.3 | Provisório: por fazenda | Não |
| PD-21 | Virada da semana do ranking | 20.3 | Provisório: segunda 00:00 America/Sao_Paulo | Não |
| PD-22 | Fontes/valores de XP de colecionador e contribuição; critério do título | 14 | Fixture provisória | Não |
| PD-23 | Valores de balanceamento (lista abaixo) | várias | Fixture provisória no seed | **Sim** (fixtures) |
| PD-24 | Conteúdo do módulo de missões | 13.1 | Fora do MVP | Não |
| PD-25 | Momento em que a elegibilidade da recompensa de meta/evento é congelada, e efeito de remoção/venda/suspensão entre esse momento e a entrega | 18.8 | Provisório: snapshot materializado na transação da conclusão (`snapshot_at = linearized_at`); mudanças posteriores não revogam | Não |
| PD-26 | Meta concluída cuja mercadoria nunca é enviada: há prazo ou alternativa? | 16.2 | Provisório: sem prazo; fica em `WAITING_SHIPMENT` | Não |
| PD-27 | Anúncio ativo de fazenda que deixa de ser jogável (REMOVED, streamer suspenso): segue comprável? pode ser retirado? | 19.8, 37.6, 37.7 | Provisório: segue comprável; retirada bloqueada até a fazenda voltar a ser jogável | Não |
| PD-28 | `$abrirfazenda` ativa só o chat ou também o jogo no site daquele streamer? | 5.2, 26.2 | Provisório: só o chat; criar fazenda no site exige streamer `APPROVED` | Não |
| PD-29 | Procedimentos do SUPPORT (quando pode readmitir; vínculo/desvínculo) | 4.3, 28.12 | Provisório: rotas de SUPPORT com efeito respondem 501; consultas liberadas | Não |
| PD-30 | Evento participativo: termina ao atingir o alvo ou segue até `ends_at`? Falha tem consequência? | 17.3 | Provisório: termina na conclusão; falha sem consequência além de não recompensar | Não |

PD-23 — valores ainda não definidos: semente inicial; preços de sementes, itens e ofertas da loja; tempos de cada cultura; `yield_per_seed`; `xp_reward` por cultura e XP por ação (`ActionXpDefinition`); curva de níveis além dos exemplos fechados; liberação de canteiros e expansão de inventário (como e quanto custa); `stack_limit` e `inventory_slots` iniciais; pesos de qualidade, do trator e de colecionáveis; chance de colecionável; loot tables e distribuição de sorteios; preço e limite de galinhas e vacas; alimento do porco; faixa de variação do mercado; benefícios e boosts além do boost de meta; alvo, duração e porcentagem das metas; parâmetros de eventos além do Lobo; XP de evento (valor e momento); balanceamento pós-MVP.

**Proibição:** ausência de valor final não autoriza o agente a transformar uma regra fechada em outra regra. Exemplo: se o preço de uma semente estiver pendente, o agente pode usar fixture claramente provisória; não pode alterar o lote do Marketplace de 100 para 50.

## 41.1. Não são pendências (confirmado)

Estas regras estão fechadas e não podem reaparecer como pendência:

- porco: filhote 30, venda prematura 15, adulto 100;
- máximo inicial de 2 porcos;
- lote do Marketplace exatamente 100;
- anúncio sem expiração automática;
- apodrecido: entra no inventário e só pode ser descartado;
- boost de meta: 2 dias;
- `$abrirfazenda` exclusivo do streamer aprovado;
- espectador sem conta não nasce pelo chat;
- SUPPORT separado de ADMIN;
- jogador `REMOVED` sem acesso jogável, progresso preservado;
- curva de XP cumulativa (exemplo 100 / +200 = 300 no nível 3);
- título Colecionador;
- evento coletivo do Lobo com 30 jogadores;
- Caixa do Fazendeiro com 1 a 4 itens;
- limite de 5 fazendas por usuário; um anúncio ativo e cooldown global por usuário.


## 41.2. Manifesto de fixtures provisórias — Protótipo 0.1 [TÉCNICA · v1.3.4]

Arquivo recomendado:

```text
packages/database/seed/fixtures/prototype-0.1.ts
```

Todo valor provisório carrega metadados equivalentes a:

```text
PROVISIONAL = true
pending = PD-xx
```

Nenhum valor desta subseção vira regra `[FECHADA]`.

### Identidade DEV

```text
1 User fixture: Coda DEV
1 Streamer fixture: APPROVED
1 Community fixture
1 Farm fixture ACTIVE
1 Membership ACTIVE
```

IDs podem ser determinísticos no seed. Nenhum segredo fica no seed.

### Fazenda

```text
initial_coins        = 100        FECHADA
initial_plots        = 3          FECHADA
initial_seeds        = 3          FECHADA
starter_seed         = corn_seed  PD-23
inventory_slots      = 20         PD-23
stack_limit          = 200        PD-23
```

### Milho de protótipo

```text
crop key             = corn
seed item            = corn_seed
product item         = corn
growth_seconds       = 60         PD-23
yield_per_seed       = 1          PD-23
harvest xp/seed      = 5          PD-23
rot_after_seconds    = 86400      FECHADA
```

`60s` é deliberadamente curto para teste e não é balanceamento final.

### Loja NPC — PD-06

```text
corn_seed buy_price  = 5 moedas   PD-23
min_level            = 1
enabled              = true
```

Semente não é vendável por venda rápida.

### Venda rápida

```text
corn base_price      = 10 moedas  PD-23
quick_sell_fee_bps   = 200        FECHADA
```

No 0.1, sem worker de preço diário, usa `base_price`.

### Qualidades — PD-09 / PD-23

Sorteio provisório por plantio:

| Qualidade | weight | sell bps | XP bps |
|---|---:|---:|---:|
| COMMON | 7000 | 10000 | 10000 |
| GOOD | 2500 | 12500 | 11000 |
| EXCELLENT | 490 | 15000 | 12500 |
| EXTRAORDINARY | 10 | 30000 | 20000 |
| ROTTEN | não sorteável | 0 | 0 |
| NONE | não sorteável | — | — |

### XP / níveis — PD-23

```text
PLANT             = 5 XP por ação      provisório
NPC_SELL          = 2 XP por ação      provisório
HARVEST_BONUS     = ausente / 0
```

| Nível | XP total | Cooldown |
|---|---:|---:|
| 1 | 0 | 60s |
| 2 | 100 | 55s |
| 3 | 300 | 50s |
| 4 | 650 | 45s |
| 5 | 1200 | 40s |

A interpretação cumulativa 100 / +200 = 300 no nível 3 continua `[FECHADA]`; níveis 4–5 e cooldowns são fixture.

### Provisórios comportamentais do 0.1

```text
PD-06 loja NPC                         ATIVO
PD-07 colher plot e colher tudo        ATIVO; mesmo cooldown
PD-08 inventário cheio                 colhe em ordem enquanto couber
PD-09 qualidade                        1 sorteio por plantio
PD-19 XP de venda                      somente quick sell
PD-23 valores                          este manifesto
```

### Infra do 0.1

```text
web         ON
api         ON
postgres    ON
worker      OFF
twitch-bot  OFF
```

Outbox existe; `internal.*` permanece sem consumidor enquanto o worker estiver desligado.

---

# 42. SUGESTÕES REGISTRADAS (NÃO APLICADAS)

Registradas conforme a política 39.3. Nenhuma está implementada; dependem de decisão do produto.

| ID | Sugestão | Motivo |
|---|---|---|
| S-01 | Nível mínimo para usar o Marketplace | Com taxa 0% e sem teto de preço, contas alternativas podem transferir riqueza entre si |
| S-02 | Relatório no admin de pares comprador/vendedor recorrentes, a partir do ledger | Detectar transferências entre contas do mesmo jogador (monitoramento, não bloqueio) |
| S-03 | Limite de compras P2P entre o mesmo par de usuários por período | Mesmo motivo de S-01 |

---

# 43. HISTÓRICO

## 43.1. v1.2 → v1.3

Nenhuma regra `[FECHADA]` foi alterada.

| ID | Mudança | Motivo |
|---|---|---|
| C-01 | Documento único e autossuficiente | A v1.2 substituía a v1.1 só "onde houvesse divergência" |
| C-02 | Regras de produto da v1.0 não contraditas incorporadas como `[FECHADA · v1.0]` | Estavam só na v1.0 |
| C-03 | Padrões provisórios da v1.1 viraram `[PENDENTE PD-xx]` com provisório explícito | Não eram regra aprovada |
| C-04 | Socket.IO e chat entregues pela API; outbox por tópico | Worker não alcança conexões dos navegadores |
| C-05 | Ordem global de locks única; recompensas por fazenda | Ciclos de lock na v1.2 |
| C-06 | Colheita trava a fazenda | Canteiros da mesma fazenda disputam XP e inventário |
| C-07 | Prisma fixado em 7.x | `latest` do npm é o Prisma 8 RC |
| C-08 | Espaço verificado antes de qualquer efeito | Compra perdida e manipulação de sorteio |
| C-09 | Comprador ≠ vendedor restaurado como regra v1.0 | A v1.2 deixou condicional |
| C-10 | "Venda prematura" = antes de `ADULT` | Leitura direta |
| C-11 | Dedupe Twitch na mesma transação | Queda entre dedupe e efeito perderia o comando |
| C-12 | Proxy único (EasyPanel) | Dois proxies disputariam 80/443 |
| C-13 | `packages/domain` compartilhado | Evitar duplicação de regras |
| C-14 | PD-01 a PD-24 | Pontos em aberto encontrados |
| C-15 | Lote do Marketplace como constante + `CHECK` | Evitar alteração acidental |
| C-16 | Mensagens de chat best effort documentadas | Exigência da v1.2 |

As mudanças v1.3 → v1.3.1 estão na seção 46.

## 43.2. ADRs vigentes

| ADR | Decisão |
|---|---|
| ADR-001 | Monólito modular em vez de microsserviços |
| ADR-002 | PostgreSQL como fonte da verdade |
| ADR-003 | Backend como autoridade |
| ADR-004 | Twitch Bot sem lógica de negócio e sem banco |
| ADR-005 | Sem Redis inicialmente (gatilho: mais de uma instância da API) |
| ADR-006 | Timers como timestamps; estado derivado; prazos congelados na criação; consequências datadas pelo instante do fato |
| ADR-007 | Fazenda isolada por jogador + streamer (índice único parcial) |
| ADR-008 | Lock `FOR NO KEY UPDATE` da fazenda em toda ação; ordem global de locks R0–R7 |
| ADR-009 | Outbox transacional com `LISTEN/NOTIFY` + polling; entrega por tópico; `internal.*` é a única ponte para consequências obrigatórias |
| ADR-010 | Jobs com pg-boss; sweeps a partir do estado de domínio; nenhum cron no processo da API |
| ADR-011 | Regras de negócio em `packages/domain`, usadas por api e worker |
| ADR-012 | Dinheiro em inteiros e basis points; ledgers append-only (`CoinLedger`, `ItemLedger` com reserva, `ProgressLedger`) |
| ADR-013 | Twitch via EventSub + Send Chat Message; limites em configuração |
| ADR-014 | Sessão opaca no servidor; CSRF derivado da sessão; web e API na mesma origem |
| ADR-015 | Prisma 7.x fixado |
| ADR-016 | Mensagens de chat best effort, agregadas; site é o feedback completo |
| ADR-017 | Idempotência em duas camadas: requisição (TTL) e domínio (permanente, por constraint) |
| ADR-018 | Recompensas automáticas como `RewardGrant` com snapshot de elegibilidade; worker só entrega |
| ADR-019 | Desenvolvimento remoto: GitHub + GitHub Actions + VPS DEV (Codespaces opcional); CI é a validação oficial |
| ADR-020 | Login de desenvolvimento só com `APP_ENV` diferente de produção, desligado por padrão e protegido por token |

---

# 44. CHECKLIST DE REGRESSÃO

Antes de declarar a arquitetura implementada, responder SIM para todos:

```text
[ ] $abrirfazenda funciona apenas para streamer aprovado?
[ ] espectador sem conta recebe link em vez de ser criado pelo chat?
[ ] SUPPORT existe e não possui poderes econômicos de ADMIN?
[ ] REMOVED impede jogar a fazenda da comunidade?
[ ] progresso do removido é preservado?
[ ] usuário nunca consegue criar sexta fazenda por corrida?
[ ] listing possui exatamente 100 unidades?
[ ] só existe um listing ativo por usuário, mesmo com várias fazendas?
[ ] cooldown do Marketplace é global por usuário?
[ ] anúncio permanece até venda ou retirada?
[ ] preço acima da média apenas gera aviso?
[ ] comprador nunca compra de si mesmo, nem com outra fazenda?
[ ] apodrecido vai para inventário e só pode ser descartado?
[ ] porco usa 30/15/100 e máximo inicial 2?
[ ] benefício permanente e boost temporário são entidades/semânticas distintas?
[ ] boost previsto dura 2 dias?
[ ] evento suporta 30 participantes únicos?
[ ] conclusão do evento não recompensa duas vezes?
[ ] Caixa do Fazendeiro entrega 1..4 itens?
[ ] retry de abrir caixa devolve o mesmo resultado?
[ ] ranking possui as 4 dimensões?
[ ] título Colecionador é visível conforme produto?
[ ] plantar, colher, vender e eventos conseguem conceder XP?
[ ] nível 3 usa 300 XP total no exemplo 100 + 200?
[ ] toda moeda alterada tem CoinLedger?
[ ] todo item crítico alterado tem ItemLedger?
[ ] Outbox nasce dentro da transação?
[ ] chamadas externas acontecem depois do commit?
[ ] só a API emite Socket.IO?
[ ] todos os fluxos respeitam a ordem de locks da seção 22.3?
[ ] colheita trava a fazenda?
[ ] compra e abertura de caixa verificam espaço antes de qualquer efeito?
[ ] dedupe Twitch é gravado na mesma transação do efeito?
[ ] Prisma está travado na versão 7?
[ ] Twitch bot não acessa regras econômicas/banco diretamente?
[ ] testes de concorrência usam PostgreSQL real?
[ ] backup possui restore testado antes do lançamento público?
[ ] reserva de anúncio gera ItemLedger (0, +100) e a reconciliação de quantity e reserved fecha?
[ ] meta nunca passa do alvo e o excedente fica com o jogador?
[ ] nenhuma consequência obrigatória depende de boss.send() depois do commit?
[ ] RewardGrant, boost e abertura de caixa são únicos no banco?
[ ] MarketplaceSellerState nasce com o User?
[ ] meta FAILED vira CLOSED antes da próxima ser criada?
[ ] elegibilidade de recompensa sai só do RewardEligibilitySnapshot materializado pela política PD-25?
[ ] suspensão do streamer não grava nada na fazenda?
[ ] token CSRF é ligado à sessão?
[ ] XP de colheita aplica o multiplicador de qualidade uma única vez?
[ ] toda alteração de XP tem ProgressLedger?
[ ] mutex de linha usa FOR NO KEY UPDATE?
[ ] nenhum mecanismo de caixa paga ou aleatoriedade vendida foi implementado?
[ ] ações que não alteram fazenda travam só a própria entidade (2.6, 22.3)?
[ ] dev-login desligado por padrão, impossível em produção e protegido por token forte?
[ ] CI com PostgreSQL real é a validação oficial; nada exige instalação local?
[ ] perfil de banco do 0.1 (256MB / 20 conexões / pool 5) aplicado na KVM 1?
```


## 44.1. Checklist adicional v1.3.4

```text
[ ] nenhuma mutação econômica usa Date.now() como instante autoritativo?
[ ] replay retorna o linearizedAt original?
[ ] migration cria FKs/constraints da matriz da seção 30?
[ ] runtime não possui DDL/TRUNCATE?
[ ] ledgers/audit/history/snapshot são append-only por privilégio?
[ ] definição ACTIVE já usada não é editada economicamente?
[ ] OpenAPI 0.1 é gerado do Zod e verificado no CI?
[ ] todas as fixtures PD do 0.1 estão marcadas como provisórias?
[ ] dev-login é inexistente/desligado em produção?
[ ] Math.random() não existe no domínio econômico?
[ ] sorteio econômico persiste resultado antes da resposta?
[ ] LISTEN/NOTIFY não é requisito de correção?
[ ] job derivado de internal.* possui identidade determinística?
[ ] EventSub WebSocket direto não é documentado como App Access Token?
[ ] PKCE não é tratado como requisito Twitch sem suporte oficial?
[ ] PD-03 e PD-25 continuam explicitamente PENDENTES?
```

---

# 45. CONCLUSÃO

A v1.3.4 **não redesenha a arquitetura nem altera regra de produto**. Ela consolida integralmente a v1.3.2 e o adendo técnico v1.3.3: desenvolvimento remoto, login DEV seguro, perfil conservador de banco, modelo temporal com `linearized_at`, snapshot de elegibilidade materializado, matriz completa de FKs/constraints e privilégios, versionamento de definições econômicas, contratos Zod/OpenAPI do 0.1, manifesto de fixtures e erratas técnicas de Twitch/OAuth/PD-03/aleatoriedade/outbox. O hardening econômico da v1.3.1 permanece intacto.

O desenvolvimento pode começar pelo Protótipo 0.1 sem aguardar o balanceamento completo do jogo; as pendências que tocam o 0.1 têm provisório isolado (seção 41).

> **A arquitetura pode evoluir; regra de negócio fechada não muda silenciosamente para facilitar código.**

---

# 46. ALTERAÇÕES DA v1.3 -> v1.3.1

Regra de negócio alterada em todos os itens: **NÃO**. Nenhuma regra `[FECHADA]` foi alterada; nenhum valor fechado virou pendência.

### H-01 — ItemLedger / reserva
- **Problema:** o `ItemLedger` tinha um único `delta`; reservar para anúncio não reduz `quantity`, então registrar a reserva como `−100` quebrava a reconciliação.
- **Risco:** reconciliação sempre divergente no Marketplace; ou, para "fechar a conta", código reduzindo `quantity` na reserva e liberando itens em dobro na retirada.
- **Correção aplicada:** `quantity_delta`, `reserved_delta`, `quantity_after`, `reserved_after`; tabela de deltas por reason; reconciliação separada de estoque e reserva; `CHECK` em inventário e ledger; ledger chaveado por `(farm, item, quality)`.
- **Regra de negócio alterada?** NÃO
- **Seções afetadas:** 9.2, 21.3, 21.6, 30, 37.5–37.7
- **Testes associados:** 22, 23; property 36.2; invariantes 36.3

### H-02 — Overfill da meta
- **Problema:** o incremento da meta não tinha teto; duas colheitas simultâneas perto do alvo passavam do alvo e descontavam do jogador mais do que a meta precisava.
- **Risco:** meta em 1006/1000; perda de itens do jogador.
- **Correção aplicada:** meta travada e relida antes do cálculo; `accepted = min(candidate, remaining)` por plantio; só `accepted` altera meta, desconto, contribuição e progressão; excedente fica com o jogador; conclusão exata em `current = target`; `CHECK current_quantity <= target_quantity`; sem contribuição depois de `ends_at`.
- **Regra de negócio alterada?** NÃO
- **Seções afetadas:** 16.3, 16.4, 16.5, 37.4
- **Testes associados:** 24, 27, 28

### H-03 — Outbox → jobs obrigatórios
- **Problema:** conclusão de meta/evento e recompensas eram enfileiradas no pg-boss depois do commit; fim de evento, fim de boost e avanço de ciclo dependiam de jobs agendados para `ends_at`.
- **Risco:** queda entre commit e `boss.send()` perdia a consequência; evento `ACTIVE` para sempre bloqueando o índice de evento ativo.
- **Correção aplicada:** regra explícita proibindo `boss.send()` pós-commit para consequência obrigatória; tópicos `internal.*` gravados na transação; ponte outbox → pg-boss; `internal.*` nunca expira; sweeps que recuperam a partir do estado de domínio; nenhum job agendado para `ends_at`.
- **Regra de negócio alterada?** NÃO
- **Seções afetadas:** 16.6, 16.8, 17.3, 17.4, 22.1, 24.1–24.4, 25.1
- **Testes associados:** 11, 12, 34, 35, 36

### H-04 — RewardGrant
- **Problema:** idempotência de recompensa dependia do nome do job; estado de recompensa espalhado entre `reward_status` e `PendingReward`.
- **Risco:** recompensa duplicada em reenvio, reinício ou retry manual.
- **Correção aplicada:** entidade `RewardGrant` com `UNIQUE(farm_id, source_type, source_id, reward_key)`, estados `PENDING | GRANTED | AWAITING_SPACE | NOT_ELIGIBLE`; entrega por fazenda com lock; substitui `PendingReward` e `reward_status`.
- **Regra de negócio alterada?** NÃO (PD-11 mantém o mesmo provisório: nada se perde com inventário cheio)
- **Seções afetadas:** 16.4, 16.6, 17.3, 18.6, 18.7, 29, 30
- **Testes associados:** 25, 29, 30, 32

### H-05 — Boost idempotente
- **Problema:** nada impedia a mesma meta de criar o boost duas vezes.
- **Risco:** boost duplicado ou somado em reexecução de job.
- **Correção aplicada:** `UNIQUE(community_id, source, source_ref, boost_definition_id)` com `source_ref NOT NULL`; `UNIQUE(community_id, benefit_definition_id)` para benefício permanente; boost criado na mesma transação da conclusão, datado por `completed_at` (atraso do worker não encurta os 2 dias); o job só confirma com `ON CONFLICT DO NOTHING`.
- **Regra de negócio alterada?** NÃO
- **Seções afetadas:** 15.4, 16.5, 16.6, 17.3, 23.3, 30, 37.4, 37.9
- **Testes associados:** 24, 25

### H-06 — RewardBoxOpening
- **Problema:** a repetição da abertura dependia do `IdempotencyRecord` HTTP, que expira em 48h.
- **Risco:** depois do TTL, a mesma key sortearia de novo e consumiria outra caixa.
- **Correção aplicada:** `UNIQUE(farm_id, idempotency_key)`, `request_hash`, registro nunca apagado; resultado persistido devolvido em qualquer retry.
- **Regra de negócio alterada?** NÃO
- **Seções afetadas:** 18.3, 23.3, 25.1, 30, 37.8
- **Testes associados:** 6, 33

### H-07 — MarketplaceSellerState
- **Problema:** a linha de estado era criada no primeiro anúncio ("cria se não existir").
- **Risco:** duas criações simultâneas do primeiro anúncio sem mutex efetivo.
- **Correção aplicada:** estado criado na mesma transação do `User`; backfill idempotente para usuários existentes; fallback `INSERT ... ON CONFLICT DO NOTHING` + lock.
- **Regra de negócio alterada?** NÃO
- **Seções afetadas:** 5.5, 19.3, 22.3, 37.1, 37.5
- **Testes associados:** 4, 21

### H-08 — FAILED → CLOSED
- **Problema:** o índice de meta aberta (`status <> 'CLOSED'`) conta `FAILED` como aberta; o fluxo não deixava explícito o fechamento antes da nova meta.
- **Risco:** falha de constraint ao criar a próxima meta, ou comunidade sem meta.
- **Correção aplicada:** tabela de transições; `FAILED → CLOSED` e criação da próxima na mesma transação, com a meta travada; sweep cria a primeira meta.
- **Regra de negócio alterada?** NÃO
- **Seções afetadas:** 16.2, 16.8
- **Testes associados:** 26

### H-09 — Snapshot de elegibilidade
- **Problema:** o job de recompensa decidia a elegibilidade no momento em que rodava.
- **Risco:** jogador perder (ou ganhar) recompensa conforme o atraso do worker.
- **Correção aplicada na v1.3.1 (histórico):** nova pendência PD-25; regra isolada em `resolveRewardEligibility`; `CommunityMembershipHistory` e janela de assentamento de 15s. **Superado tecnicamente pela v1.3.4/H-25:** o snapshot agora é materializado na transação da conclusão; PD-25 continua pendente.
- **Regra de negócio alterada?** NÃO (a decisão ficou com o produto)
- **Seções afetadas:** 15.2, 16.6, 17.3, 18.8, 22.4, 34.5, 41
- **Testes associados:** 31

### H-10 — Semântica de congelamento da fazenda
- **Problema:** `Farm.status = FROZEN` gravado por suspensão do streamer, sem motivo.
- **Risco:** reativar o streamer liberaria fazendas congeladas por outro motivo, ou nunca liberaria.
- **Correção aplicada:** `FROZEN` removido; `Farm.status = ACTIVE | SOLD`; política de acesso calcula o bloqueio a partir do streamer, da membership e do usuário; `Community.status` removido (derivado do streamer). Bloqueio administrativo por fazenda, se um dia existir, exige entidade própria com motivo.
- **Regra de negócio alterada?** NÃO (PD-03 mantém o provisório de bloqueio)
- **Seções afetadas:** 5.3, 6.3, 6.5, 15.1, 31
- **Testes associados:** 9; política de acesso em 36.1

### H-11 — CSRF ligado à sessão
- **Problema:** o token CSRF não estava vinculado a uma sessão.
- **Risco:** token global reutilizável entre usuários.
- **Correção aplicada:** token = HMAC(`CSRF_SECRET`, `session.id` + `csrf_version`); rotação e revogação com a sessão; comparação em tempo constante; nenhuma mutação por Socket.IO.
- **Regra de negócio alterada?** NÃO
- **Seções afetadas:** 24.5, 32.2, 32.3, 34.6
- **Testes associados:** 39

### H-12 — XP de colheita
- **Problema:** `CropDefinition.xp_reward` e `ActionXpDefinition` podiam ser somados como duas recompensas base.
- **Risco:** XP de colheita em dobro.
- **Correção aplicada:** fórmula exata por plantio; `HARVEST_BONUS` só como bônus adicional explícito, fora do seed do MVP; `per` (ACTION/UNIT) e exclusão de sobreposição em `ActionXpDefinition`; modificadores de XP aplicados uma vez por ação.
- **Regra de negócio alterada?** NÃO (valores continuam em PD-23)
- **Seções afetadas:** 7.8, 13.3
- **Testes associados:** 37

### H-13 — Compliance da Caixa
- **Problema:** não havia barreira explícita contra monetizar a caixa.
- **Risco:** implementação futura criar loot box paga sem decisão formal.
- **Correção aplicada:** bloco `[COMPLIANCE]`.
- **Regra de negócio alterada?** NÃO (a Caixa atual não muda)
- **Seções afetadas:** 18.5, 32.9
- **Testes associados:** checklist 44

### H-14 — Testes e invariantes
- **Problema:** faltavam testes para as corridas e retries acima.
- **Risco:** regressão silenciosa.
- **Correção aplicada:** testes 21–39; invariantes checadas ao fim de cada teste; Definition of Done reforçada.
- **Regra de negócio alterada?** NÃO
- **Seções afetadas:** 36, 39
- **Testes associados:** 21–39

### Correções adicionais encontradas na revisão de consistência

### H-15 — Deadlock por FK com `FOR UPDATE`
- **Problema:** inserir linhas com FK para a fazenda pega `FOR KEY SHARE`, que `FOR UPDATE` bloqueia. O job de conclusão (segurando a meta) e uma colheita (segurando a fazenda e esperando a meta) formavam ciclo.
- **Risco:** deadlock em pico de colheita junto com conclusão de meta/evento.
- **Correção aplicada:** mutex de linha com `FOR NO KEY UPDATE`; colunas referenciadas por FK nunca atualizadas; ordem R0–R7 com auditoria de todos os fluxos.
- **Regra de negócio alterada?** NÃO
- **Seções afetadas:** 22.2, 22.3, 30, 37
- **Testes associados:** 16, 38

### H-16 — XP sem ledger
- **Problema:** a Definition of Done exige ledger para XP, mas não existia.
- **Risco:** XP sem trilha de auditoria nem reconciliação.
- **Correção aplicada:** `ProgressLedger` (XP, colecionador, contribuição) e `reconcile.progress`.
- **Regra de negócio alterada?** NÃO
- **Seções afetadas:** 13.4, 14, 21.4, 21.6
- **Testes associados:** 37; invariantes 36.3

### H-17 — Dados duplicados e referências inconsistentes
- **Problema:** `Community.status` duplicava `Streamer.approval_status`; `Farm.community_id` podia divergir do streamer; `Farm.active_title_id` podia apontar para título não desbloqueado; `EventDefinition.reward_loot_table_id` contradizia "a Caixa do Fazendeiro é entregue"; a caixa não tinha vínculo com sua loot table; `ActionXpDefinition` aceitava períodos sobrepostos; a duração do boost de meta estava em `GameConfig` e na definição do boost; a variação do preço diário era descrita com fração (`1 ± variação`).
- **Risco:** estados contraditórios e entidades citadas sem definição.
- **Correção aplicada:** FKs compostas; `reward_item_definition_id`/`reward_quantity` no evento; `ItemDefinition.loot_table_id` obrigatório para caixa; `EXCLUDE` em `ActionXpDefinition`; validação de 1 a 4 itens na ativação da loot table; duração do boost só na definição; variação de preço só com inteiros (bps).
- **Regra de negócio alterada?** NÃO
- **Seções afetadas:** 10.2, 13.3, 14.4, 15.1, 17.1, 18.2, 27.2, 30
- **Testes associados:** 36.2 (caixa), invariantes 36.3

### H-18 — Regras perdidas na consolidação e lacunas de rota
- **Problema:** o escopo do MVP 1.0 e `main_category` do streamer (v1.0) não estavam na v1.3; faltavam rotas para título ativo e ajuste administrativo.
- **Risco:** funcionalidade aprovada esquecida.
- **Correção aplicada:** seção 38.0 com o escopo do MVP 1.0; campo restaurado; rotas adicionadas.
- **Regra de negócio alterada?** NÃO (restauração)
- **Seções afetadas:** 5.3, 28, 38.0
- **Testes associados:** checklist 44

### H-19 — Novas pendências explicitadas
- **Problema:** pontos de produto sem decisão encontrados na revisão: meta sem envio da mercadoria, anúncio de fazenda bloqueada, alcance do `$abrirfazenda`, procedimentos do SUPPORT, término do evento participativo.
- **Risco:** o agente decidir sozinho.
- **Correção aplicada:** PD-26 a PD-30 com provisório isolado; SUPPORT sem procedimento aprovado não executa ações com efeito.
- **Regra de negócio alterada?** NÃO
- **Seções afetadas:** 16.2, 17.3, 19.8, 26.2, 28.12, 41
- **Testes associados:** 10

---

# 47. ALTERAÇÕES DA v1.3.1 -> v1.3.2

**Nenhuma regra de produto foi alterada. Revisão apenas operacional/técnica para desenvolvimento remoto e segurança do Protótipo 0.1.**

Regra de negócio alterada em todos os itens: **NÃO**.

### H-20 — Redação da regra de locks
- **Problema:** a seção 2.6 dizia que toda ação que altera estado trava a fazenda, mas vários fluxos (enviar mercadoria, jobs de meta e evento, `$abrirfazenda`, aprovação de streamer) corretamente não travam `Farm` (22.3).
- **Risco:** o agente seguir a regra geral e travar `Farm` fora da ordem global, criando espera desnecessária ou deadlock.
- **Correção aplicada:** "toda ação que altera uma fazenda trava a `Farm`; ações que alteram outras entidades travam a entidade apropriada, obedecendo a ordem global da seção 22.3"; nota no molde 22.4.
- **Regra de negócio alterada?** NÃO
- **Seções afetadas:** 2.6, 22.4
- **Testes associados:** 16, 38 (ordem de locks)

### H-21 — Desenvolvimento remoto no lugar de Docker local
- **Problema:** o 0.1 previa Docker local; o projeto não usa ambiente instalado na máquina do desenvolvedor.
- **Risco:** fluxo de trabalho impossível de seguir; testes de concorrência sem lugar oficial para rodar.
- **Correção aplicada:** padrão GitHub + GitHub Actions + VPS DEV; CI com PostgreSQL real como validação oficial; Codespaces opcional; separação DEV × produção quando houver produção.
- **Regra de negócio alterada?** NÃO
- **Seções afetadas:** 3.1, 3.3, 34.1, 34.9, 38.1, 39.2
- **Testes associados:** todos os de 36.3 passam a ter o CI como execução oficial

### H-22 — Perfil conservador de banco na KVM 1
- **Problema:** o tuning partia de 512MB, 40 conexões e pools da pilha completa, mas o 0.1 roda só web, api e PostgreSQL.
- **Risco:** memória reservada sem uso numa VPS de 4 GB.
- **Correção aplicada:** perfil 0.1 (`shared_buffers` 256MB, `max_connections` 20, pool da API 5, sem worker e sem bot) e perfil completo para fases posteriores; serviços do 0.1 listados.
- **Regra de negócio alterada?** NÃO
- **Seções afetadas:** 34.3, 34.5
- **Testes associados:** carga (36.5) decide a troca de perfil

### H-23 — Login de desenvolvimento seguro
- **Problema:** o 0.1 previa login de desenvolvimento local, que deixa de ser seguro com o protótipo numa VPS exposta.
- **Risco:** qualquer pessoa entrar como qualquer jogador.
- **Correção aplicada:** desligado por padrão; só com `APP_ENV` diferente de produção; a API não inicia em configuração insegura; rota inexistente quando desligado; token forte com comparação em tempo constante; rate limit; auditoria; usuários marcados `auth_provider = DEV`; proteção extra no proxy quando possível. Twitch OAuth continua no 0.2.
- **Regra de negócio alterada?** NÃO
- **Seções afetadas:** 5.5, 28.1, 32.10, 34.6, 38.1
- **Testes associados:** 40–43

---

# 48. ALTERAÇÕES DA v1.3.2 / ADENDO v1.3.3 -> v1.3.4

**Nenhuma regra `[FECHADA]` foi alterada.** A v1.3.4 absorve o adendo v1.3.3 e torna o documento principal novamente único e autossuficiente.

Regra de negócio alterada em todos os itens: **NÃO**.

### H-24 — Modelo temporal e `linearized_at`
- **Problema:** `now` não distinguia início de request, espera por lock e instante efetivo da decisão.
- **Correção:** `linearized_at = clock_timestamp()` após os locks; replay preserva o instante original.
- **Seções:** 2.10, 22, 28.14.

### H-25 — Snapshot de elegibilidade materializado
- **Problema:** a janela de 15s reconstruía ordem histórica por timestamps.
- **Correção:** `RewardEligibilitySnapshot` no mesmo commit da conclusão; worker só materializa grants a partir do snapshot.
- **PD-25:** continua pendente; apenas o mecanismo técnico mudou.
- **Seções:** 16.5–16.6, 17.3, 18.6, 18.8, 29, 30.

### H-26 — Matriz completa de FKs e privilégios
- **Problema:** constraints críticas existiam, mas faltava uma matriz normativa e grants least-privilege completos.
- **Correção:** seção 30.2/30.3; runtime sem DDL/TRUNCATE; ledgers/audit/history/snapshot append-only por privilégio.

### H-27 — Versionamento das definições econômicas
- **Problema:** definições ACTIVE podiam ser reinterpretadas por edição.
- **Correção:** `DRAFT | ACTIVE | RETIRED`, revisão imutável e snapshot de promessa ao jogador.
- **Seção:** 27.3.

### H-28 — Zod/OpenAPI do Protótipo 0.1
- **Problema:** a arquitetura listava rotas, mas não congelava contratos mínimos do primeiro protótipo.
- **Correção:** Zod canônico, OpenAPI gerado e drift falha o CI.
- **Seção:** 28.14.

### H-29 — Manifesto único de fixtures provisórias
- **Problema:** valores PD-23 do 0.1 podiam se espalhar pelo seed/código.
- **Correção:** seção 41.2 com origem PD explícita; nenhum fixture vira regra fechada.

### H-30 — Errata Twitch
- **Problema:** a redação anterior confundia token de EventSub WebSocket direto com App Access Token.
- **Correção:** distinção Webhook/WebSocket/Conduit; estratégia cloud chatbot documentada; revalidação obrigatória antes da integração.
- **Seção:** 26.3.

### H-31 — Errata OAuth
- **Problema:** PKCE aparecia como requisito genérico sem estar documentado no fluxo Twitch server-side adotado.
- **Correção:** `state` obrigatório; Authorization Code Grant server-side; PKCE somente se o fluxo oficial passar a suportar/exigir.
- **Seção:** 32.1.

### H-32 — Esclarecimento PD-03
- **Problema:** suspensão tinha tratamento provisório curto demais para sweeps e consequências já comprometidas.
- **Correção:** gameplay/novos ciclos bloqueados; consistência, cleanup, grants e consequências registradas continuam; reativação não remove outros bloqueios.
- **PD-03:** continua pendente.
- **Seção:** 5.3.

### H-33 — Aleatoriedade centralizada
- **Problema:** chamadas diretas a aleatoriedade podiam se espalhar e rerollar em retry.
- **Correção:** `RandomSource`; produção `crypto.randomInt`; testes determinísticos; resultado persistido uma vez.
- **Seção:** 8.2 e fluxos de sorteio.

### H-34 — Hardening do Outbox
- **Problema:** `LISTEN/NOTIFY` e ponte para pg-boss precisavam de semântica explícita de recuperação/identidade.
- **Correção:** polling é fonte de recuperação; claim de lease vencida; `schema_version`; job id determinístico por mensagem; `DISPATCHED` somente após persistência durável.
- **Seção:** 24.

---

# 49. NOTA DE CONSOLIDAÇÃO

Esta v1.3.4 é a **única fonte de verdade arquitetural** do FarmQuest após 28/09/2026. As versões anteriores, inclusive o adendo v1.3.3, passam a ser somente histórico. Qualquer implementação deve partir deste arquivo completo.
