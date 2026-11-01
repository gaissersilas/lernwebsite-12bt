# Lernwebsite 12BT

Statische Lern-Website der Klasse 12BT (BOS Technik, Schuljahr 2026/27): Termine der Leistungsnachweise, Ferien, Fachabitur-Termine und Übungsaufgaben je Fach.

**Website:** https://gaissersilas.github.io/lernwebsite-12bt/

## Für die Klasse
- **Start** zeigt die aktuellen Prioritäten: die nächsten Leistungsnachweise ab heute (Zeitzone Europe/Berlin), gewichtet (Schulaufgabe/Fachabitur vor Kurzarbeit), mit Countdown, Themen und passenden Übungsaufgaben.
- **Lernräume** (F, Ph, M, GPuG, K, D, C, E, Te, M+T): Termine des Fachs und Übungsaufgaben zum Anklicken – Antwort wählen, prüfen, Lösung mit Quelle aufklappen.
- **Vokabeltrainer** (derzeit F, später E): nur aus dem Vokabelteil des Schulbuchs. Lektionen wählen, Richtung FR→DE / DE→FR, anklicken oder eintippen; Quelle (Buch, Seite, Lektion) und Beispiel/Anmerkung aus dem Buch; Fortschritt bleibt im Browser (localStorage). Direktlink: `#/fach/F/vokabeln`.
- **Über**: Klassen-README (`docs/README.md`).

Angaben ohne Gewähr – maßgeblich ist die Schul-App.

## Für die Bots (Pflege)
Reines HTML/CSS/JS, kein Build-Schritt. GitHub Pages: Branch `main`, Ordner `/` (root).

| Pfad | Inhalt | Pflege |
|---|---|---|
| `data/termine.json` | Termine (Leistungsnachweise, Ferien, Fachabitur) und Fächer (Schema siehe LIESMICH im Lernwebsite-Ordner, schema_version 1) | **Sekretär** |
| `assets/app.js` → Funktion `start()` | Startseitenlogik (Prioritäten, Gewichtung, Countdown) | **Sekretär** |
| `data/aufgaben/<slug>.json` | Übungsaufgaben je Fach (`id, fach, thema, buch, seite, aufgabe_nr, wortlaut, antwortoptionen[], richtige_option, loesung, loesung_quelle, termin_ids[]`) | **Nachhilfelehrer** |
| `data/vokabeln/<slug>.json` | Vokabeln je Fremdsprache aus dem Vokabelteil des Schulbuchs (`buch`, `lektionen[]`, `eintraege[] = {id, lektion, seite, ausdruck, uebersetzung, beispiel_anmerkung, beispiele[], abfragbar, hinweis_zu}`; `abfragbar: false` = Hinweis-Kasten des Buchs). Trainer: `assets/vokabeltrainer.js`; aktiv mit `vokabeln_vorhanden: true` (+ `vokabeln_sprache`, `vokabeln_sprache_kurz`) in `data/faecher.json` | **Nachhilfelehrer** |
| `data/faecher.json` | Index Fachkürzel → URL-sicherer Dateiname (`M+T` → `M_T`), `aufgaben_vorhanden` | Sekretär (bei neuer Aufgabendatei `aufgaben_vorhanden: true` setzen) |
| `docs/README.md` | Klassen-README für die Seite „Über“ | Sekretär |
| `assets/style.css` | Layout und Fach-Themes (`.theme-<slug>`) | – |

Regeln:
- `data/termine.json` ist eine **öffentliche Kopie**: keine Lehrervollnamen (nur Kürzel), keine privaten Einträge, keine Drive-Links. Die Website verlinkt den Hefteinträge-Ordner nicht.
- **Kein Stundenplan öffentlich** (nicht für alle in der Klasse gleich): `stundenplan`, `stundenplan_ausnahmen`, `stundenraster` und Stundenplan-Änderungen gehören nicht ins Repo und nicht auf die Website.
- **Keine Uhrzeit, kein Raum öffentlich** (verraten den Stundenplan): Felder `uhrzeit` und `raum` werden beim Sync entfernt; nur das Datum erscheint.
- `themen_vermutet` (+ `themen_vermutet_quelle`): vermutete, noch nicht bestätigte Themen; die Website zeigt sie getrennt als „vermutet (noch nicht bestätigt)“.
- Einträge mit `status: "termin_offen"` (Datum `null`) erscheinen als „Termin folgt“.
- Aufgaben werden einem Termin über `termin_ids` zugeordnet (zusätzlich über `themen` ↔ `thema`).
- Fehlt eine Aufgabendatei, zeigt der Lernraum „Aufgaben folgen“.

Lokal testen: `python3 -m http.server` im Repo-Ordner, dann http://localhost:8000/ öffnen.
