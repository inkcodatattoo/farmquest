# FarmQuest — execução local simplificada

Este fluxo é apenas para desenvolvimento no computador do projeto.

## Abrir o FarmQuest

Na raiz do repositório, dê dois cliques em:

`START_FARMQUEST.bat`

O script:

1. verifica o PostgreSQL;
2. instala dependências apenas se necessário;
3. gera o Prisma Client;
4. aplica migrations pendentes;
5. reaplica os privilégios do banco;
6. abre a API;
7. abre a interface web;
8. espera os serviços responderem;
9. abre `http://localhost:3000` automaticamente.

Na primeira execução, ele cria `.farmquest-local.cmd` com segredos locais aleatórios. Esse arquivo é ignorado pelo Git e não deve ser enviado ao repositório.

## Fechar

Dê dois cliques em:

`STOP_FARMQUEST.bat`

O PostgreSQL permanece rodando como serviço do Windows.

## Criar atalho na Área de Trabalho

Execute uma vez:

`CRIAR_ATALHO_FARMQUEST.bat`

Ele cria o atalho **FarmQuest Local** na Área de Trabalho.

## Pré-requisitos já usados no ambiente local

- Node.js 24;
- pnpm 12.7;
- PostgreSQL local;
- banco `farmquest`;
- roles `farmquest_migrator` e `farmquest_app`;
- acesso local de desenvolvimento configurado no `pg_hba.conf`.

A autenticação `trust` usada localmente não é configuração de produção. A VPS continua usando autenticação por senha e segredos externos ao Git.
