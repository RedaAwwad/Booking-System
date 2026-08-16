# Booking System Authentication Refactor — Keycloak + Passport + Local User/Roles

## Purpose

Refactor the current authentication implementation so that:

- **Keycloak is the identity provider and authentication server.**
- **Keycloak is the only JWT issuer.** NestJS must **not** issue a second application JWT.
- **NestJS uses Passport + `passport-jwt` + Keycloak JWKS** to validate Keycloak access tokens.
- **PostgreSQL is the source of truth for Booking System application users and authorization roles.**
- After Passport validates the Keycloak JWT, NestJS loads the corresponding local user from PostgreSQL and hydrates `request.user` with the **local application `userId` and local roles**.
- Application business modules must not depend on Keycloak-specific token shapes, Keycloak IDs, or `realm_access.roles`.
- The design should keep Keycloak-specific code behind an identity-provider boundary so another OIDC provider could replace Keycloak later with minimal changes.
- The current EJS login/callback proof-of-concept should be removed from the production authentication flow. A React frontend will later use a standard OIDC/Keycloak client library instead of manually implementing PKCE.

This document is intended to be used as an implementation specification for Codex.

---

# 1. Target Architecture

```text
                         ┌──────────────────────┐
                         │       Keycloak       │
                         │                      │
                         │ username/email       │
                         │ password/credentials │
                         │ SSO / federation     │
                         │ OIDC                 │
                         └──────────┬───────────┘
                                    │
                                    │ Keycloak access token
                                    │ signed with Keycloak key
                                    ▼
                         ┌──────────────────────┐
                         │       NestJS         │
                         │                      │
                         │ Passport JWT Strategy│
                         │ + JWKS validation    │
                         └──────────┬───────────┘
                                    │
                           validated identity
                         { sub, email, ... }
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │    UserService       │
                         │                      │
                         │ lookup by external   │
                         │ identity subject     │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │      PostgreSQL      │
                         │                      │
                         │ users.id             │
                         │ users.roles JSONB    │
                         │ business data        │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         request.user = {
                           id: localUser.id,
                           email,
                           name,
                           roles,
                           externalIdentityId
                         }
```

Normal protected API calls must use the **Keycloak access token**:

```http
Authorization: Bearer <keycloak-access-token>
```

There is no token exchange into a NestJS-issued JWT.

---

# 2. Responsibility Boundaries

## Keycloak owns

Keycloak is responsible for **identity and authentication**:

- Username
- Email used for identity/login
- Password and credential storage
- Password reset
- MFA if enabled later
- SSO session
- OIDC authorization flow
- Access token / refresh token issuance
- Federation with LDAP / Active Directory / external identity providers in the future

Passwords must never be copied to or stored in the Booking PostgreSQL database.

## Booking PostgreSQL owns

The application database is responsible for the **Booking domain user** and **application authorization**:

- Local `user.id`
- External identity subject linking the local user to the identity provider
- Application profile/domain data
- `roles` JSONB column
- Active/inactive application state if needed
- Relationships to bookings, customers, payments, etc.

Application authorization must read roles from PostgreSQL, not from Keycloak token roles.

## Passport owns

Passport is the NestJS authentication boundary:

1. Extract bearer token.
2. Validate the Keycloak JWT signature using JWKS.
3. Validate expiration.
4. Validate issuer.
5. Accept only the expected signing algorithm (`RS256`).
6. Convert the provider token into a generic external identity.
7. Resolve the local application user.
8. Put the local application user identity onto `request.user`.

---

# 3. Important Non-Goals

Do **not** implement any of the following:

- Do not issue a second JWT from NestJS.
- Do not use `@nestjs/jwt` to sign application access tokens.
- Do not use `nest-keycloak-connect` for API authentication.
- Do not use Keycloak realm roles as the source of truth for Booking authorization.
- Do not copy Keycloak passwords to PostgreSQL.
- Do not manually decode JWTs and trust their contents without signature validation.
- Do not call the Keycloak Admin API on every authenticated API request.
- Do not make business controllers accept a `keycloakId` when a local `userId` should be used.
- Do not expose Keycloak-specific payload structures such as `realm_access` to business modules.
- Do not keep the EJS PKCE implementation as the final frontend login implementation.

---

# 4. Current Code to Replace

The existing project currently uses `nest-keycloak-connect` in `keycloak.module.ts` and configures Keycloak as bearer-only with offline validation.

Remove this authentication path and replace it with Passport.

The current files `login.ejs`, `callback.ejs`, and `LoginController` manually implement browser PKCE and token exchange. They were useful as a proof of concept but should not be part of the final React architecture.

The current `KeycloakSyncService` contains a useful concept — linking a Keycloak `sub` to a local user — but it should be refactored so:

- it works with a provider-neutral `ExternalIdentity` type;
- local roles come exclusively from PostgreSQL;
- it does not derive `isAdmin` from `payload.realm_access.roles`;
- it hydrates a generic authenticated application user.

The current `KeycloakAdminService` should not be used by normal request authentication. If user provisioning still needs Keycloak Admin API calls, keep that functionality behind an `IdentityProvider` interface/adapter.

---

# 5. Dependencies

Install the Passport approach used by the referenced NestJS/Keycloak guide:

```bash
npm install @nestjs/passport passport passport-jwt jwks-rsa
npm install -D @types/passport-jwt
```

Remove these packages if no other feature depends on them:

```bash
npm uninstall nest-keycloak-connect keycloak-connect
```

Do not add `@nestjs/jwt` for application token creation because NestJS is not an issuer in this architecture.

---

# 6. Environment Configuration

Keep configuration provider-neutral where practical.

Recommended environment variables:

```env
OIDC_ISSUER_URL=http://localhost:8180/realms/booking-realm
OIDC_JWKS_URL=http://localhost:8180/realms/booking-realm/protocol/openid-connect/certs
OIDC_CLIENT_ID=booking-web

# Docker-internal equivalents when the API runs inside Docker
OIDC_INTERNAL_ISSUER_URL=http://keycloak:8080/realms/booking-realm
OIDC_INTERNAL_JWKS_URL=http://keycloak:8080/realms/booking-realm/protocol/openid-connect/certs
```

The exact configuration implementation may continue using the existing `DOCKER_ENV` switch, but OIDC-neutral names are preferred over leaking `KEYCLOAK_*` names throughout the application.

Important: issuer validation must match the `iss` claim Keycloak actually places in the browser-issued token. Do not blindly replace the public issuer with an internal Docker hostname if that would make issuer validation fail. The JWKS URL may be internal while the expected issuer remains the public issuer.

## 6.1 Docker Compose / Keycloak Version

Target **Keycloak `26.6.3`** for this implementation. This is an explicit infrastructure decision and supersedes the repository's older Keycloak `24.0.4` image. Do not silently revert to the older image while implementing authentication.

Use the newer Keycloak bootstrap-admin environment variables:

```env
KC_BOOTSTRAP_ADMIN_USERNAME=${KC_ADMIN_USER}
KC_BOOTSTRAP_ADMIN_PASSWORD=${KC_ADMIN_PASSWORD}
```

Do **not** use the older `KEYCLOAK_ADMIN` / `KEYCLOAK_ADMIN_PASSWORD` variables in the target Keycloak 26 compose configuration.

The target development service should combine realm auto-import, the normal Keycloak application port, and the Keycloak management/health port:

```yaml
keycloak:
  image: quay.io/keycloak/keycloak:26.6.3
  container_name: booking_keycloak
  profiles: [auth, fullstack]

  command: start-dev --import-realm

  environment:
    KC_DB: postgres
    KC_DB_URL: jdbc:postgresql://postgres:5432/keycloak
    KC_DB_USERNAME: ${DATABASE_USER}
    KC_DB_PASSWORD: ${DATABASE_PASSWORD}

    KC_BOOTSTRAP_ADMIN_USERNAME: ${KC_ADMIN_USER}
    KC_BOOTSTRAP_ADMIN_PASSWORD: ${KC_ADMIN_PASSWORD}

    KC_HTTP_ENABLED: "true"
    KC_HTTP_PORT: 8080
    KC_HEALTH_ENABLED: "true"
    KC_METRICS_ENABLED: "true"

  volumes:
    - ./keycloak/realm-export.json:/opt/keycloak/data/import/realm-export.json:ro

  ports:
    - "${KC_PORT:-8180}:8080"
    - "9000:9000"

  depends_on:
    postgres:
      condition: service_healthy

  healthcheck:
    test:
      - CMD-SHELL
      - >-
        exec 3<>/dev/tcp/localhost/9000 &&
        echo -e 'GET /health/live HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n' >&3 &&
        cat <&3 | grep -q ' 200 '
    interval: 10s
    timeout: 10s
    retries: 20
    start_period: 30s

  restart: unless-stopped
```

Port responsibilities must remain clear:

- `8180 -> 8080`: Keycloak application endpoints: Admin Console, login, OIDC authorization/token endpoints, realm discovery, and JWKS.
- `9000 -> 9000`: management interface for health and metrics. It is **not** the user-facing Keycloak/OIDC port.
- NestJS running inside Docker reaches Keycloak through `http://keycloak:8080`.
- Postman/browser running on the host reaches Keycloak through `http://localhost:8180`.

The management port is exposed only for local development/health inspection. Do not treat port `9000` as a replacement for `8080`, and do not expose the management interface publicly in a production deployment.

Keep `start-dev --import-realm` for local development so the checked-in realm configuration is reproducible. Remember that startup import skips a realm that already exists; changes to `realm-export.json` are not automatically applied to an already-created `booking-realm`.

This version upgrade is scoped to the Keycloak service/configuration. Do not use it as a reason to refactor unrelated Docker services.

---

# 7. Keycloak Client Configuration

The browser/React application is a **public OIDC client** because a browser cannot securely store a client secret.

The existing realm export already uses a public client with Authorization Code + PKCE. Keep that model.

Recommended client identity:

```text
clientId: booking-web
client authentication: OFF / public client
standard authorization code flow: enabled
PKCE: S256
implicit flow: disabled
direct access grants/password grant: disabled
service accounts: disabled
```

For local development, configure explicit React URLs rather than broad wildcards when the frontend port is known.

Example:

```json
"redirectUris": [
  "http://localhost:5173/*"
],
"webOrigins": [
  "http://localhost:5173"
]
```

If the React dev server uses another port, use that port instead.

The current `booking-api` public client is really acting as a browser client. Prefer renaming/recreating it as `booking-web` to make its responsibility clear.

The NestJS API does not need to possess the public browser client's secret because there is no secret. It validates bearer tokens using Keycloak's public signing keys exposed through JWKS.

---

# 8. Local User Model

Refactor the `users` table/entity so it contains an external identity link and JSONB roles.

Recommended shape:

```ts
export class User {
  id: string; // UUID generated by Booking application

  externalIdentityId: string; // OIDC `sub`

  email: string;

  name: string;

  roles: string[]; // persisted as PostgreSQL jsonb

  isActive: boolean;

  createdAt: Date;

  updatedAt: Date;
}
```

Database requirements:

```text
users.id                    UUID PRIMARY KEY
users.external_identity_id  UNIQUE NOT NULL
users.email                 appropriate uniqueness based on existing business rules
users.roles                 JSONB NOT NULL DEFAULT '[]'
users.is_active             BOOLEAN NOT NULL DEFAULT true
```

Do not use email as the identity-provider link. Email can change. OIDC `sub` is the stable external subject identifier for a given issuer.

For stronger future multi-provider support, the ideal identity key is conceptually:

```text
(issuer, subject)
```

rather than `subject` alone. If feasible, add:

```text
identityIssuer
externalIdentityId
```

with a unique constraint on the pair.

---

# 9. Local Roles Model

Roles are stored directly on the `users` row as PostgreSQL JSONB.

Example:

```json
["customer"]
```

or:

```json
["admin", "support"]
```

TypeScript representation:

```ts
export type AppRole = 'customer' | 'admin' | 'support';
```

The exact allowed role names should be derived from the application's existing role requirements.

Important rules:

- Keycloak roles are not authoritative for Booking authorization.
- Ignore `realm_access.roles` when deciding access to Booking business endpoints.
- Guards must evaluate `request.user.roles`, which came from PostgreSQL.
- Updating a user's application roles requires only a PostgreSQL update; it should not require changing Keycloak roles.

---

# 10. Provider-Neutral Identity Types

Create a generic external identity type.

Example:

```ts
export interface ExternalIdentity {
  issuer: string;
  subject: string;
  email?: string;
  username?: string;
  name?: string;
}
```

Create the application-facing authenticated user type:

```ts
export interface AuthenticatedUser {
  id: string; // LOCAL PostgreSQL user id
  externalIdentityId: string;
  email: string;
  name: string;
  roles: string[];
}
```

Business modules should depend on `AuthenticatedUser`, never directly on a `KeycloakTokenPayload` type.

---

# 11. Passport JWT Strategy

Create a Passport strategy similar to the tutorial's custom Passport approach.

Suggested file:

```text
src/modules/auth/strategies/oidc-jwt.strategy.ts
```

Responsibilities:

1. Extract token using `ExtractJwt.fromAuthHeaderAsBearerToken()`.
2. Use `jwks-rsa`'s `passportJwtSecret()` to retrieve and cache Keycloak public keys.
3. Validate issuer.
4. Validate expiration (`ignoreExpiration: false`).
5. Allow only `RS256`.
6. Map the verified token into `ExternalIdentity`.
7. Ask an application auth/user service to resolve the local user.
8. Return `AuthenticatedUser` from `validate()`.

Passport automatically assigns whatever `validate()` returns to `request.user`.

Conceptual implementation:

```ts
@Injectable()
export class OidcJwtStrategy extends PassportStrategy(Strategy, 'oidc') {
  constructor(
    config: ConfigService,
    private readonly authIdentityService: AuthIdentityService,
  ) {
    const issuer = config.getOrThrow<string>('OIDC_ISSUER_URL');
    const jwksUri = config.getOrThrow<string>('OIDC_JWKS_URL');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      issuer,
      algorithms: ['RS256'],
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri,
      }),
    });
  }

  async validate(payload: OidcTokenClaims): Promise<AuthenticatedUser> {
    const identity: ExternalIdentity = {
      issuer: payload.iss,
      subject: payload.sub,
      email: payload.email,
      username: payload.preferred_username,
      name: payload.name,
    };

    return this.authIdentityService.resolveAuthenticatedUser(identity);
  }
}
```

Do not return the raw token payload from `validate()`.

---

# 12. Token Claim Type

The strategy may use a provider/OIDC claim type internally:

```ts
export interface OidcTokenClaims {
  iss: string;
  sub: string;
  exp: number;
  iat: number;
  email?: string;
  preferred_username?: string;
  name?: string;
  aud?: string | string[];
  azp?: string;
}
```

Do not make application authorization depend on Keycloak-only structures such as:

```ts
realm_access.roles
resource_access
```

Those claims may exist, but they are outside the Booking authorization boundary.

---

# 13. Local User Resolution / Hydration

Create an application service whose job is to turn a verified external identity into a local authenticated user.

Suggested file:

```text
src/modules/auth/services/auth-identity.service.ts
```

Conceptual API:

```ts
async resolveAuthenticatedUser(
  identity: ExternalIdentity,
): Promise<AuthenticatedUser>
```

Flow:

```text
verified OIDC identity
        │
        ▼
find local user by (issuer, subject)
        │
        ├── found ──► check isActive ──► return local user + local roles
        │
        └── not found
                │
                └── apply provisioning policy
```

For an existing user:

```ts
return {
  id: user.id,
  externalIdentityId: user.externalIdentityId,
  email: user.email,
  name: user.name,
  roles: user.roles,
};
```

This returned object becomes `request.user`.

Therefore controllers can do:

```ts
@Get('me')
getMe(@CurrentUser() user: AuthenticatedUser) {
  return user;
}
```

and business logic can use:

```ts
user.id
```

for PostgreSQL lookups without knowing anything about Keycloak.

---

# 14. User Provisioning Policy

The current requirement says that when a Booking user is created, the identity should exist in both:

1. the identity provider (currently Keycloak), and
2. the Booking PostgreSQL database.

Implement this through an abstraction, not by directly calling `KeycloakAdminService` from controllers.

Create an interface such as:

```ts
export interface IdentityProvider {
  createUser(input: CreateIdentityInput): Promise<ExternalIdentityRecord>;
  disableUser(subject: string): Promise<void>;
  enableUser(subject: string): Promise<void>;
  deleteUser?(subject: string): Promise<void>;
}
```

Then implement:

```text
KeycloakIdentityProvider implements IdentityProvider
```

Only this adapter should know about Keycloak Admin REST API endpoints and Keycloak admin credentials.

Application service example:

```text
UserProvisioningService.createUser()
    │
    ├── identityProvider.createUser(...)
    │        │
    │        └── returns external subject
    │
    └── userRepository.create({
             externalIdentityId: subject,
             roles: [...],
             ...
         })
```

Because PostgreSQL and Keycloak cannot participate in the same database transaction, explicitly handle partial failures.

Recommended initial compensation strategy:

1. Create identity in Keycloak.
2. Create local user in a PostgreSQL transaction.
3. If local creation fails after Keycloak creation, attempt to delete/disable the newly created Keycloak identity.
4. Log compensation failures loudly for manual recovery.

Do not pretend this is an atomic distributed transaction.

---

# 15. First Login / Federation Compatibility

The architecture must also be compatible with future federation.

If Keycloak later authenticates users from LDAP/Active Directory, the application may receive a valid Keycloak token for a user that was not explicitly created by the Booking application's create-user flow.

Therefore define a clear missing-local-user policy.

Recommended policy for this project:

```text
If a valid external identity has no local Booking user:
  - either auto-provision a minimal local user with a safe default role,
  - or reject access until an administrator provisions the local user.
```

Choose one behavior explicitly in code/configuration.

If retaining the current just-in-time behavior, use a safe default such as:

```json
["customer"]
```

and never derive the default local role from Keycloak realm roles.

This gives future LDAP federation this flow:

```text
LDAP / Active Directory
        │
        ▼
     Keycloak
        │
        │ OIDC token
        ▼
      NestJS
        │
        │ Passport validates token
        ▼
local user lookup
        │
        └── first login → create Booking user if policy allows
```

No Booking business module needs to understand LDAP.

---

# 16. Passport Guard

Create a provider-neutral guard:

```ts
@Injectable()
export class OidcAuthGuard extends AuthGuard('oidc') {}
```

If the project uses a global authentication guard, keep support for public routes through metadata such as `@Public()`.

Avoid naming the application-level guard `KeycloakAuthGuard` unless it lives inside the Keycloak/OIDC adapter layer.

Preferred business-facing name:

```text
AuthGuard
```

or:

```text
OidcAuthGuard
```

---

# 17. `@CurrentUser()` Decorator

Keep or refactor the existing `@CurrentUser()` decorator so it reads the hydrated Passport user from `request.user`.

Expected type:

```ts
@CurrentUser() user: AuthenticatedUser
```

Expected value example:

```json
{
  "id": "0f08d10f-....",
  "externalIdentityId": "55fdb0a9-....",
  "email": "ahmed@example.com",
  "name": "Ahmed",
  "roles": ["customer"]
}
```

`id` must be the Booking PostgreSQL user ID, not the Keycloak `sub`.

---

# 18. Authorization Guard Using Local Roles

Refactor the existing `AdminGuard` / role guard so it uses local PostgreSQL roles already hydrated into `request.user`.

Example decorator:

```ts
@Roles('admin')
```

Example guard behavior:

```ts
const user = request.user as AuthenticatedUser;
const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
  context.getHandler(),
  context.getClass(),
]);

return requiredRoles.every((role) => user.roles.includes(role));
```

Never read:

```ts
request.user.realm_access.roles
```

for application authorization.

---

# 19. `/auth/me`

Keep a protected `GET /auth/me` endpoint, but return the hydrated local user rather than raw Keycloak claims.

Expected behavior:

```http
GET /api/v1/auth/me
Authorization: Bearer <keycloak-token>
```

Response example:

```json
{
  "success": true,
  "data": {
    "id": "LOCAL-USER-UUID",
    "email": "admin@booking.com",
    "name": "System Admin",
    "roles": ["admin"]
  }
}
```

Do not expose unnecessary raw token claims.

---

# 20. Admin/User Management API

Business-facing user-management endpoints should use **local application user IDs**.

Prefer:

```http
PATCH /admin/users/:userId/block
```

instead of:

```http
PATCH /admin/users/:keycloakId/block
```

Flow:

```text
local userId
   │
   ▼
load local user
   │
   ├── local isActive change
   │
   └── externalIdentityId
            │
            ▼
      IdentityProvider adapter
            │
            ▼
         Keycloak
```

This prevents Keycloak identifiers from leaking into the public business API.

---

# 21. React Frontend Direction

The React frontend should not copy the existing EJS PKCE code.

The real React implementation should use a standard OIDC integration. Since Keycloak is currently the provider, `keycloak-js` is acceptable at the frontend identity boundary.

The frontend flow is:

```text
React
  │
  │ Authorization Code + PKCE
  ▼
Keycloak login
  │
  ▼
React receives/manages Keycloak tokens
  │
  │ Authorization: Bearer access_token
  ▼
NestJS API
```

The NestJS API then validates the access token independently via JWKS and does not trust the frontend simply because the frontend says a user is logged in.

Do not implement username/password forms in React that POST the user's password to NestJS.

Do not use Resource Owner Password Credentials / direct grant for the normal frontend login flow.

---

# 22. Realm Export Changes

Current realm configuration contains realm roles such as `admin` and `customer` and assigns `admin` to the test user.

Because PostgreSQL is now authoritative for Booking application roles:

- Keycloak realm roles may remain for Keycloak/identity administration if genuinely needed.
- They must not be used by Booking authorization guards.
- The test user's local PostgreSQL row must contain the Booking roles that should actually authorize the user.

Also update the client naming/configuration so the public PKCE client clearly represents React, for example:

```text
booking-web
```

rather than calling the public browser client `booking-api`.

If backward compatibility is needed during the refactor, keep the current client ID temporarily and rename it in a dedicated migration step.

---

# 23. Suggested Module Structure

```text
src/modules/auth/
├── auth.module.ts
│
├── domain/
│   ├── authenticated-user.interface.ts
│   └── external-identity.interface.ts
│
├── strategies/
│   └── oidc-jwt.strategy.ts
│
├── guards/
│   ├── auth.guard.ts
│   └── roles.guard.ts
│
├── decorators/
│   ├── current-user.decorator.ts
│   ├── public.decorator.ts
│   └── roles.decorator.ts
│
├── services/
│   ├── auth-identity.service.ts
│   └── user-provisioning.service.ts
│
└── infrastructure/
    └── identity-provider/
        ├── identity-provider.interface.ts
        └── keycloak/
            ├── keycloak-identity-provider.service.ts
            └── keycloak-admin-client.service.ts
```

Names may be adapted to match the project's existing conventions, but preserve the boundaries.

---

# 24. Auth Module Target

The new `AuthModule` should conceptually resemble:

```ts
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'oidc' }),
    UserModule,
  ],
  controllers: [AuthController, AdminController],
  providers: [
    OidcJwtStrategy,
    AuthIdentityService,
    UserProvisioningService,
    RolesGuard,
    KeycloakIdentityProvider,
  ],
  exports: [
    PassportModule,
    AuthIdentityService,
  ],
})
export class AuthModule {}
```

Do not register `KeycloakConnectModule`.

---

# 25. Request Lifecycle

For every protected API request:

```text
1. React sends Keycloak access token as Bearer token.

2. Passport JWT strategy extracts the token.

3. jwks-rsa obtains/caches the correct Keycloak public signing key.

4. passport-jwt validates:
   - JWT signature
   - token expiration
   - expected issuer
   - RS256 algorithm

5. Strategy maps token to ExternalIdentity.

6. AuthIdentityService performs a local DB lookup using issuer + subject.

7. AuthIdentityService verifies local user is active.

8. AuthIdentityService returns AuthenticatedUser with LOCAL id and LOCAL roles.

9. Passport assigns that object to request.user.

10. Role guard checks request.user.roles.

11. Controller/business service uses request.user.id for domain lookups.
```

Example:

```ts
@Get('my-bookings')
getMyBookings(@CurrentUser() user: AuthenticatedUser) {
  return this.bookingService.findByUserId(user.id);
}
```

No controller should need to know the Keycloak subject for ordinary domain work.

---

# 26. Performance

The selected design performs local JWT verification and normally requires one local user lookup per authenticated request.

Avoid calling Keycloak for every API request.

`jwks-rsa` should use key caching and request rate limiting.

If the local user lookup becomes measurable overhead later, caching can be introduced separately, but do not optimize prematurely.

Any future user cache must have a clear invalidation strategy for:

- changed roles;
- disabled users;
- deleted users.

---

# 27. Security Requirements

Implement all of the following:

- Validate JWT signature through JWKS.
- Validate `iss`.
- Validate expiration.
- Restrict accepted algorithms to `RS256`.
- Do not trust unsigned/decoded token contents.
- Do not trust roles from the browser.
- Do not trust Keycloak roles for Booking authorization.
- Do not persist user passwords in Booking DB.
- Use HTTPS outside local development.
- Keep identity-provider admin credentials server-side only.
- Never expose Keycloak admin credentials or client secrets to React.
- Public React client must not contain a client secret.
- Use Authorization Code + PKCE for React.
- Use specific redirect URIs and web origins in production.
- Reject a locally disabled user even when the external JWT is valid.

Optional hardening after the base implementation is correct:

- validate expected audience/client semantics once Keycloak token audience mapping is finalized;
- cache user resolution carefully;
- add audit logging for role changes and identity provisioning;
- add token/session revocation strategy for emergency account blocking.

---

# 28. Handling Disabled Users

A valid Keycloak JWT does not automatically mean the Booking user should have access.

During local hydration:

```ts
if (!user.isActive) {
  throw new UnauthorizedException('User is inactive');
}
```

For an administrator blocking a user:

1. mark the local Booking user inactive;
2. optionally call `identityProvider.disableUser()` to disable the identity in Keycloak as well;
3. optionally revoke Keycloak sessions where supported.

The application must still reject `isActive = false` locally, even if an already-issued access token has not expired yet.

---

# 29. Federation / LDAP Future Direction

Do not implement LDAP now unless explicitly requested.

The architecture should merely remain compatible with it.

Future flow:

```text
Active Directory / LDAP
          │
          │ Keycloak User Federation
          ▼
       Keycloak
          │
          │ standard OIDC JWT
          ▼
       Passport
          │
          ▼
 ExternalIdentity
          │
          ▼
 Booking local user + JSONB roles
```

The NestJS application should not need LDAP-specific code.

This is one of the main architectural reasons to keep identity-provider details outside business modules.

---

# 30. Testing Requirements

## Unit tests

### OIDC strategy

Test that `validate()`:

- maps OIDC claims into `ExternalIdentity`;
- delegates to `AuthIdentityService`;
- returns `AuthenticatedUser` rather than the raw JWT payload.

Do not unit-test cryptographic behavior owned by `passport-jwt`; integration-test it.

### AuthIdentityService

Test:

- existing external identity resolves to local user;
- local roles are returned;
- Keycloak realm roles are ignored;
- inactive local user is rejected;
- unknown external identity follows the chosen provisioning policy;
- first-login provisioning uses safe default local roles if enabled.

### RolesGuard

Test:

- admin local role passes `@Roles('admin')`;
- customer fails admin-only route;
- token `realm_access.roles = ['admin']` must NOT grant admin when local DB roles do not contain `admin`.

### UserProvisioningService

Test:

- external identity creation succeeds + local DB creation succeeds;
- Keycloak/external creation fails → no local row created;
- local DB creation fails after external creation → compensation is attempted;
- local roles are persisted as JSONB/application data.

## Integration tests

Test with a real/dev Keycloak container:

1. obtain a valid Keycloak access token;
2. call protected NestJS endpoint;
3. Passport accepts the token;
4. local user is loaded;
5. `/auth/me` returns local `id` and local roles;
6. expired/invalid token receives `401`;
7. valid token belonging to an inactive local user receives `401`;
8. role guard uses database role, not Keycloak realm role.

---

# 31. Migration Sequence

Implement incrementally in this order.

## Phase 1 — Local user schema

- Add/rename `externalIdentityId`.
- Prefer adding `identityIssuer` if feasible.
- Replace `isAdmin` with `roles: string[]` stored as JSONB.
- Migrate existing admin/customer data safely.

## Phase 2 — Passport authentication

- Install Passport dependencies.
- Add `OidcJwtStrategy`.
- Add generic `ExternalIdentity` and `AuthenticatedUser` interfaces.
- Add local user resolution.
- Add `OidcAuthGuard`.

## Phase 3 — Local authorization

- Refactor role/admin guards to use `request.user.roles`.
- Remove reads of `realm_access.roles` from business authorization.

## Phase 4 — Remove old Keycloak coupling

- Remove `nest-keycloak-connect` module/configuration.
- Remove old Keycloak-specific auth guard implementation.
- Remove `KeycloakTokenPayload` from shared/business code.
- Stop exposing `keycloakId` through normal business endpoints.

## Phase 5 — Identity provisioning abstraction

- Introduce `IdentityProvider` interface.
- Move Keycloak Admin REST calls into `KeycloakIdentityProvider` adapter.
- Refactor create/block/activate user flows to use local user IDs at the API boundary.
- Add compensation handling.

## Phase 6 — Remove EJS frontend simulation

- Remove `LoginController` from production auth flow.
- Remove `login.ejs` and `callback.ejs` once React login is available.
- React will use Authorization Code + PKCE.

## Phase 7 — Realm/client cleanup

- Rename/recreate browser client as `booking-web` if desired.
- Keep it public.
- Ensure PKCE S256.
- Make redirect URI and web origins match React.
- Stop relying on Keycloak application roles for Booking authorization.

---

# 32. Acceptance Criteria

The refactor is complete when all of the following are true:

- [ ] Keycloak is the only service issuing user access tokens.
- [ ] NestJS does not issue a second JWT.
- [ ] Protected endpoints accept Keycloak bearer tokens.
- [ ] Tokens are validated using Passport + `passport-jwt` + Keycloak JWKS.
- [ ] Token signature, issuer, expiration, and RS256 algorithm are validated.
- [ ] `nest-keycloak-connect` is no longer part of the authentication path.
- [ ] `request.user.id` is the local PostgreSQL `users.id`.
- [ ] `request.user.roles` comes from PostgreSQL JSONB.
- [ ] Keycloak `realm_access.roles` does not authorize Booking endpoints.
- [ ] Business controllers use local user IDs.
- [ ] Keycloak-specific IDs are confined to identity/auth infrastructure.
- [ ] User credentials/passwords exist only in the identity provider.
- [ ] Local users are linked to external identities by OIDC subject (preferably issuer + subject).
- [ ] Locally inactive users are rejected even when their Keycloak JWT is otherwise valid.
- [ ] Creating a managed user provisions both external identity and local user with partial-failure handling.
- [ ] The design supports future Keycloak federation/LDAP without changes to Booking business modules.
- [ ] EJS login/callback is no longer the final frontend authentication mechanism.
- [ ] React authentication is expected to use Authorization Code + PKCE through a standard client library.

---

# 33. Codex Implementation Instructions

When using this document in Codex, follow these rules:

1. **Inspect the existing project before editing.** Reuse its current module structure, ORM conventions, configuration service, logging, error handling, decorators, tests, and migrations where practical.
2. **Do not rewrite unrelated code.** Keep the refactor scoped to authentication, user identity linkage, roles, and affected endpoints.
3. **Do not introduce a Nest-issued JWT.** The incoming Keycloak JWT remains the bearer token for API calls.
4. **Do not copy the Skycloak tutorial verbatim.** Adapt its Passport/JWKS technique to this architecture, especially the local user hydration requirement.
5. **Do not preserve `realm_access.roles` as authorization truth.** Local PostgreSQL JSONB roles are authoritative.
6. **Do not use Keycloak-specific DTOs/types in business modules.** Map provider claims at the authentication boundary.
7. **Prefer local `userId` in controllers and service APIs.** Resolve external identity IDs inside auth/infrastructure code.
8. **Upgrade and preserve the Docker/Keycloak development setup deliberately.** Target Keycloak `26.6.3` using the compose configuration defined in this specification. Preserve the surrounding Postgres/Redis/RabbitMQ/ELK setup and do not perform unrelated infrastructure refactors.
9. **Add/update tests along with each behavior change.**
10. **Report any ambiguity before inventing security-sensitive behavior.** Especially report uncertainty around existing user creation, migration of roles, issuer URL differences between host and Docker, or the project's chosen first-login provisioning policy.
11. At completion, provide:
    - files changed;
    - packages added/removed;
    - DB migration summary;
    - environment variables added/removed;
    - Keycloak realm/client changes required;
    - commands needed to run migrations/tests;
    - any remaining manual steps.

---

# 34. Current Project Facts and Target Infrastructure

At the time of this specification:

- Keycloak is run from Docker Compose.
- The repository originally used Keycloak `24.0.4`, but the **target implementation is now Keycloak `26.6.3`**.
- Host Keycloak application port defaults to `8180`, mapped to container port `8080`.
- Keycloak management/health is available on port `9000` in local development.
- Realm name is `booking-realm`.
- Realm import is performed with `start-dev --import-realm`.
- The target Keycloak 26 compose uses `KC_BOOTSTRAP_ADMIN_USERNAME` and `KC_BOOTSTRAP_ADMIN_PASSWORD`.
- The current realm export defines a public PKCE client named `booking-api`; as part of this refactor, prefer renaming/redefining the browser client as `booking-web` so its purpose is explicit.
- The browser client remains public and uses Authorization Code + PKCE (`S256`), with no client secret.
- The current realm export includes test realm roles `admin` and `customer`, but **Booking authorization must not use those Keycloak roles as its source of truth**. Local PostgreSQL `users.roles` JSONB is authoritative.
- The current auth implementation uses `nest-keycloak-connect` and contains an EJS PKCE proof-of-concept. Both are migration inputs, not the target architecture.
- The current application already has a useful local-user synchronization concept based on Keycloak `sub`; refactor that concept behind provider-neutral OIDC identity types.
- No second application JWT is issued by NestJS. Keycloak remains the token issuer; Passport validates the Keycloak JWT and then hydrates `request.user` with the local PostgreSQL user ID and roles.

Codex should update the checked-in Docker Compose and realm configuration consistently with these target facts rather than preserving the old Keycloak 24 configuration.

---

# 35. References

Implementation approach and terminology are based on:

- Skycloak, **NestJS Authentication with Keycloak: Complete Guide**, especially **Approach 2: Custom JWT Validation with Passport**.
- NestJS official Passport/JWT documentation.
- Keycloak official JavaScript adapter documentation for the future React browser client and Authorization Code + PKCE flow.

Primary references:

- https://skycloak.io/blog/keycloak-nestjs-authentication-guide/
- https://docs.nestjs.com/recipes/passport
- https://docs.nestjs.com/security/authentication
- https://www.keycloak.org/securing-apps/javascript-adapter

