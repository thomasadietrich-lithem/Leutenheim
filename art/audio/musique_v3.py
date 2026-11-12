"""Musique « Crypte » v3 (Thomas, 2026-11-12 : « j'aime la crypte, mais améliore les phases 3/4, ça devient trop dense »).
Paliers 1 et 2 inchangés ; ALERTE et TRAQUE allégés : la tension vient du tempo et d'une pulsation grave, plus de
l'empilement. python3 art/audio/musique_v3.py → art/audio/musique_crypte_v3.mp3 (et la version courte)."""
import subprocess
import sys
import numpy as np
from scipy.io import wavfile

sys.path.insert(0, "art/audio")
from musique_v1 import MELODY, PROG, SR, add, hz, kick, lowpass, tick, tom, tone  # noqa: E402
from musique_v1 import section as crypte_v1  # noqa: E402


def section(stage, bpm, bars):
    if stage < 2:
        return crypte_v1(stage, bpm, bars)
    beat = 60 / bpm
    dur = bars * 4 * beat
    buf = np.zeros(int((dur + 2) * SR))
    for bar in range(bars):
        chord = PROG[bar % 4]
        t0 = bar * 4 * beat
        # La même nappe et le même bourdon que le calme : on reste dans la crypte.
        pad = sum(tone(hz(n), 4 * beat, "saw", a=0.6, d=0.3, s=0.8, r=0.8, detune=0.004) for n in chord)
        add(buf, lowpass(pad, 900 + (stage - 2) * 300), t0, 0.07)
        add(buf, tone(hz(38), 4 * beat, "sine", a=0.3, s=0.9, r=0.5), t0, 0.22)
        # Mélodie : une note par temps (plus de croches), une mesure sur deux en alerte.
        if stage == 3 or bar % 2 == 0:
            for k in range(4):
                note = MELODY[(bar * 4 + k) % len(MELODY)]
                add(buf, tone(hz(note), beat * 0.85, "tri", a=0.005, d=0.15, s=0.35, r=0.35), t0 + k * beat, 0.11)
        if stage == 2:
            # ALERTE : battement de cœur un peu plus serré, basse sur les temps, un léger tic-tac à contretemps.
            for k in range(4):
                add(buf, lowpass(tone(hz(chord[0] - 12), beat * 0.8, "saw", a=0.01, d=0.2, s=0.5, r=0.1), 650), t0 + k * beat, 0.16)
                add(buf, tick(), t0 + (k + 0.5) * beat, 0.045)
            for k in (0, 2):
                add(buf, kick(), t0 + k * beat, 0.5)
            add(buf, kick(0.6), t0 + 2.35 * beat, 0.25)
            # La note de tension (mi bémol), une mesure sur deux seulement, plus douce.
            if bar % 2 == 1:
                add(buf, tone(hz(63), beat * 1.5, "tri", a=0.05, d=0.2, s=0.5, r=0.3), t0 + 2.5 * beat, 0.06)
        else:
            # TRAQUE : une pulsation grave en croches qui pousse, la grosse caisse à chaque temps, et c'est tout ;
            # un roulement de tom seulement en fin de phrase (toutes les 4 mesures).
            for k in range(8):
                add(buf, lowpass(tone(hz(chord[0] - 12), beat * 0.4, "saw", a=0.005, d=0.1, s=0.5, r=0.05), 600), t0 + k * beat / 2, 0.15)
            for k in range(4):
                add(buf, kick(), t0 + k * beat, 0.45)
                add(buf, tick(), t0 + (k + 0.5) * beat, 0.04)
            if bar % 4 == 3:
                for j, f in enumerate([150, 130, 115, 100]):
                    add(buf, tom(f), t0 + (3 + j / 4) * beat, 0.22)
    return buf[: int(dur * SR)]


def render(seconds_per_stage):
    parts = []
    for stage, bpm in enumerate([72, 84, 100, 120]):
        bars = max(2, round(seconds_per_stage / (4 * 60 / bpm)))
        bars += (-bars) % 4  # des phrases entières de 4 mesures
        parts.append(section(stage, bpm, bars))
    fade = int(0.8 * SR)
    out = parts[0]
    for p in parts[1:]:
        ramp = np.linspace(0, 1, fade)
        out[-fade:] = out[-fade:] * (1 - ramp) + p[:fade] * ramp
        out = np.concatenate([out, p[fade:]])
    out = out / (np.max(np.abs(out)) + 1e-9) * 0.85
    rev = np.zeros_like(out)
    for delay, g in [(0.083, 0.25), (0.137, 0.18), (0.211, 0.12), (0.31, 0.08)]:
        d = int(delay * SR)
        rev[d:] += out[:-d] * g
    out = out + lowpass(rev, 2500)
    return out / (np.max(np.abs(out)) + 1e-9) * 0.85


if __name__ == "__main__":
    for name, sec in [("musique_crypte_v3", 20), ("musique_crypte_v3_court", 10)]:
        out = render(sec)
        wavfile.write(f"/tmp/{name}.wav", SR, (out * 32767).astype(np.int16))
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", f"/tmp/{name}.wav", "-b:a", "128k", f"art/audio/{name}.mp3"], check=True)
        print(name, f"{len(out) / SR:.0f} s", [round(float(np.sqrt(np.mean(out[i:i + 5 * SR] ** 2))), 2) for i in range(0, len(out), 10 * SR)])
