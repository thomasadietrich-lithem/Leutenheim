"""Musique, options (Thomas, 2026-11-12 : « propose plusieurs options ») : 4 styles, chacun ~40 s qui passent par les
4 paliers d'alerte (calme, agité, alerte, traque ; ~10 s chacun). Synthétisé. python3 art/audio/musique_v2.py"""
import subprocess
import sys
import numpy as np
from scipy.io import wavfile

sys.path.insert(0, "art/audio")
from musique_v1 import SR, add, hz, kick, lowpass, tick, tom, tone, section as crypte  # noqa: E402

rng = np.random.default_rng(3)
BPM = [72, 84, 100, 120]


def noise_hit(dur, cutoff, decay):
    n = int(dur * SR)
    x = rng.standard_normal(n) * np.exp(-np.arange(n) / SR * decay)
    return lowpass(x, cutoff)


def bell(freq, dur, bright=1.0):
    """Cloche de boîte à musique (synthèse FM)."""
    n = int((dur + 0.8) * SR)
    t = np.arange(n) / SR
    mod = np.sin(2 * np.pi * freq * 3.5 * t) * 2.2 * bright * np.exp(-t * 6)
    return np.sin(2 * np.pi * freq * t + mod) * np.exp(-t * 2.6)


def chiptune(stage, bpm, bars):
    """B — 8 bits : mélodie en carré, arpèges rapides, batterie en bruit blanc."""
    beat = 60 / bpm
    buf = np.zeros(int((bars * 4 * beat + 2) * SR))
    prog = [(50, 53, 57), (46, 50, 53), (48, 52, 55), (45, 49, 52)]
    mel = [62, 65, 69, 67, 65, 64, 62, 60, 62, 65, 69, 72, 70, 69, 67, 64]
    for bar in range(bars):
        ch = prog[bar % 4]
        t0 = bar * 4 * beat
        for k in range(16 if stage >= 1 else 8):
            step = beat / 4 if stage >= 1 else beat / 2
            n = ch[k % 3] + 12
            add(buf, tone(hz(n), step * 0.7, "sq", a=0.002, d=0.04, s=0.4, r=0.02), t0 + k * step, 0.035)
        add(buf, tone(hz(ch[0] - 12), 4 * beat, "tri", a=0.01, s=0.8, r=0.1), t0, 0.16)
        stepm = [1, 1, 0.5, 0.5][stage]
        for k in range(int(4 / stepm)):
            n = mel[(bar * 4 + k) % len(mel)] + (12 if stage >= 2 else 0)
            if stage == 0 and k % 2:
                continue
            add(buf, tone(hz(n), stepm * beat * 0.8, "sq", a=0.004, d=0.08, s=0.5, r=0.05), t0 + k * stepm * beat, 0.06)
        if stage >= 1:
            for k in range(4):
                add(buf, noise_hit(0.12, 1200, 30), t0 + k * beat, 0.25 if k % 2 == 0 else 0.0)
                if k % 2:
                    add(buf, noise_hit(0.1, 5000, 40), t0 + k * beat, 0.18)
        if stage >= 2:
            for k in range(8):
                add(buf, noise_hit(0.03, 9000, 120), t0 + k * beat / 2, 0.06)
        if stage >= 3:
            for k in range(8):
                add(buf, noise_hit(0.08, 1500, 35), t0 + k * beat / 2, 0.2)
    return buf[: int(bars * 4 * beat * SR)]


def tambours(stage, bpm, bars):
    """C — Tambours de guerre des Kobolds : gros tambours graves, bourdon, cor rauque."""
    beat = 60 / bpm
    buf = np.zeros(int((bars * 4 * beat + 2) * SR))
    for bar in range(bars):
        t0 = bar * 4 * beat
        add(buf, lowpass(tone(hz(38), 4 * beat, "saw", a=0.4, s=0.9, r=0.5, detune=0.006), 300), t0, 0.12)
        pattern = [[0, 2], [0, 1.5, 2, 3], [0, 0.75, 1.5, 2, 2.5, 3, 3.5], [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.25, 3.5, 3.75]][stage]
        for p in pattern:
            add(buf, tom(70 if p % 1 == 0 else 95), t0 + p * beat, 0.55)
            add(buf, kick(0.7), t0 + p * beat, 0.3 if p % 2 == 0 else 0.0)
        if bar % 2 == 0 or stage >= 2:
            note = [50, 50, 53, 51][bar % 4]
            add(buf, lowpass(tone(hz(note), 1.5 * beat, "saw", a=0.08, d=0.2, s=0.7, r=0.4, detune=0.01), 900 + stage * 300), t0 + 2 * beat, 0.14)
        if stage >= 2:
            for k in range(4):
                add(buf, noise_hit(0.05, 3000, 60), t0 + (k + 0.5) * beat, 0.08)
        if stage >= 3:
            add(buf, lowpass(tone(hz(51), 4 * beat, "saw", a=0.5, s=0.8, r=0.3, detune=0.01), 1200), t0, 0.06)
    return buf[: int(bars * 4 * beat * SR)]


def boite(stage, bpm, bars):
    """D — Boîte à musique hantée : une berceuse en clochettes, désaccordée, qui s'emballe."""
    beat = 60 / bpm
    buf = np.zeros(int((bars * 4 * beat + 2) * SR))
    mel = [74, 77, 76, 74, 72, 74, 69, 0, 70, 72, 74, 72, 70, 69, 67, 69]
    for bar in range(bars):
        t0 = bar * 4 * beat
        step = [1, 0.75, 0.5, 0.25][stage]
        for k in range(int(4 / step)):
            n = mel[(bar * int(4 / step) + k) % len(mel)]
            if n == 0:
                continue
            wobble = 1 + (0.004 + 0.006 * stage) * np.sin(bar + k)  # le mécanisme fatigue
            add(buf, bell(hz(n) * wobble, step * beat, 1 + stage * 0.3), t0 + k * step * beat, 0.16)
        add(buf, bell(hz([50, 46, 48, 45][bar % 4]), 4 * beat, 0.5), t0, 0.12)
        if stage >= 1:
            add(buf, lowpass(tone(hz(38), 4 * beat, "sine", a=0.5, s=0.8, r=0.5), 400), t0, 0.2)
        if stage >= 2:
            for k in range(4):
                add(buf, kick(0.6), t0 + k * beat, 0.3)
            add(buf, bell(hz(75), beat, 2.0), t0 + 3.5 * beat, 0.1)
        if stage >= 3:
            for k in range(8):
                add(buf, tick(), t0 + k * beat / 2, 0.1)
                add(buf, tom(110), t0 + (k + 0.5) * beat / 2, 0.15 if k % 2 else 0)
    return buf[: int(bars * 4 * beat * SR)]


STYLES = {"A_crypte": crypte, "B_chiptune": chiptune, "C_tambours": tambours, "D_boite_a_musique": boite}


def render(fn):
    parts = []
    for stage, bpm in enumerate(BPM):
        bars = max(2, round(10 / (4 * 60 / bpm)))
        parts.append(fn(stage, bpm, bars))
    fade = int(0.6 * SR)
    out = parts[0]
    for p in parts[1:]:
        ramp = np.linspace(0, 1, fade)
        out[-fade:] = out[-fade:] * (1 - ramp) + p[:fade] * ramp
        out = np.concatenate([out, p[fade:]])
    rev = np.zeros_like(out)
    for delay, g in [(0.083, 0.22), (0.137, 0.16), (0.211, 0.1), (0.31, 0.07)]:
        d = int(delay * SR)
        rev[d:] += out[:-d] * g
    out = out + lowpass(rev, 2500)
    return out / (np.max(np.abs(out)) + 1e-9) * 0.85


if __name__ == "__main__":
    for name, fn in STYLES.items():
        out = render(fn)
        wav = f"/tmp/{name}.wav"
        wavfile.write(wav, SR, (out * 32767).astype(np.int16))
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-b:a", "112k", f"art/audio/musique_{name}.mp3"], check=True)
        rms = [round(float(np.sqrt(np.mean(out[i:i + 5 * SR] ** 2))), 2) for i in range(0, len(out), 10 * SR)]
        print(name, f"{len(out) / SR:.0f} s", rms)
