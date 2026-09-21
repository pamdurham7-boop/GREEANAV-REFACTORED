# GREEANAV-REFACTORED

GREEANAV-REFACTORED is a containerized full-stack project composed of:

- A Java HTTP API (`main-java`) for authentication and device signal/location storage.
- A React Native + Expo web frontend (`main-tsx`) served through Nginx.
- MySQL for persistence.
- Optional Cloudflare Tunnel support for remote exposure.

## Repository Structure

```text
.
├── docker-compose.yaml
├── main-java/
│   ├── Dockerfile
│   └── MvcApp.java
└── main-tsx/
    ├── Dockerfile
    ├── App.tsx
    ├── nginx.conf
    └── src/
```

## Core Features

- User registration and login (`/register`, `/login`).
- Device signal ingestion and validation in the Java API.
- Device location updates from the frontend.
- Signal listing endpoint used for map/chart dashboard views.
- Device deletion endpoint for dismissing tracked entries.

## Prerequisites

- Docker
- Docker Compose

## Environment Files

`docker-compose.yaml` expects the following env files:

- `./db-mysql/mysql.env`
- `./main-java/java.env`
- `./main-tsx/tsx.env`
- `./cloudflare/cloudflare.env` (if Cloudflare Tunnel is used)

Create these files before running the stack.

## Running with Docker Compose

From the repository root:

```bash
docker compose up --build
```

Default exposed ports:

- Frontend (Nginx): `3000`
- Java API: `8080`

Stop containers:

```bash
docker compose down
```

## Frontend Development (optional)

If you want to run only the frontend locally:

```bash
cd main-tsx
npm ci
npm run start
```

## Backend Notes

The Java backend creates required tables on startup:

- `users`
- `device_status`

It reads configuration from environment variables such as:

- `SPRING_DATASOURCE_URL`
- `SPRING_DATASOURCE_USERNAME`
- `SPRING_DATASOURCE_PASSWORD`
- `SERVER_PORT`
- `DEVICE_SHARED_KEY`
