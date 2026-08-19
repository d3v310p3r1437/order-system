# mobile

Олон салбартай захиалгын систем — харилцагчийн Flutter апп (§7, §8 Phase 3a+).

## Хөгжүүлэлт

```bash
flutter pub get
dart run build_runner watch --delete-conflicting-outputs   # freezed/riverpod codegen
flutter run
flutter analyze
flutter test
```

Backend (`apps/api`) болон Docker сервисүүд (`docker compose -f
infra/docker-compose.dev.yml up -d`) урьдчилан асаалттай байх шаардлагатай.

## Backend-ийн base URL (⚠️ ЧУХАЛ)

`lib/core/network/api_base_url.dart` нь ажиллаж буй платформоос шалтгаалж
backend-ийн base URL-г автоматаар сонгодог:

| Орчин | Base URL | Учир шалтгаан |
|---|---|---|
| Android emulator | `http://10.0.2.2:3100` | Emulator-ийн `localhost` нь emulator өөрийгөө заадаг тул host машины backend рүү хандахын тулд Android-ийн тусгай `10.0.2.2` alias ашиглана |
| iOS simulator | `http://localhost:3100` | iOS simulator host машинтай сүлжээ хуваалцдаг тул шууд ажиллана |
| Жинхэнэ төхөөрөмж | `--dart-define=API_BASE_URL=...` шаардлагатай | Emulator/simulator-ийн alias ажиллахгүй тул host компьютерийн LAN IP-г тодорхой зааж өгнө |

Жишээ (жинхэнэ төхөөрөмж эсвэл өөр порт ашиглах бол):

```bash
flutter run --dart-define=API_BASE_URL=http://192.168.1.5:3100
```

Backend-ийн анхдагч порт `3100` (`apps/api/.env`-ийн `PORT` — CLAUDE.md-ийг үз).

## Token хадгалалт

Access/refresh JWT-г `flutter_secure_storage`-аар OS-ийн Keychain (iOS)/
Keystore (Android)-д хадгална — учир шалтгааныг
`docs/adr/008-mobile-token-storage.md`-ээс үз (admin-web-ийн in-memory
загвараас (ADR 004) яагаад ялгаатай эсэхийг тайлбарласан).

## Фолдер бүтэц

```
lib/
├── app/            # MaterialApp.router, go_router, эхлэл дэлгэц
├── core/
│   ├── theme/      # admin-web-ийн cobalt-indigo палеттай тохирсон Material 3 theme
│   ├── network/    # Dio ApiClient, алдааны бүтэц
│   └── storage/    # SecureTokenStorage
└── features/
    ├── auth/       # Нэвтрэлт/бүртгэл (Phase 0-д хэрэгжсэн)
    ├── catalog/    # (дараагийн Phase)
    ├── cart/       # (дараагийн Phase)
    ├── orders/     # (дараагийн Phase)
    ├── returns/    # (дараагийн Phase)
    └── profile/    # (дараагийн Phase)
```
