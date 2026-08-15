#!/usr/bin/env bash
# infra/keycloak/setup-realm.sh
#
# docs/plan.md §6.2 — ажилтны (Keycloak) auth замд зориулсан realm/client-ыг
# idempotent байдлаар бэлтгэнэ. Дахин ажиллуулахад аль хэдийн байгаа зүйлийг
# дахин үүсгэхгүй, зөвхөн дутуу хэсгийг нэмнэ.
#
# Хийх зүйл:
#   1. "$KEYCLOAK_REALM" (өгөгдмөл: order-system) realm үүсгэнэ
#   2. "api-client" client үүсгэнэ: confidential (public биш), Standard Flow
#      унтраалттай, Direct Access Grants (Resource Owner Password) идэвхтэй —
#      ажилтны custom login дэлгэц grant_type=password-оор шууд токен авна
#   3. Realm-ийн User Profile-д "local_user_id" attribute нэмнэ (зөвхөн admin
#      харах/засах эрхтэй — ажилтан өөрөө засаж чадахгүй)
#   4. "api-client"-д "local_user_id" user-attribute protocol mapper нэмж,
#      ID/access/userinfo token бүрт claim болгож оруулна
#   5. Client secret-ийг apps/api/.env-д KEYCLOAK_CLIENT_SECRET болгож бичнэ
#
# Ашиглалт: ./infra/keycloak/setup-realm.sh
# (docker compose -f infra/docker-compose.dev.yml up -d keycloak ажиллаж
#  байгаа эсэхийг өмнө нь шалгана)
#
# Шинэ ажилтныг DB+Keycloak-д хэрхэн бүртгэх вэ (admin гараар хийнэ,
# self-signup биш — docs/adr/002-jwt-identity-only-authorization-from-db.md):
#   1. apps/api талд users мөр үүсгэж (authProvider=KEYCLOAK), UUID-г тэмдэглэ
#   2. Keycloak дээр тухайн ажилтны хэрэглэгчийг үүсгэж, "local_user_id"
#      attribute-д яг тэр UUID-г тавь (firstName/lastName заавал бөглөнө,
#      эс бөгөөс realm-ийн User Profile validation "Account is not fully
#      set up" алдаа өгнө)
#   3. user_branch_roles мөр(үүд) нэмж, эрхийг нь тохируулна

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# Git Bash-ийн MSYS_NO_PATHCONV=1 (доор kcadm() дотор container-ий /opt/...
# зам гажигдахаас сэргийлж ашигладаг) нь абсолют "/d/..." замыг docker.exe-д
# буруу хөрвүүлдэг (жиш: "D:\d\Projects\..."). Тиймээс энд cd хийгээд,
# docker compose-д зөвхөн relative зам өгнө.
cd "$ROOT_DIR"
ENV_FILE="apps/api/.env"
COMPOSE_FILE="infra/docker-compose.dev.yml"
KEYCLOAK_SERVICE="keycloak"
CLIENT_ID="api-client"
# kcadm.sh нь Keycloak контейнер дотор ажилладаг тул localhost:8080 бол
# контейнерийн ӨӨРИЙНХ нь порт (host-оос дуудах KEYCLOAK_URL-тай андуурч болохгүй)
KC_INTERNAL_URL="http://localhost:8080"

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source <(grep -E '^(KEYCLOAK_ADMIN|KEYCLOAK_ADMIN_PASSWORD|KEYCLOAK_REALM)=' "$ENV_FILE")
  set +a
fi

KEYCLOAK_ADMIN="${KEYCLOAK_ADMIN:-admin}"
: "${KEYCLOAK_ADMIN_PASSWORD:?KEYCLOAK_ADMIN_PASSWORD тодорхойгүй байна (apps/api/.env шалгана уу)}"
KEYCLOAK_REALM="${KEYCLOAK_REALM:-order-system}"

kcadm() {
  MSYS_NO_PATHCONV=1 docker compose -f "$COMPOSE_FILE" exec -T "$KEYCLOAK_SERVICE" \
    /opt/keycloak/bin/kcadm.sh "$@"
}

echo "==> Keycloak admin-аар нэвтэрч байна ($KC_INTERNAL_URL)..."
kcadm config credentials --server "$KC_INTERNAL_URL" --realm master \
  --user "$KEYCLOAK_ADMIN" --password "$KEYCLOAK_ADMIN_PASSWORD" >/dev/null

echo "==> Realm '$KEYCLOAK_REALM' шалгаж байна..."
if kcadm get "realms/$KEYCLOAK_REALM" >/dev/null 2>&1; then
  echo "    аль хэдийн байна, алгасав"
else
  kcadm create realms -s realm="$KEYCLOAK_REALM" -s enabled=true >/dev/null
  echo "    үүсгэв"
fi

echo "==> Client '$CLIENT_ID' шалгаж байна..."
CLIENT_UUID="$(kcadm get clients -r "$KEYCLOAK_REALM" -q clientId="$CLIENT_ID" \
  --fields id --format csv --noquotes 2>/dev/null | tr -d '\r')"
if [ -n "$CLIENT_UUID" ]; then
  echo "    аль хэдийн байна ($CLIENT_UUID), алгасав"
else
  kcadm create clients -r "$KEYCLOAK_REALM" \
    -s clientId="$CLIENT_ID" \
    -s publicClient=false \
    -s standardFlowEnabled=false \
    -s directAccessGrantsEnabled=true \
    -s serviceAccountsEnabled=false \
    -s enabled=true >/dev/null
  CLIENT_UUID="$(kcadm get clients -r "$KEYCLOAK_REALM" -q clientId="$CLIENT_ID" \
    --fields id --format csv --noquotes | tr -d '\r')"
  echo "    үүсгэв ($CLIENT_UUID)"
fi

echo "==> User Profile дэх 'local_user_id' attribute шалгаж байна..."
HAS_ATTR="$(kcadm get "realms/$KEYCLOAK_REALM/users/profile" 2>/dev/null \
  | grep -c '"name" : "local_user_id"' || true)"
if [ "$HAS_ATTR" -gt 0 ]; then
  echo "    аль хэдийн байна, алгасав"
else
  kcadm update "realms/$KEYCLOAK_REALM/users/profile" \
    -s 'attributes+={"name":"local_user_id","displayName":"Local User ID (apps/api users.id)","permissions":{"view":["admin"],"edit":["admin"]},"multivalued":false}' >/dev/null
  echo "    нэмэв"
fi

echo "==> Protocol mapper 'local_user_id' шалгаж байна..."
HAS_MAPPER="$(kcadm get "clients/$CLIENT_UUID/protocol-mappers/models" -r "$KEYCLOAK_REALM" \
  --fields name --format csv --noquotes 2>/dev/null | grep -c '^local_user_id$' || true)"
if [ "$HAS_MAPPER" -gt 0 ]; then
  echo "    аль хэдийн байна, алгасав"
else
  kcadm create "clients/$CLIENT_UUID/protocol-mappers/models" -r "$KEYCLOAK_REALM" \
    -s name=local_user_id \
    -s protocol=openid-connect \
    -s protocolMapper=oidc-usermodel-attribute-mapper \
    -s 'config."user.attribute"=local_user_id' \
    -s 'config."claim.name"=local_user_id' \
    -s 'config."jsonType.label"=String' \
    -s 'config."id.token.claim"=true' \
    -s 'config."access.token.claim"=true' \
    -s 'config."userinfo.token.claim"=true' >/dev/null
  echo "    үүсгэв"
fi

echo "==> Client secret авч, .env-д бичиж байна..."
CLIENT_SECRET="$(kcadm get "clients/$CLIENT_UUID/client-secret" -r "$KEYCLOAK_REALM" \
  --fields value --format csv --noquotes | tr -d '\r')"

if [ -f "$ENV_FILE" ] && grep -q '^KEYCLOAK_CLIENT_SECRET=' "$ENV_FILE"; then
  awk -v secret="$CLIENT_SECRET" '
    /^KEYCLOAK_CLIENT_SECRET=/ { print "KEYCLOAK_CLIENT_SECRET=" secret; next }
    { print }
  ' "$ENV_FILE" > "$ENV_FILE.tmp" && mv "$ENV_FILE.tmp" "$ENV_FILE"
else
  {
    echo ""
    echo "# --- Keycloak client (infra/keycloak/setup-realm.sh автоматаар бичсэн) ---"
    echo "KEYCLOAK_CLIENT_SECRET=$CLIENT_SECRET"
  } >> "$ENV_FILE"
fi
echo "    KEYCLOAK_CLIENT_SECRET бичигдлээ ($ENV_FILE)"

echo "==> Бүгд бэлэн. Realm: $KEYCLOAK_REALM, Client: $CLIENT_ID"
