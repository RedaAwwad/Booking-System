-- Creates a dedicated database for Keycloak inside the shared postgres container.
-- This script runs automatically on first postgres startup via docker-entrypoint-initdb.d.
-- Keycloak connects to this DB (see KC_DB_URL in docker-compose.yml).
SELECT 'CREATE DATABASE keycloak OWNER ' || current_user
WHERE NOT EXISTS (
  SELECT FROM pg_database WHERE datname = 'keycloak'
)\gexec
