# Beispieldaten

Beide Dateien sind mit `scripts/prepare_dashboard_data.py` aus dem Rohexport der
Anlage erzeugt. Sie dienen der Entwicklung; die ML-Seite liefert später echte
Dateien im selben Format (Spaltenvertrag: `Claude.md` §2).

## `furnace_dashboard.csv` — Prozessmodus

999 Zeilen, entspricht dem realen Referenzauszug (`../erstentausendDaten.txt`),
komplett in Phase `hold`. Keine Modellergebnisse → das Dashboard zeigt nur
Signalauswahl und Zeitverlauf.

```
python3 scripts/prepare_dashboard_data.py erstentausendDaten.txt \
  -o sample-data/furnace_dashboard.csv
```

## `furnace_dashboard_demo_analyse.csv` — Analysemodus

Zone-1-Zyklus 1 (Aufheizen → Halten → Abkühlen), auf 2-s-Raster reduziert,
mit `cycle`/`phase` aus der Segmentierungs-CSV der ML-Seite.

**Die `score_svm_*`- / `flag_svm_*`-Spalten sind synthetisch** (`--synth-scores`,
abgeleitet aus der lokalen Volatilität des Istwerts) und **nur zum Testen von
KPIs, Score-Panel und Ereignisliste da**. Sie sagen nichts über echtes
Anlagenverhalten aus und werden durch die echte Modellausgabe ersetzt.

```
python3 scripts/prepare_dashboard_data.py <rohexport>.txt \
  -o sample-data/furnace_dashboard_demo_analyse.csv \
  --cycles <pfad>/cycles_all_zones_times_only.csv \
  --phase-zone 1 --start 2025-10-10T21:30:00 --end 2025-10-11T02:00:00 \
  --every 4 --synth-scores svm
```
