"""Composes the demo video's background music: a soft, original chiptune loop.

    python video/music.py      # writes video/build/music.wav, as long as the voice-over

Synthesised from scratch (triangle waves), so it's ours to use.
A gentle arpeggio with a light melody, in C major at 92 beats a minute, with a
slow fade in and out. compose.py mixes it quietly under the voice.
"""

import json
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).parent
RATE = 44100
BPM = 92
BEAT = 60 / BPM

# Two-bar chords, as MIDI note numbers: C, Am, F, G, then C, Em, F, G.
PROGRESSION = [
    [60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62],
    [60, 64, 67], [52, 55, 59], [53, 57, 60], [55, 59, 62],
]
# A little melody on top, one note per beat; None is a rest.
MELODY = [
    76, None, 74, 72, None, 72, 74, 76, 72, None, None, 69, 72, None, 74, None,
    72, None, 69, 67, None, 65, 67, 69, 67, None, None, 71, 74, None, None, None,
]


def hz(note):
    return 440.0 * 2 ** ((note - 69) / 12)


def tone(note, seconds, kind="triangle", decay=4.0):
    t = np.arange(int(seconds * RATE)) / RATE
    phase = (t * hz(note)) % 1.0
    if kind == "triangle":
        wave_ = 4 * np.abs(phase - 0.5) - 1
    else:  # a soft square, quarter duty, for the bass
        wave_ = np.where(phase < 0.25, 1.0, -0.33)
    attack = np.minimum(1.0, t / 0.008)
    release = np.minimum(1.0, (seconds - t) / 0.03)
    return wave_ * attack * release * np.exp(-decay * t)


def loop():
    """One pass through the progression (16 bars)."""
    bar = 4 * BEAT
    length = int(len(PROGRESSION) * 2 * bar * RATE)
    out = np.zeros(length)

    def add(signal, at, gain):
        start = int(at * RATE)
        end = min(length, start + len(signal))
        out[start:end] += signal[: end - start] * gain

    for i, chord in enumerate(PROGRESSION):
        start = i * 2 * bar
        # Arpeggio: up and down the chord in eighth notes.
        pattern = [0, 1, 2, 1, 0, 1, 2, 1] * 2
        for j, k in enumerate(pattern):
            add(tone(chord[k] + 12, BEAT * 0.5, decay=6.0), start + j * BEAT / 2, 0.10)
        # Melody on top.
        for b in range(8):
            note = MELODY[(i * 8 + b) % len(MELODY)] if i % 4 in (1, 3) else None
            if note:
                add(tone(note, BEAT * 0.9, decay=3.0), start + b * BEAT, 0.09)
    return out


def main():
    timings = json.loads((ROOT / "voice" / "timings.json").read_text())
    total = sum(scene["length"] for scene in timings.values()) + 1.0
    one = loop()
    music = np.tile(one, int(np.ceil(total * RATE / len(one))))[: int(total * RATE)]
    # A soft room: a couple of quiet echoes.
    for delay, gain in [(0.19, 0.25), (0.37, 0.12)]:
        shift = int(delay * RATE)
        music[shift:] += music[:-shift] * gain
    fade_in = np.minimum(1.0, np.arange(len(music)) / (2.0 * RATE))
    fade_out = np.minimum(1.0, (len(music) - np.arange(len(music))) / (4.0 * RATE))
    music *= fade_in * fade_out
    music /= np.max(np.abs(music)) * 1.1
    target = ROOT / "build" / "music.wav"
    target.parent.mkdir(exist_ok=True)
    with wave.open(str(target), "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(RATE)
        f.writeframes((music * 32767).astype(np.int16).tobytes())
    print(f"wrote {target}: {total:.0f} s")


main()
