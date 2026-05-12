# Modular Monolith Booking System

A robust, maintainable booking application built with **NestJS**, following the **Modular Monolith** architecture. The system supports flight and hotel searching by aggregating data from multiple external providers.

## 🚀 Architecture & Patterns

This project is structured as a modular monolith to ensure clear domain boundaries and high maintainability.

### Key Patterns
- **Adapter Pattern**: Each external service (e.g., Duffel, FlightAPI.io) is integrated via a dedicated adapter. These adapters normalize disparate API responses into a common internal interface.
- **Scatter-Gather Pattern**: The system performs parallel requests to all registered providers for a specific domain (Flights/Hotels) and aggregates the results, ensuring low latency and resilience.

### Domain Modules
- **Flights**: Handles flight search requests and business logic.
- **Hotels**: Manages hotel availability and searching.
- **External API**: A central module that orchestrates the Scatter-Gather flow for external services.
- **Providers**: Contains all external API adapters (Duffel, FlightAPI.io).
- **Common**: Shared interfaces, DTOs, and utility pipes (e.g., SanitizePipe).

## 🛠 Features

- **Multi-Provider Flight Search**: Concurrent fetching from:
  - [Duffel](https://duffel.com/)
  - [FlightAPI.io](https://flightapi.io/)
- **Swagger Documentation**: Automatically generated API docs with detailed request/response schemas.
- **Input Validation & Sanitization**: Robust request validation using `class-validator` and XSS protection via a custom `SanitizePipe`.
- **Resilient Aggregation**: Built-in timeouts and error handling to ensure that one failing provider doesn't break the entire search request.
- **Caching with Redis**: Performance optimization through centralized caching of search results using Redis, reducing API costs and improving response times.
- **Docker Ready**: Easy deployment and development environment setup with Docker and Docker Compose.

## 🏁 Getting Started

### Prerequisites
- Node.js (v18+)
- Docker & Docker Compose
- pnpm (recommended)

### Infrastructure Setup
Spin up the required infrastructure (Redis) using Docker Compose:
```bash
$ docker-compose up -d
```

### Installation
```bash
$ npm install
```

### Environment Variables
Create a `.env` file in the root directory:
```env
PORT=6000
DUFFEL_API_TOKEN=your_duffel_token
FLIGHTAPI_API_KEY=your_flightapi_key
FLIGHTAPI_API_URL=https://api.flightapi.io/onewaytrip
```

### Running the App
```bash
# Development
$ npm run dev

# Production
$ npm run start:prod
```

## 📖 API Documentation

Once the application is running, you can access the interactive Swagger documentation at:
`http://localhost:6000/api-docs`

## 🧪 Testing
```bash
# Unit tests
$ npm run test

# E2E tests
$ npm run test:e2e
```

## 📄 License
This project is [MIT licensed](LICENSE).
