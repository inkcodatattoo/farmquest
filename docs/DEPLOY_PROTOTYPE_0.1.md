# FarmQuest — Deploy do Protótipo 0.1

Este documento descreve o deploy remoto do Protótipo 0.1 sem exigir Docker, PostgreSQL ou ambiente de desenvolvimento no computador do responsável pelo produto.

## Componentes ligados

No 0.1:

- `web`: ligado;
- `api`: ligado;
- `postgres`: ligado;
- `worker`: desligado;
- `twitch-bot`: desligado.

O navegador acessa somente o `web`. O Next.js encaminha `/api/*` internamente para o serviço `api`, mantendo a mesma origem para sessão e CSRF.

O PostgreSQL e a API não devem receber porta pública.

## Imagens

O GitHub Actions publica, a cada merge relevante em `main`:

- `ghcr.io/inkcodatattoo/farmquest-api:dev`;
- `ghcr.io/inkcodatattoo/farmquest-web:dev`.

Também é publicada uma tag imutável com o SHA do commit.

O VPS apenas puxa as imagens. Ele não precisa compilar o projeto.

## Segredos

Nunca colocar valores reais em Git.

Criar no EasyPanel:

```text
POSTGRES_ADMIN_PASSWORD
FARMQUEST_MIGRATOR_DB_PASSWORD
FARMQUEST_APP_DB_PASSWORD
FARMQUEST_BACKUP_DB_PASSWORD
DEV_LOGIN_SECRET
SESSION_SECRET
CSRF_SECRET
```

Para o protótipo, usar segredos aleatórios longos contendo somente letras e números hexadecimais. Isso evita a necessidade de URL-encode nas connection strings montadas pelo Compose.

Exemplo de formato, não de valor real:

```text
64 caracteres hexadecimais aleatórios
```

Não reutilizar a mesma senha em variáveis diferentes.

## Banco

A inicialização segue quatro papéis:

- `farmquest_owner`: NOLOGIN, dono do database/schema;
- `farmquest_migrator`: migrations;
- `farmquest_app`: runtime da API;
- `farmquest_backup`: leitura para backup.

O serviço `db-provision`:

1. cria/valida os papéis;
2. injeta as senhas vindas do ambiente;
3. transfere a propriedade do database para `farmquest_owner`;
4. cria/ajusta o schema `farmquest`;
5. não grava senha no repositório.

O serviço `migrate` executa migrations como `farmquest_migrator` e reaplica os grants de least privilege.

## PostgreSQL do 0.1

Configuração inicial:

```text
shared_buffers       256MB
effective_cache_size 1GB
work_mem             4MB
maintenance_work_mem 64MB
max_connections      20
```

A API usa pool máximo 5.

Esses valores são de partida para a KVM 1 e só devem subir após medição.

## Login DEV

O ambiente do protótipo usa:

```text
APP_STAGE=dev
DEV_LOGIN_ENABLED=true
SESSION_COOKIE_SECURE=true
```

O jogador precisa informar `DEV_LOGIN_SECRET` na tela inicial.

A senha:

- não fica no bundle web;
- não é salva pelo frontend;
- não permite escolher outro usuário;
- só abre o usuário fixture do Protótipo 0.1.

Em `APP_STAGE=prod`, o endpoint DEV continua proibido pela aplicação.

## EasyPanel

Arquivo-base:

```text
infra/deploy/prototype-0.1.compose.yml
```

Fluxo:

1. criar um projeto/stack para FarmQuest;
2. informar as variáveis secretas;
3. usar o Compose do 0.1;
4. apontar o domínio HTTPS somente para o serviço `web`, porta 3000;
5. não publicar `postgres`, `db-provision`, `migrate` ou `api`;
6. aguardar `db-provision` e `migrate` terminarem com sucesso;
7. confirmar `api` e `web` saudáveis;
8. abrir o domínio;
9. entrar com a senha DEV;
10. testar plantar → colher → vender → comprar semente.

## GHCR

As imagens não contêm os segredos da VPS.

Depois da primeira publicação, o EasyPanel precisa conseguir ler os pacotes GHCR. Como o código do repositório é público, a opção mais simples para o protótipo é tornar os dois pacotes de container públicos no GitHub Packages. Se forem mantidos privados, configurar uma credencial de registry no EasyPanel.

## Rollback

Para rollback, trocar:

```text
FARMQUEST_IMAGE_TAG=dev
```

pela tag SHA de um commit previamente aprovado pelo CI.

O banco não deve sofrer downgrade destrutivo automático. Migrations futuras seguem expand-first.

## Critério de sucesso

O deploy 0.1 está pronto quando:

- o domínio HTTPS abre o FarmQuest;
- o login DEV funciona;
- a fazenda mostra 100 moedas, 3 canteiros e 3 sementes na primeira criação;
- plantio persiste após recarregar;
- colheita não duplica em retry;
- inventário persiste;
- venda rápida credita moedas com taxa de 2%;
- loja compra nova semente;
- reiniciar web/API não perde o estado;
- PostgreSQL não possui porta pública.
