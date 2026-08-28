# Beispieldaten

Dateien zum Ausprobieren des Dashboards ohne echte Anlagendaten. Aufbau der CSV:
siehe „Das CSV-Format" in der Haupt-[`README.md`](../README.md).

Die ML-Seite liefert später echte Dateien im selben Format.

## `furnace_dashboard.csv` — Prozessmodus

999 Zeilen, realer Referenzauszug, komplett in Phase `hold`. Keine
Modellergebnisse → das Dashboard zeigt nur Signalauswahl und Zeitverlauf.

## `furnace_dashboard_demo_analyse.csv` — Analysemodus (nur `svm`)

Zone-1-Zyklus 1 (Aufheizen → Halten → Abkühlen), 8100 Zeilen auf 2-s-Raster, mit
`cycle`/`phase`. Enthält `score_svm_*` / `flag_svm_*` für Zone 1–6.

## `furnace_dashboard_demo_full.csv` — Analysemodus, alle drei Modelle

Dieselben Prozessdaten wie oben, plus `score_*` / `flag_*` für **`svm`,
`iforest` und `autoencoder`**. Damit lässt sich mit einer Datei die komplette
Funktionalität durchklicken (Modellauswahl, Score-Panel, KPIs, Events).

## `furnace_dashboard_demo_iforest.csv` / `furnace_dashboard_demo_autoencoder.csv`

Wie `_full`, aber je nur ein Modell — für den Fall „nur ein Modell in der Datei".

---

**Alle `score_*` / `flag_*`-Werte in den Demo-Dateien sind synthetisch** und sagen
nichts über echtes Anlagenverhalten aus. Erzeugt mit `make_analysis_demo.py`:

```bash
# alle drei Modelle an eine fertige Dashboard-CSV hängen
python3 sample-data/make_analysis_demo.py \
  sample-data/furnace_dashboard_demo_analyse.csv \
  -o sample-data/furnace_dashboard_demo_full.csv

# nur ein Modell
python3 sample-data/make_analysis_demo.py <eingabe>.csv -o <ausgabe>.csv -m autoencoder
```

Jedes Modell hat einen anderen Charakter (damit man beim Umschalten einen
Unterschied sieht): `svm` = kurze scharfe Ausschläge (lokale Volatilität),
`iforest` = breitere Bänder (Abweichung von einer langsamen Basislinie),
`autoencoder` = mehr Events mittlerer Länge (Volatilität + Änderungsrate).

Die Prozessdaten selbst stammen aus `scripts/prepare_dashboard_data.py`
(Rohexport → Dashboard-CSV), siehe Haupt-README „Daten aufbereiten".
