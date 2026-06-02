# Cache Module

## Overview
The **Cache Module** provides centralized caching capabilities using Redis. It is built on top of NestJS's standard `@nestjs/cache-manager` alongside the `cache-manager-redis-yet` storage engine.

## Purpose
Third-party API calls (to flight or hotel providers) can be slow and rate-limited. By caching search results, the system drastically improves response times and reduces the load on external providers.

## Key Features
- **Redis Integration**: Uses Redis as the backing store, allowing cache state to be shared across multiple horizontal instances of the Booking System.
- **Dependency Injection**: The caching manager is globally available (or imported where needed) so that specific services (like `Providers`) can effortlessly inject the `CACHE_MANAGER` token to `get()`, `set()`, or `del()` cached entries.

## Common Usage
Providers usually construct a unique cache key based on the search parameters (e.g., `flight_search:LHR:JFK:2024-12-01`).
- If data exists for the key, it bypasses the network call.
- If data does not exist, it makes the request, saves the response to Redis with a specific Time-To-Live (TTL), and then returns the data.
