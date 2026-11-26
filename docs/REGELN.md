# Hnefatafl - Vollständige Regeldokumentation

Ein asymmetrisches Strategie-Brettspiel der Wikinger (auch "Wikinger-Schach" genannt).

---

## 📋 Inhaltsverzeichnis

1. [Spielübersicht](#spielübersicht)
2. [Spielfeld & Aufstellung](#spielfeld--aufstellung)
3. [Bewegungsregeln](#bewegungsregeln)
4. [Schlag-Mechaniken](#schlag-mechaniken)
5. [Spezielle Felder](#spezielle-felder)
6. [Gewinnbedingungen](#gewinnbedingungen)
7. [Turnusregeln](#turnusregeln)
8. [Strategie-Tipps](#strategie-tipps)

---

## Spielübersicht

### Grundkonzept
- **Asymmetrisches Spiel**: Eine Seite (Verteidiger) hat ein starkes Stück (König), die andere (Angreifer) hat Zahlenvorteil
- **Ziel der Verteidiger**: König in eine Ecke bringen → Flucht
- **Ziel der Angreifer**: König umzingeln und gefangen nehmen

### Basisdaten
| Aspekt | Detail |
|--------|--------|
| **Spielfeld** | 11 × 11 Felder |
| **Angreifer** | 24 rote Soldaten |
| **Verteidiger** | 12 blaue Soldaten + 1 König |
| **Zugfolge** | Angreifer beginnt |
| **Zugtyp** | Abwechselnd, ein Zug pro Spieler |

---

## Spielfeld & Aufstellung

### Das Spielfeld

```
     0   1   2   3   4   5   6   7   8   9  10
   +---+---+---+---+---+---+---+---+---+---+---+
 0 |   |   |   | A | A | A | A | A |   |   |   |
   +---+---+---+---+---+---+---+---+---+---+---+
 1 |   |   |   |   |   | A |   |   |   |   |   |
   +---+---+---+---+---+---+---+---+---+---+---+
 2 |   |   |   |   |   |   |   |   |   |   |   |
   +---+---+---+---+---+---+---+---+---+---+---+
 3 | A |   |   |   |   | D |   |   |   |   | A |
   +---+---+---+---+---+---+---+---+---+---+---+
 4 | A |   |   |   | D | D | D |   |   |   | A |
   +---+---+---+---+---+---+---+---+---+---+---+
 5 | A | A |   | D | D | K | D | D |   | A | A |
   +---+---+---+---+---+---+---+---+---+---+---+
 6 | A |   |   |   | D | D | D |   |   |   | A |
   +---+---+---+---+---+---+---+---+---+---+---+
 7 | A |   |   |   |   | D |   |   |   |   | A |
   +---+---+---+---+---+---+---+---+---+---+---+
 8 |   |   |   |   |   |   |   |   |   |   |   |
   +---+---+---+---+---+---+---+---+---+---+---+
 9 |   |   |   |   |   | A |   |   |   |   |   |
   +---+---+---+---+---+---+---+---+---+---+---+
10 |   |   |   | A | A | A | A | A |   |   |   |
   +---+---+---+---+---+---+---+---+---+---+---+

A = Angreifer  |  D = Verteidiger  |  K = König (Thron, Mitte)  |  Ecken: Fluchtfelder
```

### Anfangsaufstellung

**Angreifer (Rot) - 24 Stück:**
- 4 Gruppen an den Kanten (oben, unten, links, rechts)
- Pro Gruppe: 6 Soldaten in symmetrischer Formation
- Gruppe verteilt als: 1 Soldat zur Mitte, 5 auf der Kante

**Verteidiger (Blau) - 12 Stück + König:**
- König auf dem Thron (Mittelpunkt: Feld [5,5])
- 12 Soldaten in Rautenformation um den König herum
- Anordnung: 1 oben, 1 unten, 1 links, 1 rechts vom König
- + zusätzlich 2 diagonal dazwischen auf jeder Seite

**Spezielle Felder:**
- 🏰 **Thron** (5,5): Nur der König darf hier stehen
- 👑 **4 Ecken** (0,0), (0,10), (10,0), (10,10): Nur der König darf hier stehen

---

## Bewegungsregeln

### Allgemeine Zugbestimmungen

1. **Bewegungsart**: Alle Figuren (Soldaten + König) bewegen sich **wie Türme im Schach**
   - Beliebig viele Felder horizontal oder vertikal
   - **Keine Diagonalbewegung**
   - **Keine Figuren überspringen**

2. **Zielfeld**: 
   - Muss leer sein
   - König: darf Thron und Ecken betreten
   - Soldaten: dürfen Thron und Ecken **nicht** betreten, können aber den leeren Thron durchqueren

3. **Zugvalidation**:
   - Ein Spieler muss immer einen legalen Zug machen
   - Ein Zug muss die Figur bewegen (kein "Passen")
   - Wenn kein legaler Zug existiert → Spieler verliert

---

## Schlag-Mechaniken

### 1. Standard-Schlag (Custodial Capture)

**Prinzip**: Eine Figur wird gefangen, wenn sie zwischen zwei gegnerische Figuren gerät.

**Bedingungen für Soldaten:**
- Eine gegnerische Figur sitzt zwischen zwei deiner Figuren
- Alle drei müssen in einer Reihe (horizontal oder vertikal) sein
- Der gegnerische Zug muss die "Zange" schließen (nicht freiwilliges Einzug-Opfer ist sicher)
- **Mehrfachschläge**: Ein Zug kann mehrere Soldaten in verschiedenen Richtungen schlagen

**Beispiel:**
```
Vorher:        Nachher:
D . A   →      D . A
            (Zug A nach links)
            Der Soldat zwischen D und A wird geschlagen
```

### 2. König-Schlag (Royal Capture)

**Der König wird schärfer bewacht als gewöhnliche Soldaten!**

**Bedingungen zum Fangen des Königs:**
- Angreifer besetzen **alle 4 orthogonalen Nachbarfelder** des Königs
  - Oben, Unten, Links, Rechts (nicht diagonal)
  
**Ausnahmen:**
- **Neben dem Thron**: Nur 3 Nachbarfelder + der Thron zählen als vierte Mauer
- **Am Spielfeldrand**: König kann **nicht** gefangen werden, wenn er am Rand steht
- **König ist bewaffnet**: Der König zählt als eine der beiden "Zangen" beim Standard-Schlag gegen Soldaten

### 3. Rand-Schlag (Edge Capture)

**Spezielle Regel für Reihen an der Kante:**

- Eine Reihe von **2 oder mehr** Soldaten auf der Spielfeldkante kann geschlagen werden
- **Bedingungen:**
  - Beide Enden der Reihe sind von gegnerischen Figuren umgeben
  - **Jeder** Soldat in der Reihe hat einen gegnerischen Soldat direkt daneben (auf dem angrenzenden Feld)
  - Eine Ecke kann als ein Bracketing-Stück zählen

**Beispiel:**
```
Kante:  A D D D D A  →  A . . . . A
        (Alle Verteidiger-Soldaten in der Reihe werden geschlagen)
```

---

## Spezielle Felder

### Der Thron [5,5]

| Eigenschaft | Detail |
|------------|--------|
| **Besitzer** | Nur König kann stehen |
| **Für Angreifer** | "Feindselig" - fungiert als Mauer beim König-Schlag (als 4. Seite) |
| **Für Verteidiger** | Nur "feindselig" wenn der König nicht darauf steht |
| **Durchqueren** | Verteidiger-Soldaten können den leeren Thron durchqueren |

### Die 4 Ecken [0,0], [0,10], [10,0], [10,10]

| Eigenschaft | Detail |
|------------|--------|
| **Besitzer** | Nur König kann stehen/betreten |
| **Für Verteidiger** | **ZIEL** - wenn der König auf einer Ecke steht → Verteidiger gewinnen |
| **Für Angreifer** | Muss mit Truppen blockiert werden, um König-Flucht zu verhindern |

---

## Gewinnbedingungen

### 🎯 Verteidiger gewinnen wenn:

1. **Ecken-Flucht**: König steht auf einem Ecken-Feld [0,0], [0,10], [10,0] oder [10,10]
   - Sofortiger Sieg
   - König muss nur das Feld betreten (nicht "ausbrechen")

2. **Ausstiegs-Fort** (Exit Fort):
   - König steht auf der Spielfeldkante und kann sich bewegen
   - Die für ihn erreichbaren leeren Felder sind nur von Verteidigern und dem Spielfeldrand umschlossen (kein Angreifer grenzt an)
   - Kein umschließender Verteidiger kann geschlagen werden (auf jeder Achse schützt ihn ein Verteidiger, der König, ein Feld im Fort oder der Brettrand)
   - Sofortiger Sieg der Verteidiger (geprüft nach jedem Zug)

3. **Angreifer-Stalemate**: 
   - Angreifer haben keinen legalen Zug möglich
   - Verteidiger gewinnen

4. **Wiederholungsregel**: 
   - Ein Zug, der dieselbe Position (inkl. Zugrecht) zum dritten Mal herstellen würde, ist verboten. Hat ein Spieler nur noch solche Züge, gilt er als zugunfähig und verliert (kein Remis).

### 💀 Angreifer gewinnen wenn:

1. **König-Fang**: König wird nach den Schlag-Regeln gefangen
   - Sofortiger Sieg

2. **Umzingelung/Encirclement**:
   - Angreifer bilden einen geschlossenen Ring um **alle Verteidiger** (inkl. König)
   - Kein Verteidiger kann aus diesem Ring ausbrechen
   - Sieg auch ohne direkten König-Fang

3. **Verteidiger-Stalemate**: 
   - Verteidiger haben keinen legalen Zug möglich
   - Angreifer gewinnen

4. **Wiederholung**: 
   - Siehe oben: dritte Wiederholung ist verboten, es gibt kein Remis.

---

## Turnusregeln

### Standard Turnusablauf

```
1. Angreifer machen einen Zug
   ↓
2. System prüft auf Schläge und führt sie aus
3. System prüft auf Gewinnbedingungen
   ↓
4. Verteidiger machen einen Zug
   ↓
5. System prüft auf Schläge und führt sie aus
6. System prüft auf Gewinnbedingungen
   ↓
7. Zurück zu Schritt 1
```

### Zugvalidation

Ein Zug ist **illegal** wenn:
- Die Figur sich nicht bewegt
- Das Zielfeld besetzt ist
- Eine Figur übersprungen werden muss
- Ein König auf Thron/Ecke landet (wenn nicht legal)
- Ein Soldat auf Thron/Ecke landet

---

## Strategie-Tipps

### Für Angreifer:

1. **Ring bilden**: Baue einen Kreis um den König
   - Lücken im Ring erlauben Flucht
   - Kontinuierlich verengen

2. **Nicht jagen**: Vergiss einzelne Verteidiger-Soldaten
   - Konzentriere Dich auf den König

3. **Ecken blockieren**: Platziere Truppen um die Ecken
   - Verhindere die einfachste Flucht

4. **Wall-Bildung**: Nutze Reihen an der Kante zum Schlag
   - Reduziert Verteidiger-Zahlen

### Für Verteidiger:

1. **König schützen**: Halte Soldaten um den König
   - Bildet eine defensive Schale

2. **Zu den Ecken**: Jede Bewegung zum Rand/Ecke ist Vorteil
   - Am Rand kann König nicht gefangen werden

3. **Ecken anstreben**: Der König gewinnt sofort, sobald er eine Ecke erreicht
   - Auch ein Ausstiegs-Fort auf der Kante bringt den Sieg

4. **Formation halten**: Bleibe zusammenhängend
   - Verstreute Truppen werden einzeln geschlagen

---

## Gameplay-Varianten

### Tablut (7×7 kleinere Version)
- 8 Angreifer vs. 4 Verteidiger + König
- Schneller, für Anfänger
- Gleiche Regeln

### Brandubh
- Irische Variante, 7×7
- 9 Angreifer vs. 5 Verteidiger + König

### Regelvarianten

Einige Varianten verwenden:
- Schwächerer König (leichter zu fangen)
- Rand-Escape statt Ecken-Escape
- Verschiedene Zahlenverhältnisse

**Für unser Projekt nutzen wir: Copenhagen Hnefatafl (Standard)**

---

## Implementierungs-Checkliste für Engine

### Zu implementieren:

- [ ] Board-Datenstruktur (11×11)
- [ ] Piece-Klassen (Soldier, King)
- [ ] Movement-Validierung
- [ ] Capture-Detection (Standard, King, Edge)
- [ ] Special-Field-Handling (Thron, Ecken)
- [ ] Win-Condition-Checker
  - [ ] Corner-Escape
  - [x] Exit-Fort
  - [ ] King-Capture
  - [ ] Encirclement
  - [ ] Stalemate
- [ ] Turn-Management
- [ ] Move-History / Undo (optional)
- [ ] Position-Hashing (für Wiederholungs-Erkennung)

---

## Ressourcen

- **Copenhagen Hnefatafl Rules**: https://hnefataflgame.com/copenhagen-hnefatafl-rules/
- **Norse Alley Guide**: https://norsealley.com/blogs/updates/what-are-the-rules-of-hnefatafl
- **Hnefatafl Game Official**: https://hnefataflgame.com/

---

**Versión**: 1.0  
**Letztes Update**: 2026-11-26  
**Regelvariante**: Copenhagen Hnefatafl (Standard 11×11)
