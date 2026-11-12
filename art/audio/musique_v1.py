"""Musique de Cave Roller, maquette v1 (2026-11-12) : un même thème qui se tend avec le niveau d'alerte.
4 passages de ~20 s : calme (72 bpm), agité (84), alerte (100), traque (120). Tout est synthétisé (comme les bruitages
du jeu), en ré mineur. python3 art/audio/musique_v1.py → art/audio/musique_v1.mp3"""
import subprocess
import numpy as np
from scipy.io import wavfile
from scipy.signal import lfilter, butter

SR = 32000
rng = np.random.default_rng(7)


def hz(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def env(n, a, d, s, r, length):
    t = np.zeros(n)
    A, D, R = int(a * SR), int(d * SR), int(r * SR)
    L = min(n, int(length * SR))
    t[:A] = np.linspace(0, 1, A) if A else 1
    t[A:A + D] = np.linspace(1, s, max(1, len(t[A:A + D])))
    t[A + D:L] = s
    rel = t[L - 1] if L > 0 else s
    t[L:L + R] = np.linspace(rel, 0, len(t[L:L + R]))
    return t


def tone(freq, dur, wave="sine", a=0.01, d=0.1, s=0.6, r=0.2, detune=0.0):
    n = int((dur + r) * SR)
    t = np.arange(n) / SR
    ph = 2 * np.pi * freq * t
    if wave == "sine":
        w = np.sin(ph)
    elif wave == "tri":
        w = 2 / np.pi * np.arcsin(np.sin(ph))
    elif wave == "saw":
        w = 2 * ((freq * t) % 1) - 1
        if detune:
            w = 0.5 * w + 0.5 * (2 * ((freq * (1 + detune) * t) % 1) - 1)
    elif wave == "sq":
        w = np.sign(np.sin(ph)) * 0.6
    return w * env(n, a, d, s, r, dur)


def lowpass(x, cutoff):
    b, a = butter(2, cutoff / (SR / 2))
    return lfilter(b, a, x)


def add(buf, x, at, gain=1.0):
    i = int(at * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(x))
    buf[i:j] += x[: j - i] * gain


def kick(gain=1.0):
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    f = 110 * np.exp(-t * 18) + 42
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9) * gain


def tick():
    n = int(0.05 * SR)
    x = rng.standard_normal(n) * np.exp(-np.arange(n) / SR * 90)
    b, a = butter(2, 6000 / (SR / 2), "high")
    return lfilter(b, a, x)


def tom(freq):
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * freq * (1 - 0.3 * t) * t) * np.exp(-t * 12)


# Ré mineur : ré fa la, puis si bémol, do, la ; la mélodie (degrés en notes MIDI).
PROG = [(50, 53, 57), (46, 50, 53), (48, 52, 55), (45, 49, 52)]  # Dm, Bb, C, A (dominante)
MELODY = [74, 72, 69, 70, 69, 65, 67, 69, 74, 77, 76, 74, 73, 69, 70, 69]
FAST = [62, 65, 69, 74, 69, 65]


def section(stage, bpm, bars):
    beat = 60 / bpm
    dur = bars * 4 * beat
    buf = np.zeros(int((dur + 2) * SR))
    for bar in range(bars):
        chord = PROG[bar % 4]
        t0 = bar * 4 * beat
        # Nappe sombre (toujours) : scie douce filtrée, plus ouverte quand l'alerte monte.
        pad = sum(tone(hz(n), 4 * beat, "saw", a=0.6, d=0.3, s=0.8, r=0.8, detune=0.004) for n in chord)
        add(buf, lowpass(pad, 500 + stage * 450), t0, 0.07)
        # Bourdon grave : ré, toujours.
        add(buf, tone(hz(38), 4 * beat, "sine", a=0.3, s=0.9, r=0.5), t0, 0.22)
        # Mélodie : rare au calme, plus serrée ensuite.
        step = [2, 1, 1, 0.5][stage]
        for k in range(int(4 / step)):
            idx = (bar * int(4 / step) + k) % len(MELODY)
            if stage == 0 and k % 2:
                continue
            note = MELODY[idx] - (12 if stage >= 2 and k % 2 else 0)
            add(buf, tone(hz(note), step * beat * 0.9, "tri", a=0.005, d=0.15, s=0.35, r=0.4), t0 + k * step * beat, 0.11)
        # Agité et plus : basse qui marche, battement de cœur (grosse caisse sur 1 et 3).
        if stage >= 1:
            for k in range(4):
                add(buf, lowpass(tone(hz(chord[0] - 12), beat * 0.8, "saw", a=0.01, d=0.2, s=0.5, r=0.1), 700), t0 + k * beat, 0.18)
            for k in (0, 2):
                add(buf, kick(), t0 + k * beat, 0.5)
            if stage == 1:
                add(buf, kick(0.6), t0 + 0.35 * beat, 0.3)
        # Alerte : charlestons, une note de tension (mi bémol) à la fin de chaque mesure.
        if stage >= 2:
            for k in range(8):
                add(buf, tick(), t0 + k * beat / 2, 0.08)
            add(buf, tone(hz(63), beat, "sq", a=0.01, d=0.1, s=0.4, r=0.1), t0 + 3 * beat, 0.05)
        # Traque : grosse caisse à chaque temps, toms, arpège rapide.
        if stage >= 3:
            for k in range(4):
                add(buf, kick(), t0 + k * beat, 0.55)
                add(buf, tom(120 + 30 * (k % 2)), t0 + (k + 0.5) * beat, 0.25)
            for k in range(16):
                n = FAST[k % len(FAST)] + (chord[0] - 50)
                add(buf, tone(hz(n + 12), beat / 4 * 0.8, "sq", a=0.002, d=0.05, s=0.3, r=0.05), t0 + k * beat / 4, 0.035)
    return buf[: int(dur * SR)]


def main():
    parts = [section(0, 72, 6), section(1, 84, 7), section(2, 100, 8), section(3, 120, 10)]
    # Fondu court entre les passages.
    out = parts[0]
    fade = int(0.8 * SR)
    for p in parts[1:]:
        ramp = np.linspace(0, 1, fade)
        out[-fade:] = out[-fade:] * (1 - ramp) + p[:fade] * ramp
        out = np.concatenate([out, p[fade:]])
    out = out / (np.max(np.abs(out)) + 1e-9) * 0.85
    # Un peu de réverbération (écho de cave).
    rev = np.zeros_like(out)
    for delay, g in [(0.083, 0.25), (0.137, 0.18), (0.211, 0.12), (0.31, 0.08)]:
        d = int(delay * SR)
        rev[d:] += out[:-d] * g
    out = out + lowpass(rev, 2500)
    out = out / (np.max(np.abs(out)) + 1e-9) * 0.85
    wavfile.write("/tmp/musique_v1.wav", SR, (out * 32767).astype(np.int16))
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", "/tmp/musique_v1.wav", "-b:a", "128k", "art/audio/musique_v1.mp3"], check=True)
    print(f"{len(out) / SR:.0f} s")


main()
