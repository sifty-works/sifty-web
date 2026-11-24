# Rules for agents

This repository holds the Sifty frontend. The rules for all agents working
here are those of the server repository:

- AGENTS.md: https://github.com/sifty-works/sifty-server/blob/main/AGENTS.md
- Architecture: https://github.com/sifty-works/sifty-server/blob/main/docs/ARCHITECTURE.md
- Behaviour: https://github.com/sifty-works/sifty-server/tree/main/docs/behaviour

The frontend knows only the HTTP interface description: `api/openapi.yaml`.
It does not reach into the server repository's source code, database or
internal packages. Update `api/openapi.yaml` with `npm run sync-api`.

After changing a stylesheet or adding a class that is built at run time rather
than written out, run `node scripts/dead-styles.mjs`. It reports every class
rule no element can match, and stops with an error when a site that builds a
class name has moved. It is not part of `npm run check`.

A working copy made with `git worktree add` starts without `node_modules`, and
`npm run check` cannot run there. Link the main checkout's instead of
installing a second copy: `ln -s ../../node_modules node_modules` from the
root of the working copy.
