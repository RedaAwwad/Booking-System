# Sanitize Module

## Overview
The **Sanitize Module** is a cross-cutting security utility that safeguards the application against Cross-Site Scripting (XSS) and other injection attacks by cleaning incoming request payloads.

## Key Component

### `SanitizePipe`
Located in `sanitize.pipe.ts`.
- **Purpose**: It acts as a NestJS Global Pipe (registered in `src/main.ts`).
- **Functionality**: Before the request data reaches the controllers or validation pipes (`ValidationPipe`), the `SanitizePipe` intercepts it. It traverses the payload and strips out any potentially malicious HTML tags or scripts from string properties using `class-sanitizer` or a similar library.
- **Why it matters**: This guarantees that all modules (Flights, Hotels, etc.) operate on clean data without each controller having to manually sanitize its inputs.
