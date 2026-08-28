#!/usr/bin/env python3
"""Hängt an eine bestehende Dashboard-CSV **synthetische** Modellergebnisse an
(``score_<modell>_z<N>`` / ``flag_<modell>_z<N>``) — nur zum Vorführen des
Analysemodus. Die Werte kommen NICHT aus echten Modellen.

Jedes Modell hat einen anderen "Charakter", damit man beim Umschalten in der
Sidebar einen Unterschied sieht:

  svm          lokale Volatilität des Istwerts  -> kurze, scharfe Ausschläge
  iforest      Abweichung von einer langsamen Basislinie -> breitere Bänder
  autoencoder  Volatilität + Änderungsrate + Regelfehler -> mehr, mittlere Events

Nur Standardbibliothek.

    python3 make_analysis_demo.py EIN.csv -o AUS.csv                 # alle drei
    python3 make_analysis_demo.py EIN.csv -o AUS.csv -m iforest      # nur eines
"""
from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

MODELS = ("svm", "iforest", "autoencoder")


def clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return lo if x < lo else hi if x > hi else x


def to_float(s: str) -> float | None:
    s = s.strip()
    if not s or s.lower() == "nan":
        return None
    try:
        return float(s)
    except ValueError:
        return None


def rolling_std(series: list[float | None], i: int, window: int) -> float:
    seg = [v for v in series[max(0, i - window):i + 1] if v is not None]
    if len(seg) < 3:
        return 0.0
    m = sum(seg) / len(seg)
    return (sum((v - m) ** 2 for v in seg) / len(seg)) ** 0.5


def ema(series: list[float | None], alpha: float) -> list[float | None]:
    out: list[float | None] = []
    s: float | None = None
    for v in series:
        if v is not None:
            s = v if s is None else alpha * v + (1 - alpha) * s
        out.append(s)
    return out


def smooth(series: list[float], window: int) -> list[float]:
    out = []
    for i in range(len(series)):
        seg = series[max(0, i - window):i + 1]
        out.append(sum(seg) / len(seg))
    return out


def percentile(values: list[float], pct: float) -> float:
    s = sorted(v for v in values if v > 0)
    if not s:
        return 1.0
    return s[min(len(s) - 1, int(len(s) * pct / 100))] or s[-1]


def raw_svm(pv: list[float | None]) -> list[float]:
    """Lokale Volatilität -> kurze, scharfe Ausschläge."""
    return smooth([rolling_std(pv, i, 10) for i in range(len(pv))], 3)


def raw_iforest(pv: list[float | None]) -> list[float]:
    """Abweichung von einer langsamen Basislinie -> breitere, längere Bänder."""
    base = ema(pv, 0.015)
    raw = [
        abs(pv[i] - base[i]) if pv[i] is not None and base[i] is not None else 0.0
        for i in range(len(pv))
    ]
    return smooth(raw, 6)


def raw_autoencoder(pv: list[float | None]) -> list[float]:
    """Volatilität + Änderungsrate -> mehr Events mittlerer Länge."""
    raw = []
    for i in range(len(pv)):
        vol = rolling_std(pv, i, 6)
        roc = abs(pv[i] - pv[i - 1]) if i and pv[i] is not None and pv[i - 1] is not None else 0.0
        raw.append(0.65 * vol + 0.35 * roc)
    return smooth(raw, 6)


# je Modell: Roh-Signal, Kalibrier-Perzentil (global über alle Zonen), Flag-Schwelle
SCORERS = {
    "svm": (raw_svm, 99.3, 0.85),
    "iforest": (raw_iforest, 98.8, 0.80),
    "autoencoder": (raw_autoencoder, 99.3, 0.82),
}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("input", type=Path, help="bestehende Dashboard-CSV (Prozess- oder Analysemodus)")
    ap.add_argument("-o", "--output", type=Path, required=True)
    ap.add_argument("-m", "--models", default=",".join(MODELS),
                    help=f"Komma-Liste aus {'|'.join(MODELS)} (Standard: alle)")
    args = ap.parse_args(argv)

    models = [m.strip() for m in args.models.split(",") if m.strip()]
    bad = [m for m in models if m not in SCORERS]
    if bad:
        ap.error(f"unbekannte Modelle: {', '.join(bad)}")

    with args.input.open(newline="") as f:
        reader = csv.reader(f)
        header = next(reader)
        rows = [row for row in reader if row]

    idx = {name: i for i, name in enumerate(header)}
    zones = sorted({
        int(name[1])
        for name in header
        if len(name) > 2 and name[0] == "z" and name[1].isdigit() and name.endswith("_temp_pv")
    })
    if not zones:
        ap.error("keine z<N>_temp_pv-Spalten gefunden — ist das eine Dashboard-CSV?")

    # bestehende Modellspalten verwerfen, damit nichts doppelt auftaucht
    keep = [name for name in header if not name.startswith(("score_", "flag_"))]
    keep_idx = [idx[name] for name in keep]

    pv_by_zone = {z: [to_float(r[idx[f"z{z}_temp_pv"]]) for r in rows] for z in zones}

    new_cols: dict[str, list[str]] = {}
    for model in models:
        raw_fn, pct, thr = SCORERS[model]
        raw_by_zone = {z: raw_fn(pv_by_zone[z]) for z in zones}
        # ein gemeinsamer Referenzwert über alle Zonen: ruhige Zonen bleiben ruhig
        ref = percentile([v for vals in raw_by_zone.values() for v in vals], pct)
        for z in zones:
            scores = [clamp(v / ref) for v in raw_by_zone[z]]
            new_cols[f"score_{model}_z{z}"] = [f"{s:.4f}" for s in scores]
            new_cols[f"flag_{model}_z{z}"] = ["1" if s > thr else "0" for s in scores]

    out_header = keep + list(new_cols)
    with args.output.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(out_header)
        for ri, r in enumerate(rows):
            w.writerow([r[i] for i in keep_idx] + [new_cols[c][ri] for c in new_cols])

    flags = {
        m: sum(int(v) for z in zones for v in new_cols[f"flag_{m}_z{z}"])
        for m in models
    }
    print(f"{args.output}: {len(rows)} Zeilen, Zonen {zones}, Modelle {models}")
    print("  geflaggte Punkte je Modell:", flags)
    return 0


if __name__ == "__main__":
    sys.exit(main())
