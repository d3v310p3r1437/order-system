// §6.2: Custom (харилцагч) JWT-ийн тогтмол iss claim. Keycloak талын
// iss нь динамик (`${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}`) тул энд биш,
// TokenVerifierService дотор шууд тооцно.
export const CUSTOMER_JWT_ISSUER = 'order-system-customer-auth';

export type JwtTokenType = 'access' | 'refresh';
