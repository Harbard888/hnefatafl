# Hnefatafl

Digitale Umsetzung des Wikinger-Strategiespiels Hnefatafl (Copenhagen-Regeln, 11 × 11).

- Zwei Spieler oder gegen den Computer (Standard: Computer spielt die Verteidiger, die Seite ist wählbar)
- Oberfläche auf Deutsch und Englisch (Standard: Browsersprache)
- Verfügbar als Web-Anwendung und als Windows-Installer

## Umgesetzte Regeln

Die vollständigen Regeln stehen in [docs/REGELN.md](docs/REGELN.md).

- Alle Figuren ziehen wie Türme im Schach. Kein Überspringen.
- Soldaten dürfen Thron und Ecken nicht betreten. Der König darf beides.
- Schlagen durch Einschließen zwischen zwei Figuren. Der König ist bewaffnet.
- Der König wird gefangen, wenn er auf allen vier Seiten umschlossen ist. Am Spielfeldrand ist er nicht fangbar.
- Der leere Thron wirkt feindlich.
- Gewinn: König erreicht eine Ecke (Verteidiger) oder wird gefangen bzw. umzingelt (Angreifer). Wer keinen legalen Zug hat, verliert.
- Ausstiegs-Fort ist nicht umgesetzt.
- Dieselbe Stellung darf nicht zum dritten Mal entstehen. Der entsprechende Zug ist verboten.

## Starten

### Web (Entwicklung)

```
cd packages/backend
npm install
npm run build
npm start            # API auf Port 3001

cd ../web
npm install
npm run dev          # Oberfläche mit Proxy auf die API
```

### Web (Docker)

```
docker build -t hnefatafl .
docker run -p 3001:3001 hnefatafl
```

Danach ist das Spiel unter http://localhost:3001 erreichbar.

### Desktop (Windows)

```
cd packages/desktop
npm install
npm run dist         # erzeugt release/Hnefatafl Setup 0.1.0.exe
```

Der Installer ist nicht signiert. Windows SmartScreen zeigt deshalb beim ersten Start eine Warnung.

## Tests

- Core-Engine: `npm test` in `packages/core-engine`
- Backend: `npm test` in `packages/backend`
- Web (Übersetzungen): `npm test` in `packages/web`

## Aufbau

| Paket | Inhalt |
|-------|--------|
| `packages/core-engine` | Spielregeln, Zugprüfung, KI (Minimax mit Alpha-Beta) |
| `packages/backend` | Express-API für Spiele und Züge |
| `packages/web` | React-Oberfläche (Vite) |
| `packages/desktop` | Electron-App, startet Backend und Oberfläche lokal |
