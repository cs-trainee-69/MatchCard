# Cat Card Game

## Local development

Install Node.js and pnpm, then copy `.env.example` to `.env`.

```sh
pnpm install
pnpm dev
```

The development and preview servers use `PORT` from `.env`, defaulting to `5173`. `E2E_PORT` defaults to `4173` so browser tests can run beside the development server.

```sh
pnpm build
pnpm preview
pnpm test
pnpm e2e
```

Environment values supplied by the process take precedence over `.env`. Empty values use the defaults. Ports must be whole numbers from 1 through 65535, and a port already in use causes the server to fail clearly.

## Docker production run

Make sure Docker Desktop is running, then start the production image:

```sh
cp .env.example .env
docker compose up --build -d
```

Open `http://127.0.0.1:5173` in a browser, or use the port set in `.env`. To change the host port, edit `PORT` in `.env` and recreate the container:

```sh
docker compose up -d --force-recreate
```

The image does not need to be rebuilt for a host-port change. Stop the container with `docker compose down`.

To run the existing browser suite against the Docker container, set `E2E_BASE_URL` to its URL before running `pnpm e2e`. Leave it unset to start the local E2E server on `E2E_PORT`.

The performance measurement uses `PORT` by default. Set `PERF_URL` when measuring another running instance.
