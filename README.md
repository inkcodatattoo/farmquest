# FarmQuest

Protótipo 0.1 do FarmQuest, implementado conforme a arquitetura técnica v1.3.4.

## Status

Em desenvolvimento.


## Prévia visual

Durante a fase de direção de arte, a branch de UI inclui uma rota local de prévia sem dependência de banco ou API.

```bash
pnpm --filter @farmquest/web exec next dev -H 0.0.0.0 -p 3000
```

Abra:

```text
http://localhost:3000/preview
```

A rota é bloqueada automaticamente em `NODE_ENV=production`.
