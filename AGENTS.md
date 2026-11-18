# Rules for agents

This repository holds the Sifty frontend. The rules for all agents working
here are those of the server repository:

- AGENTS.md: https://github.com/sifty-works/sifty-server/blob/main/AGENTS.md
- Architecture: https://github.com/sifty-works/sifty-server/blob/main/docs/ARCHITECTURE.md
- Behaviour: https://github.com/sifty-works/sifty-server/tree/main/docs/behaviour

The frontend knows only the HTTP interface description: `api/openapi.yaml`.
It does not reach into the server repository's source code, database or
internal packages. Update `api/openapi.yaml` with `npm run sync-api`.
