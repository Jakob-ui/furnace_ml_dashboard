#!/usr/bin/env python3
"""Rohexport der Stoßofen-Anlage -> furnace_dashboard.csv (Dashboard-Eingabe).

Der Rohexport (IBA) kommt als ``;``-getrennte Datei mit Dezimalkomma, langen
englischen Spaltennamen und einer je Zone unterschiedlichen Spaltenreihenfolge.
Dieses Skript erzeugt daraus die eine Datei, die das Dashboard erwartet:

* Trennzeichen ``,``  ·  Dezimalpunkt  ·  UTF-8
* Zeitstempel als ISO 8601 (``2025-10-10T00:03:42.320``)
* Spaltennamen nach dem Schlüssel ``z<Zone>_<Gruppe>_<Rolle>`` (siehe Claude.md §2.3)
* ``phase`` immer vorhanden (aus dem Sollwertverlauf abgeleitet)
* ``cycle`` nur mit ``--cycles`` (aus der Segmentierungs-CSV der ML-Seite)

Modellergebnisse (``score_*`` / ``flag_*``) entstehen auf der ML-Seite. Zum
Testen des Analysemodus kann ``--synth-scores`` synthetische, klar als solche
gekennzeichnete Spalten anhängen.

Nur Standardbibliothek, streamend – auch ein Tagesauszug (~700k Zeilen) läuft
ohne pandas durch.
"""
from __future__ import annotations

import argparse
import csv
import sys
from datetime import datetime, timedelta
from pathlib import Path

# --------------------------------------------------------------------------- #
# Spaltenvertrag
# --------------------------------------------------------------------------- #

# Rohsuffix (klein, ein Leerzeichen) -> (Gruppe, Rolle). Deckt die je Zone
# abweichenden Schreibweisen und den Tippfehler "sepoint" in Zone 2 mit ab.
SUFFIX_MAP: dict[str, tuple[str, str]] = {
    "heating controller setpoint": ("temp", "sp"),
    "heating controller process value": ("temp", "pv"),
    "heating controller controller manipulated variable": ("temp", "mv"),
    "temperature detection wind ahead of charge sp": ("wind_ahead", "sp"),
    "temperature detection wind ahead of charge pv": ("wind_ahead", "pv"),
    "temperature detection wind beyond of charge sp": ("wind_beyond", "sp"),
    "temperature detection wind beyond charge": ("wind_beyond", "pv"),
    "control error temperature wind ahead of charge": ("err_ahead", "err"),
    "control error temperature wind beyond of charge": ("err_beyond", "err"),
    "combustion air controller setpoint": ("air", "sp"),
    "combustion air controller sepoint": ("air", "sp"),
    "combustion air controller process value": ("air", "pv"),
    "combustion air controller controller manipulated variable": ("air", "mv"),
    "combustion air control flow metering": ("air", "flow"),
    "fuel gas controller setpoint": ("gas", "sp"),
    "fuel gas controller process value": ("gas", "pv"),
    "fuel gas controller controller manipulated variable": ("gas", "mv"),
    "fuel gas control flow metering": ("gas", "flow"),
    "combustion air/ fuel gas ratio": ("ratio", "ratio"),
}

# Spalten ohne Zonenbezug.
X_MAP: dict[str, str] = {
    "inlet door drive right motor status s1 slow (1 = on)": "x_inlet_door_right_slow",
    "inlet side seq is running": "x_inlet_side_seq_running",
}

RAW_TIME_FORMATS = (
    "%d.%m.%Y %H:%M:%S.%f", "%d.%m.%Y %H:%M:%S", "%d.%m.%Y %H:%M",
    "%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M",
)

PHASE_ORDER = ("heating", "hold", "cooling")


def normalize(name: str) -> str:
    return " ".join(name.strip().lower().split())


def map_header(raw_headers: list[str]) -> tuple[list[str | None], list[str]]:
    """raw_headers -> (Zielname je Rohspalte | None, Liste der Zielspalten)."""
    targets: list[str | None] = []
    for raw in raw_headers:
        n = normalize(raw)
        if n == "time":
            targets.append("time")
            continue
        if n in X_MAP:
            targets.append(X_MAP[n])
            continue
        if n.startswith("zone "):
            rest = n[len("zone "):]
            zone_str, _, suffix = rest.partition(" ")
            if zone_str.isdigit() and suffix in SUFFIX_MAP:
                group, role = SUFFIX_MAP[suffix]
                targets.append(f"z{int(zone_str)}_{group}_{role}")
                continue
        targets.append(None)  # unbekannt

    unknown = [raw for raw, t in zip(raw_headers, targets) if t is None]
    if unknown:
        raise SystemExit(
            "Unbekannte Spalten im Rohexport (Spaltenvertrag §2.3 prüfen):\n  "
            + "\n  ".join(unknown)
        )

    ordered = [t for t in targets if t is not None]
    if len(set(ordered)) != len(ordered):
        dupes = sorted({t for t in ordered if ordered.count(t) > 1})
        raise SystemExit(f"Doppelte Zielspalten nach Mapping: {dupes}")

    return targets, ordered


def parse_raw_time(value: str) -> datetime:
    v = value.strip()
    for fmt in RAW_TIME_FORMATS:
        try:
            return datetime.strptime(v, fmt)
        except ValueError:
            continue
    raise SystemExit(f"Zeitstempel nicht lesbar: {value!r}")


def iso_ms(dt: datetime) -> str:
    return dt.isoformat(timespec="milliseconds")


def to_point(cell: str) -> str:
    c = cell.strip()
    if not c:
        return ""
    return c.replace(",", ".")


def sniff_delimiter(sample: str) -> str:
    return ";" if sample.count(";") >= sample.count(",") else ","


# --------------------------------------------------------------------------- #
# Phase aus dem Sollwertverlauf ableiten
# --------------------------------------------------------------------------- #

def derive_phases(
    times: list[datetime],
    setpoints: list[float | None],
    window: timedelta,
    slope_threshold: float,
) -> list[str]:
    """heating, wenn der Sollwert im Fenster deutlich steigt, cooling wenn er
    fällt, sonst hold. Bewusst simpel – die ML-Seite ersetzt das später durch
    die echte Segmentierung."""
    n = len(times)
    phases = ["hold"] * n
    if n == 0:
        return phases

    j_lo = 0
    j_hi = 0
    for i in range(n):
        t = times[i]
        while j_lo < n and times[j_lo] < t - window:
            j_lo += 1
        while j_hi < n and times[j_hi] <= t + window:
            j_hi += 1
        lo = setpoints[max(j_lo, 0)]
        hi = setpoints[min(j_hi - 1, n - 1)]
        if lo is None or hi is None:
            continue
        delta = hi - lo
        if delta > slope_threshold:
            phases[i] = "heating"
        elif delta < -slope_threshold:
            phases[i] = "cooling"
    return phases


# --------------------------------------------------------------------------- #
# cycle / phase aus der Segmentierungs-CSV
# --------------------------------------------------------------------------- #

def load_cycle_intervals(path: Path, zone: int) -> list[tuple[int, str, datetime, datetime]]:
    rows = list(csv.DictReader(path.open(encoding="utf-8")))
    zone_rows = [r for r in rows if r.get("zone", "").strip() == str(zone)]
    if not zone_rows:
        raise SystemExit(f"Keine Segmentierungsdaten für zone={zone} in {path}")

    def pt(v: str) -> datetime | None:
        v = (v or "").strip()
        return parse_raw_time(v) if v else None

    zone_rows.sort(key=lambda r: pt(r["heating_start_time"]) or datetime.max)
    intervals: list[tuple[int, str, datetime, datetime]] = []
    for r in zone_rows:
        cyc = int(float(r["cycle"]))
        heat = pt(r["heating_start_time"])
        hold = pt(r["hold_start_time"])
        cool = pt(r["cooling_start_time"])
        charge = pt(r["charging_start_time"])
        for phase, start, end in (
            ("heating", heat, hold),
            ("hold", hold, cool),
            ("cooling", cool, charge),
        ):
            if start and end and end > start:
                intervals.append((cyc, phase, start, end))
    intervals.sort(key=lambda x: x[2])
    return intervals


# --------------------------------------------------------------------------- #
# synthetische Modellergebnisse (nur zum Testen des Analysemodus)
# --------------------------------------------------------------------------- #

def synth_scores(
    pv_by_zone: dict[int, list[float | None]],
    model: str,
    window: int = 12,
    threshold: float = 0.62,
) -> dict[str, list[str]]:
    """Score aus der lokalen Volatilität des Istwerts: ruhiger Betrieb -> ~0,
    ruckartige Ausschläge -> kurze Peaks. Rein synthetisch, ersetzt echte
    Modellausgabe nur fürs UI-Testen."""
    out: dict[str, list[str]] = {}
    for zone, series in pv_by_zone.items():
        n = len(series)
        scores = [0.0] * n
        for i in range(n):
            lo = max(0, i - window)
            seg = [v for v in series[lo:i + 1] if v is not None]
            if len(seg) < 3:
                continue
            mean = sum(seg) / len(seg)
            var = sum((v - mean) ** 2 for v in seg) / len(seg)
            std = var ** 0.5
            scores[i] = min(std / 2.5, 1.0)
        out[f"score_{model}_z{zone}"] = [f"{s:.4f}" for s in scores]
        out[f"flag_{model}_z{zone}"] = ["1" if s > threshold else "0" for s in scores]
    return out


# --------------------------------------------------------------------------- #

def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("input", type=Path, help="Rohexport (.txt / .csv)")
    ap.add_argument("-o", "--output", type=Path, default=Path("furnace_dashboard.csv"))
    ap.add_argument("--cycles", type=Path, help="Segmentierungs-CSV (cycles_all_zones_times_only.csv)")
    ap.add_argument("--phase-zone", type=int, default=1, help="Referenzzone für phase/cycle (Standard: 1)")
    ap.add_argument("--every", type=int, default=1, help="nur jede N-te Zeile übernehmen")
    ap.add_argument("--start", help="ISO-Zeitpunkt: nur Zeilen ab hier")
    ap.add_argument("--end", help="ISO-Zeitpunkt: nur Zeilen bis hier")
    ap.add_argument("--synth-scores", metavar="MODELL", help="synthetische score_/flag_-Spalten anhängen (svm|iforest|autoencoder)")
    ap.add_argument("--phase-window-s", type=float, default=150.0)
    ap.add_argument("--phase-slope", type=float, default=3.0, help="°C Sollwertänderung im Fenster für heating/cooling")
    args = ap.parse_args(argv)

    if not args.input.exists():
        raise SystemExit(f"Eingabe nicht gefunden: {args.input}")

    start_dt = parse_raw_time(args.start.replace("T", " ")) if args.start else None
    end_dt = parse_raw_time(args.end.replace("T", " ")) if args.end else None

    with args.input.open(encoding="utf-8", errors="replace", newline="") as f:
        first_line = f.readline()
    delimiter = sniff_delimiter(first_line)
    raw_headers = next(csv.reader([first_line], delimiter=delimiter))
    targets, ordered_cols = map_header(raw_headers)
    time_idx = targets.index("time")
    keep_idx = [i for i, t in enumerate(targets) if t is not None]

    pz = args.phase_zone
    pz_sp_col = f"z{pz}_temp_sp"
    if pz_sp_col not in ordered_cols:
        raise SystemExit(f"Referenzzone {pz} fehlt im Export ({pz_sp_col}).")

    # ---- Pass 1: Zeitachse + Referenz-Sollwert (+ Regelfehler für --synth) ----
    print("Pass 1/2: Zeitachse lesen …", file=sys.stderr)
    times: list[datetime] = []
    setpoints: list[float | None] = []
    synth_zones: list[int] = sorted({
        int(c.split("_")[0][1:]) for c in ordered_cols if c.endswith("_temp_pv")
    }) if args.synth_scores else []
    pv_by_zone: dict[int, list[float | None]] = {z: [] for z in synth_zones}
    col_pos = {c: keep_idx[ordered_cols.index(c)] for c in ordered_cols}

    with args.input.open(encoding="utf-8", errors="replace", newline="") as f:
        reader = csv.reader(f, delimiter=delimiter)
        next(reader)
        for n, row in enumerate(reader):
            if not row or len(row) <= time_idx:
                continue
            if n % args.every:
                continue
            try:
                dt = parse_raw_time(row[col_pos["time"]])
            except SystemExit:
                continue
            if start_dt and dt < start_dt:
                continue
            if end_dt and dt > end_dt:
                continue
            times.append(dt)
            sp_raw = to_point(row[col_pos[pz_sp_col]])
            setpoints.append(float(sp_raw) if sp_raw else None)
            for z in synth_zones:
                e = to_point(row[col_pos[f"z{z}_temp_pv"]])
                pv_by_zone[z].append(float(e) if e else None)

    if not times:
        raise SystemExit("Keine Datenzeilen nach Filterung übrig.")

    # ---- phase / cycle bestimmen ----
    cycle_col: list[str]
    if args.cycles:
        intervals = load_cycle_intervals(args.cycles, pz)
        phases, cycle_col = [], []
        ptr = 0
        for dt in times:
            while ptr < len(intervals) and intervals[ptr][3] <= dt:
                ptr += 1
            if ptr < len(intervals) and intervals[ptr][2] <= dt < intervals[ptr][3]:
                cycle_col.append(str(intervals[ptr][0]))
                phases.append(intervals[ptr][1])
            else:
                cycle_col.append("")
                phases.append("")
    else:
        phases = derive_phases(
            times, setpoints,
            timedelta(seconds=args.phase_window_s),
            args.phase_slope,
        )
        cycle_col = []

    synth_cols = synth_scores(pv_by_zone, args.synth_scores) if args.synth_scores else {}

    # ---- Pass 2: schreiben ----
    print(f"Pass 2/2: {len(times)} Zeilen schreiben -> {args.output}", file=sys.stderr)
    out_header = ["time"]
    if cycle_col:
        out_header.append("cycle")
    out_header.append("phase")
    value_cols = [c for c in ordered_cols if c != "time"]
    out_header.extend(value_cols)
    out_header.extend(synth_cols.keys())

    written = 0
    with args.input.open(encoding="utf-8", errors="replace", newline="") as fin, \
         args.output.open("w", encoding="utf-8", newline="") as fout:
        reader = csv.reader(fin, delimiter=delimiter)
        writer = csv.writer(fout)
        writer.writerow(out_header)
        next(reader)
        for n, row in enumerate(reader):
            if not row or len(row) <= time_idx:
                continue
            if n % args.every:
                continue
            try:
                dt = parse_raw_time(row[col_pos["time"]])
            except SystemExit:
                continue
            if start_dt and dt < start_dt:
                continue
            if end_dt and dt > end_dt:
                continue
            if written >= len(times):
                break
            out = [iso_ms(dt)]
            if cycle_col:
                out.append(cycle_col[written])
            out.append(phases[written])
            for c in value_cols:
                out.append(to_point(row[col_pos[c]]))
            for name in synth_cols:
                out.append(synth_cols[name][written])
            writer.writerow(out)
            written += 1

    counts: dict[str, int] = {}
    for p in phases:
        counts[p or "(ohne)"] = counts.get(p or "(ohne)", 0) + 1
    print(
        f"Fertig. {written} Zeilen, {len(value_cols)} Signalspalten"
        + (f", cycle aus Zone {pz}" if cycle_col else "")
        + (f", synthetische Scores: {args.synth_scores}" if synth_cols else "")
        + f"\nPhasenverteilung: {counts}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
