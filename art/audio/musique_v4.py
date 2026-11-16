"""Musique « Crypte » v4 (Thomas, 2026-11-16 : « ralentir la dernière phase et l'ensemble ; le dernier segment tourne en
boucle ; plus douce, harmonieuse, moins pixel ; propose plusieurs itérations »). MAQUETTES, rien en jeu.

Ce qui change pour toutes : tempos plus lents ; la phrase ne fait plus 4 mesures mais 16 (accords et mélodie), avec
des tenues et des silences : en traque la boucle passe de 8 s à environ 40 s ; plus de basse en croches.
  A  crypte ralentie : les sons de la v3 (triangle, scie), seulement plus lente et avec la longue phrase
  B  crypte douce    : sons ronds (attaques lentes, plus de scie ni de tic-tac), battement feutré, écho plus long
  C  harpe et cordes : mélodie pincée, arpège de harpe, nappe de cordes, timbale douce ; pas de grosse caisse
  D  orgue et cloche : nappe d'orgue, mélodie de flûte, la cloche de Leutenheim qui sonne quand l'alerte monte
python3 art/audio/musique_v4.py → art/audio/musique_v4_<lettre>_<nom>.mp3
Tout reste faisable en direct dans le jeu (oscillateurs, filtres, échos)."""
import subprocess
import sys
import numpy as np
from scipy.io import wavfile
from scipy.signal import lfilter

sys.path.insert(0, "art/audio")
from musique_v1 import SR, add, env, hz, kick, lowpass, tick, tom, tone  # noqa: E402

rng = np.random.default_rng(11)

DM, BB, C, A, GM, F = (50, 53, 57), (46, 50, 53), (48, 52, 55), (45, 49, 52), (43, 46, 50), (41, 45, 48)
PROG16 = [DM, BB, C, A, DM, GM, BB, A, F, C, GM, DM, BB, GM, A, A]
# Une case par temps : note, -1 = la note d'avant tient, 0 = silence.
MEL16 = [
    [74, -1, 72, 69], [70, -1, 69, 65], [67, -1, 69, 72], [73, -1, -1, 0],
    [74, 77, 76, 74], [70, -1, 67, 70], [74, -1, 72, 70], [69, -1, -1, 0],
    [77, -1, 76, 72], [76, -1, 72, 67], [70, -1, 74, 70], [69, -1, -1, 0],
    [65, 70, 74, -1], [67, 70, 79, -1], [76, -1, 73, -1], [69, -1, -1, 0],
]

VARIANTS = {
    "A": ("crypte_ralentie", [64, 74, 86, 100]),
    "B": ("crypte_douce", [60, 68, 78, 90]),
    "C": ("harpe_et_cordes", [58, 66, 76, 88]),
    "D": ("orgue_et_cloche", [56, 64, 72, 84]),
}


def partials(freq, dur, amps, a, r, decay=0.0, vib=0.0):
    """Somme de sinus (timbre rond) ; `decay` = son pincé qui s'éteint ; `vib` = léger vibrato."""
    n = int((dur + r) * SR)
    t = np.arange(n) / SR
    ph = 2 * np.pi * freq * t + (vib * freq / 5.2 * np.sin(2 * np.pi * 5.2 * t) * np.minimum(1, t / 0.4) if vib else 0)
    w = np.zeros(n)
    for k, amp in enumerate(amps, start=1):
        w += amp * np.sin(k * ph) * (np.exp(-t * decay * k) if decay else 1)
    return w * env(n, a, 0.0, 1.0, r, dur)


def melody_voice(v, freq, dur):
    if v == "A":
        return tone(freq, dur * 0.9, "tri", a=0.005, d=0.15, s=0.35, r=0.4) * 0.11
    if v == "B":
        return partials(freq, dur * 0.95, [1, 0.25, 0.08], a=0.06, r=0.7, vib=0.003) * 0.075
    if v == "C":
        return partials(freq, dur + 0.6, [1, 0.5, 0.25, 0.12, 0.06], a=0.004, r=0.5, decay=1.3) * 0.11
    breath = lowpass(rng.standard_normal(int((dur + 0.5) * SR)), 2500) * 0.02
    w = partials(freq, dur * 0.95, [1, 0.18, 0.05], a=0.09, r=0.5, vib=0.004)
    return (w + breath[: len(w)] * env(len(w), 0.09, 0, 1, 0.5, dur)) * 0.08


def pad(v, chord, dur, stage):
    if v == "A":
        p = sum(tone(hz(n), dur, "saw", a=0.6, d=0.3, s=0.8, r=0.8, detune=0.004) for n in chord)
        return lowpass(p, 500 + min(stage, 2) * 400) * 0.07
    if v == "B":
        p = sum(tone(hz(n), dur, "tri", a=1.2, d=0.3, s=0.9, r=1.2) + tone(hz(n) * 1.003, dur, "tri", a=1.2, d=0.3, s=0.9, r=1.2) for n in chord)
        return lowpass(p, 700 + stage * 150) * 0.045
    if v == "C":
        p = sum(tone(hz(n), dur, "saw", a=1.0, d=0.3, s=0.9, r=1.2, detune=0.006) + 0.3 * tone(hz(n + 12), dur, "saw", a=1.4, d=0.3, s=0.9, r=1.2, detune=0.005) for n in chord)
        return lowpass(p, 1100 + stage * 150) * 0.04
    p = sum(partials(hz(n), dur, [1, 0.5, 0.2, 0.1], a=0.8, r=1.2) for n in chord)
    n = len(p)
    return p * (1 + 0.08 * np.sin(2 * np.pi * 0.7 * np.arange(n) / SR)) * 0.035


def soft_kick(gain=1.0):
    return lowpass(kick(), 160) * 1.6 * gain


def bell(freq):
    """Cloche grave : partiels non harmoniques qui s'éteignent lentement."""
    n = int(4.0 * SR)
    t = np.arange(n) / SR
    w = sum(a * np.sin(2 * np.pi * freq * r * t) * np.exp(-t * d) for r, a, d in [(0.5, 0.5, 0.7), (1, 1, 0.9), (1.19, 0.6, 1.3), (1.5, 0.4, 1.6), (2, 0.5, 2.0), (2.51, 0.25, 2.6), (3.01, 0.15, 3.2)])
    return w * np.minimum(1, t / 0.004)


def section(v, stage, bpm, bars):
    beat = 60 / bpm
    dur = bars * 4 * beat
    buf = np.zeros(int((dur + 5) * SR))
    for bar in range(bars):
        chord = PROG16[bar % 16]
        cells = MEL16[bar % 16]
        t0 = bar * 4 * beat
        add(buf, pad(v, chord, 4 * beat, stage), t0)
        # Bourdon de ré : plus discret dans les versions douces.
        add(buf, tone(hz(38), 4 * beat, "sine", a=0.3, s=0.9, r=0.5), t0, 0.22 if v == "A" else 0.14)
        # Mélodie : calme = la première note de la mesure, tenue ; agité = temps 1 et 3 ; alerte et traque = la phrase.
        slots = [0] if stage == 0 else [0, 2] if stage == 1 else [0, 1, 2, 3]
        for k in slots:
            if cells[k] <= 0:
                continue
            length = 1
            while k + length < 4 and cells[k + length] == -1:
                length += 1
            if stage == 0:
                length = 3
            elif stage == 1:
                length = max(length, 2 if k == 0 else 1.5)
            add(buf, melody_voice(v, hz(cells[k]), length * beat), t0 + k * beat)
            # Traque : une deuxième voix à la sixte en dessous sur le premier temps (harmonie, pas de vitesse).
            if stage == 3 and k == 0 and v != "A":
                add(buf, melody_voice(v, hz(cells[k] - (9 if cells[k] - 9 in [n + 12 * o for n in chord for o in (1, 2)] else 12)), length * beat), t0, 0.5)
        root = hz(chord[0] - 12)
        if v == "A":
            if stage >= 1:
                for k in range(4):
                    add(buf, lowpass(tone(root, beat * 0.8, "saw", a=0.01, d=0.2, s=0.5, r=0.1), 650), t0 + k * beat, 0.16)
                for k in (0, 2):
                    add(buf, kick(), t0 + k * beat, 0.5)
                add(buf, kick(0.6), t0 + (0.35 if stage == 1 else 2.35) * beat, 0.25)
            if stage >= 2:
                for k in range(4):
                    add(buf, tick(), t0 + (k + 0.5) * beat, 0.04)
            if stage == 3:
                for k in (1, 3):
                    add(buf, kick(), t0 + k * beat, 0.3)
                if bar % 8 == 7:
                    for j, f in enumerate([150, 130, 115, 100]):
                        add(buf, tom(f), t0 + (3 + j / 4) * beat, 0.2)
        elif v == "B":
            if stage >= 1:
                for k in ((0, 2) if stage < 3 else range(4)):
                    add(buf, partials(root, beat * 0.9, [1, 0.3], a=0.03, r=0.3), t0 + k * beat, 0.16)
                add(buf, soft_kick(), t0, 0.4)
                add(buf, soft_kick(), t0 + (0.4 if stage == 1 else 2) * beat, 0.25 if stage == 1 else 0.4)
            if stage >= 2:
                add(buf, soft_kick(), t0 + 2.4 * beat, 0.22)
            if stage == 3:
                for k in (1, 3):
                    add(buf, soft_kick(), t0 + k * beat, 0.22)
        elif v == "C":
            # Arpège de harpe : à la noire, puis en croches quand l'alerte monte (c'est lui qui presse, pas un tambour).
            arp = [chord[0], chord[2], chord[1] + 12, chord[2]]
            div = 1 if stage < 2 else 2
            for k in range(4 * div):
                if stage == 0 and k % 2:
                    continue
                n = arp[k % 4] + (12 if div == 2 and (k // 4) % 2 else 0)
                add(buf, partials(hz(n), beat / div + 0.5, [1, 0.45, 0.2, 0.08], a=0.004, r=0.4, decay=1.6), t0 + k * beat / div, 0.06)
            if stage >= 1:
                add(buf, partials(root, 2 * beat, [1, 0.4, 0.15], a=0.01, r=0.5, decay=0.8), t0, 0.2)
            if stage >= 2:
                for k in ((0,) if stage == 2 else (0, 2)):
                    add(buf, lowpass(tom(73), 300), t0 + k * beat, 0.35)
        else:
            if stage >= 1:
                add(buf, partials(root, 3.5 * beat, [1, 0.5, 0.25], a=0.2, r=0.5), t0, 0.12)
            if stage == 2 and bar % 2 == 0 or stage == 3:
                add(buf, bell(hz(50)), t0, 0.1 if stage == 2 else 0.12)
            if stage == 3:
                for k in (0, 2):
                    add(buf, soft_kick(), t0 + k * beat, 0.35)
                add(buf, soft_kick(), t0 + 2.4 * beat, 0.2)
    return buf[: int((dur + 1.5) * SR)]


def reverb(x, v):
    if v == "A":  # l'écho court de la v3
        rev = np.zeros_like(x)
        for delay, g in [(0.083, 0.25), (0.137, 0.18), (0.211, 0.12), (0.31, 0.08)]:
            d = int(delay * SR)
            rev[d:] += x[:-d] * g
        return x + lowpass(rev, 2500)
    # Écho de voûte plus long et plus lisse : quatre échos qui se répètent en s'éteignant.
    rev = np.zeros_like(x)
    for delay, fb in [(0.0297, 0.78), (0.0371, 0.76), (0.0411, 0.74), (0.0437, 0.72)]:
        d = int(delay * SR)
        den = np.zeros(d + 1)
        den[0], den[d] = 1, -fb
        rev += lfilter([1], den, x)
    return x + lowpass(rev, 1800) * 0.09


def render(v):
    name, bpms = VARIANTS[v]
    parts = [section(v, s, bpms[s], [8, 8, 8, 16][s]) for s in range(4)]
    fade = int(1.5 * SR)
    out = parts[0]
    for p in parts[1:]:
        ramp = np.linspace(0, 1, fade)
        out[-fade:] = out[-fade:] * (1 - ramp) + p[:fade] * ramp
        out = np.concatenate([out, p[fade:]])
    out = out / (np.max(np.abs(out)) + 1e-9) * 0.85
    out = reverb(out, v)
    end = int(2 * SR)
    out[-end:] *= np.linspace(1, 0, end)
    return name, out / (np.max(np.abs(out)) + 1e-9) * 0.85


if __name__ == "__main__":
    for v in sys.argv[1:] or VARIANTS:
        name, out = render(v)
        base = f"musique_v4_{v}_{name}"
        wavfile.write(f"/tmp/{base}.wav", SR, (out * 32767).astype(np.int16))
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", f"/tmp/{base}.wav", "-b:a", "128k", f"art/audio/{base}.mp3"], check=True)
        rms = [round(float(np.sqrt(np.mean(out[i:i + 5 * SR] ** 2))), 2) for i in range(0, len(out), 20 * SR)]
        print(base, f"{len(out) / SR:.0f} s", "tempos", VARIANTS[v][1], "niveau", rms)
