# sifty-web

The TypeScript frontend for Sifty, a local job application manager.

The frontend communicates with a Sifty server over its HTTP API; it knows only
`api/openapi.yaml` — a copy of the server's interface description. The server
repository is at https://github.com/sifty-works/sifty-server.

## Running against a local server

Install dependencies:

```
npm ci
```

Start a Sifty server in offline mode on a fixture data folder (see the server
repository for how to start one), then start the dev server:

```
npm run dev
```

The dev server listens on port 5173 and forwards `/api` requests to
`http://127.0.0.1:7300`. To use a different server port, set the
`SIFTY_API_PORT` environment variable before starting:

```
SIFTY_API_PORT=9000 npm run dev
```

## Keeping the API schema up to date

`api/openapi.yaml` is a pinned copy of the server's interface description.
When the server description changes, copy it and regenerate the TypeScript
types:

```
npm run sync-api -- <path-to-sifty-server>
```

This copies `api/openapi.yaml` from the server checkout and regenerates
`src/api/schema.gen.ts`. Commit both files together.

`npm run check` fails when `src/api/schema.gen.ts` is stale against the local
`api/openapi.yaml`.

## Releasing

Build and pack a release archive:

```
npm run release -- <version>
```

This builds the client, writes the SHA-256 of `api/openapi.yaml` into
`dist/api.sha256`, and produces:

- `release/sifty-web-<version>.tar.gz`: the dist contents with `index.html`
  at the archive root.
- `release/sifty-web-<version>.sha256`: the SHA-256 checksum of the archive.

Publishing the release archive is done by the coordinator.

## Checks

```
npm run check   # TypeScript type check and schema freshness check
npm run build   # production build
bash scripts/budget.sh  # line count against the 6,000-line budget
```
