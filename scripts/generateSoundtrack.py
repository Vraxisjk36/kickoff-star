"""Compose Kickoff Star's original menu loop. No samples or third-party music.

Run: python3 scripts/generateSoundtrack.py
Requires numpy and ffmpeg. The source remains here so the track can be remade.
"""

from pathlib import Path
import subprocess
import tempfile
import wave

import numpy as np


RATE = 22050
BPM = 96
BEAT = 60 / BPM
BARS = 16
LENGTH = int(BARS * 4 * BEAT * RATE)
rng = np.random.default_rng(20260927)
mix = np.zeros(LENGTH, dtype=np.float64)


def tone(start, duration, frequency, amplitude, kind="sine"):
    begin = int(start * RATE)
    count = min(int(duration * RATE), LENGTH - begin)
    if count <= 0:
        return
    t = np.arange(count) / RATE
    attack = np.minimum(1, t / 0.018)
    release = np.minimum(1, (duration - t) / 0.16)
    env = np.maximum(0, attack * release)
    phase = 2 * np.pi * frequency * t
    if kind == "warm":
        signal = np.sin(phase) + 0.18 * np.sin(2 * phase) + 0.06 * np.sin(3 * phase)
    elif kind == "bell":
        signal = (np.sin(phase) + 0.36 * np.sin(2.01 * phase)) * np.exp(-t * 2.5)
    else:
        signal = np.sin(phase)
    mix[begin:begin + count] += signal * env * amplitude


def hit(start, kind, gain):
    begin = int(start * RATE)
    duration = 0.28 if kind == "kick" else 0.13
    n = min(int(duration * RATE), LENGTH - begin)
    if n <= 0:
        return
    t = np.arange(n) / RATE
    if kind == "kick":
        phase = 2 * np.pi * (56 * t + 52 * (1 - np.exp(-t * 24)) / 24)
        sound = np.sin(phase) * np.exp(-t * 22)
    else:
        noise = rng.standard_normal(n)
        if kind == "hat":
            sound = (noise - np.convolve(noise, np.ones(12) / 12, mode="same")) * np.exp(-t * 65)
        else:
            sound = (noise * 0.55 + np.sin(2 * np.pi * 180 * t) * 0.45) * np.exp(-t * 32)
    mix[begin:begin + n] += sound * gain


# A restrained minor-key stadium pulse: Dm - Bb - F - C. The four-bar
# melody changes on the second half, giving the loop movement without
# distracting from reading or decisions.
chords = [
    ([146.83, 174.61, 220.00], 73.42),  # D minor
    ([116.54, 146.83, 174.61], 58.27),  # B-flat major
    ([130.81, 174.61, 220.00], 65.41),  # F major
    ([130.81, 164.81, 196.00], 65.41),  # C major
]
melody = [293.66, 349.23, 440.00, 349.23, 293.66, 261.63, 220.00, 261.63,
          293.66, 349.23, 392.00, 440.00, 392.00, 349.23, 293.66, 261.63]
for bar in range(BARS):
    start = bar * 4 * BEAT
    notes, bass = chords[bar % 4]
    for frequency in notes:
        tone(start, 4 * BEAT, frequency, 0.026, "warm")
    for step in range(4):
        at = start + step * BEAT
        tone(at, BEAT * 0.86, bass * (2 if step == 3 else 1), 0.085, "warm")
        hit(at, "kick", 0.19 if step in (0, 2) else 0.09)
        if step in (1, 3):
            hit(at, "snare", 0.064)
        hit(at + BEAT / 2, "hat", 0.022)
    if bar >= 4:
        tone(start + BEAT * 0.5, BEAT * 0.65, melody[bar % 16], 0.035, "bell")
        if bar % 4 == 3:
            tone(start + BEAT * 2.5, BEAT * 0.65, melody[(bar + 2) % 16], 0.025, "bell")

# Fade the final tail into the downbeat, leaving no hard click at the loop.
fade = int(0.12 * RATE)
mix[-fade:] *= np.linspace(1, 0, fade)
mix = np.tanh(mix * 1.6) * 0.65
pcm = (mix * 32767).astype("<i2")
output = Path(__file__).resolve().parents[1] / "public/audio/under-the-lights.mp3"
output.parent.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory() as temporary:
    wav_path = Path(temporary) / "source.wav"
    with wave.open(str(wav_path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(RATE)
        wav.writeframes(pcm.tobytes())
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(wav_path),
                    "-codec:a", "libmp3lame", "-b:a", "112k", str(output)], check=True)
print(output)
