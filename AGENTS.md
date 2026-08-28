# AGENTS.md — Projektregeln für Codex / Claude Code

## Was das hier ist

Frontend-Dashboard zur **Darstellung** von Prozessdaten und Anomalieerkennungs-
Ergebnissen eines Sechs-Zonen-Stoßofens. Nuxt 4 · Nuxt UI 4 · Unovis · TypeScript,
Paketmanager **pnpm**. Oberfläche durchgehend deutsch.

Das Dashboard rechnet **nichts** — kein Training, keine Modelle. Es lädt genau
**eine** CSV, erkennt an den Spalten den Modus und stellt dar. Die Modelle und die
echte Aufbereitungspipeline liegen im Nachbar-Repo `../STO_ML_Project`.

## Zuerst lesen

1. `Claude.md` — verbindliche Spezifikation (Spaltenvertrag §2, Layout §4, Sidebar §5,
   Hauptbereich §6, Interaktion §7, Leerzustände §8, Datenschicht §9, Nuxt-UI-Fallstricke §10).
2. `README.md` — Funktionsstand und Einstieg (auch für die nicht-Frontend-Kollegin gedacht).
3. Diese Datei.

## Stand des Projekts (Stand: 2026-08-28)

Umgesetzt und mit `pnpm lint`/`typecheck`/`build` grün:

- CSV-Import in der Navbar (Modal, Drag & Drop, Fortschritt), streamendes Parsen
  großer Dateien, Blob-Persistenz in IndexedDB, Ausdünnung ab ~800 000 Zeilen.
- Prozess- und Analysemodus, automatisch an den Spalten erkannt.
- Sidebar: Modell / Zone 1–6 / Phase / Mehrfach-Signalauswahl (zonenabhängig).
- KPIs (Events gesamt, Anomalieanteil %, Anomaliedauer), Temperaturverlauf mit
  Mehrfachsignalen und bis zu zwei Y-Achsen, Anomalie-Score-Panel, Ereignisliste.
- Verknüpfte Interaktion Liste ↔ Plot ↔ Zoom (ein Zustand in `useChartInteraction`).
- Bericht: CSV-Export der gefilterten Rohzeilen + Druck-/PDF-Ansicht.
- Hell/Dunkel, deutsche Formate, alle Leerzustände mit Text.

Offen / mit Vorsicht:

- **Es gibt noch keine echte CSV mit Modellergebnissen.**
  `sample-data/furnace_dashboard_demo_analyse.csv` hat **synthetische** `score_svm_*`/
  `flag_svm_*` (nur SVM, Zone 1). Beim ersten echten Datensatz kann sich zeigen,
  dass Annahmen in der Datenschicht nachgezogen werden müssen.
- **`app/utils/signals.ts`, `app/composables/useFurnaceData.ts` und
  `scripts/prepare_dashboard_data.py` sind von einem Agenten generiert**, weil die
  Vorlagen der ML-Seite noch nicht vorlagen. `Claude.md` tut so, als seien sie fertig.
  Die ML-Kollegin darf sie an die echte Pipeline anpassen — nicht als unantastbar behandeln.
- Die interaktiven Unovis-Charts (Bandklick → Zoom, Brush, Tooltip) sowie
  CSV-Download und Drucklayout wurden noch **nicht in einem echten Browser** geprüft.

### Bewusste Abweichungen von `Claude.md`

- CSV-Import sitzt in der **oberen Leiste**, nicht in der Sidebar (§5.1).
- **Zone 1–6 immer wählbar**, nicht nur die in der Datei vorhandenen; Zonen ohne
  Daten zeigen im Plot einen Hinweis.
- Große Dateien: streamendes Zwei-Pass-Parsen + Ausdünnung (`MAX_ROWS` in
  `useFurnaceData.ts`) statt synchronem Parsen.

## Architektur in Kürze

- **Eine geparste Tabelle**, spaltenweise als `Float64Array` (`useFurnaceData.ts`).
  Einmal parsen, danach sind Zonen-/Signal-/Phasenwechsel billig. `shallowRef`,
  **keine tiefen reaktiven Kopien der Rohdaten**.
- Zugriff auf Spalten **ausschließlich über Spaltennamen**, nie über Indizes.
- Plot-Serien über LTTB auf ~2000 Punkte reduziert; beim Zoomen mit `from`/`to`
  erneut abfragen statt im Frontend zu filtern.
- Auswahl (Modell/Zone/Phase/Signale) in `useFurnaceSelection.ts`, gegen die
  geladene Datei abgeglichen, in `localStorage` gehalten.
- Ereignis ↔ Plot ↔ Zoom teilen sich **einen** Zustand (`useChartInteraction.ts`).
- Charts sind client-only: `*.client.vue` mit `*.server.vue`-Platzhalter.

## Konventionen

- **Nuxt-UI-Komponenten (`U*`) verwenden**, wo es eine gibt — keine handgebauten
  Ersatz-Dropdowns/Modals/Buttons.
- Oberfläche deutsch; Zahlen/Daten/Dauern über die Helfer in `app/utils/format.ts`
  (de-DE, Dezimalkomma).
- Jeder Leerzustand bekommt eigenen, erklärenden Text (`UEmpty`).
- Prozessmodus muss **vollständig ohne** Modellspalten funktionieren.
- Keine externen Datenübertragungen, keine Cloud-Uploads, keine Secrets im Code.
- Rohdaten / Beispiel-CSVs nicht verändern oder überschreiben.
- Änderungen klein, nachvollziehbar, modular. Getroffene Annahmen im Code
  kommentieren oder in der Antwort nennen.

## Pflicht: README aktuell halten

Sobald ein Feature **hinzugefügt, geändert oder entfernt** wird, im selben Schritt
den Abschnitt **„Aktuelle Features"** in `README.md` anpassen (und, falls betroffen,
„Projektaufbau" und die Betriebsarten-Tabelle). Neue Abweichungen von `Claude.md`
gehören in den Abschnitt oben in dieser Datei.

## Vor Abschluss einer Aufgabe prüfen

```bash
pnpm lint
pnpm typecheck
pnpm build
```

Alle drei müssen grün sein. Zusätzlich:

- Kein Zugriff über Spaltenindizes.
- NaN / fehlende Werte robust behandelt.
- Prozessmodus weiterhin ohne Modellspalten nutzbar.
- Neue Leerzustände haben Text.
- `README.md`-Featureliste angepasst, falls Features betroffen.
