# Database Module

## Overview
The **Database Module** (`src/common/database/`) is a shared infrastructure module responsible for initializing the connection to PostgreSQL and configuring the Object-Relational Mapper (ORM), TypeORM.

## Purpose
By centralizing the database connection logic, other modules (like Flights, Hotels, and Transactions) only need to import TypeORM's `Repository` or `DataSource` dependencies. They do not need to worry about connection strings, connection pooling, or entity registration.

## Configuration
The database setup relies on environment variables (usually loaded via Nest's `ConfigModule`). It connects using standard parameters: host, port, username, password, and database name.

- **`data-source.ts`**: (Located in `src/`) This file defines the explicit TypeORM data source configuration. It is used both internally by the NestJS application at runtime, and externally by TypeORM CLI commands (e.g., to run or generate migrations).

## Synchronization & Migrations
In production environments, `synchronize` is strictly disabled to prevent unintended schema modifications. Instead, changes are applied systematically through TypeORM migrations.
