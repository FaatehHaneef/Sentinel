"""Builds the voice-over from video/script.md with a free Microsoft neural voice.

The free voices ignore any markup in the text, so the pauses and stress marked
in the script are made here instead: each line is cut into phrases, stressed
phrases are read slower and louder, and real silences go between them.

    python -m pip install edge-tts imageio-ffmpeg
    python video/voice.py            # every scene, plus voiceover.mp3
    python video/voice.py 1 4        # only scenes 1 and 4

Writes video/voice/scene-NN.mp3, video/voice/voiceover.mp3 and
video/voice/timings.json (each scene's length and when each phrase is spoken,
used to pace the recording and to place the subtitles).
"""

import asyncio
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import edge_tts
import imageio_ffmpeg

VOICE = "en-GB-SoniaNeural"
BASE_RATE = -4  # percent; a touch slower than normal reads more naturally
STRESS = {"rate": -14, "volume": 12, "pitch": -3}  # percent, percent, Hz
SHORT_PAUSE = 0.28  # seconds, for "/"
LONG_PAUSE = 0.65  # seconds, for "//"
SCENE_TAIL = 0.45  # seconds of quiet after each scene

ROOT = Path(__file__).parent
OUT = ROOT / "voice"
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()


def read_scenes():
    """The spoken lines of each scene, in order."""
    scenes = []
    for block in re.split(r"^## ", (ROOT / "script.md").read_text("utf-8"), flags=re.M)[1:]:
        lines = [line[1:].strip() for line in block.splitlines() if line.startswith(">")]
        scenes.append(" ".join(lines))
    return scenes


def pieces(text):
    """Splits a line into (kind, value) steps: ('say', text, stressed) or ('pause', seconds)."""
    steps = []
    for part in re.split(r"(//|/)", text):
        if part == "//":
            steps.append(("pause", LONG_PAUSE))
        elif part == "/":
            steps.append(("pause", SHORT_PAUSE))
        else:
            for i, chunk in enumerate(re.split(r"[*_]", part)):  # *stress* or _stress_
                if chunk.strip():
                    steps.append(("say", chunk.strip(), i % 2 == 1))
    return steps


def pct(value):
    return f"{value:+d}%"


async def speak(text, stressed, path):
    rate = BASE_RATE + (STRESS["rate"] if stressed else 0)
    volume = STRESS["volume"] if stressed else 0
    pitch = STRESS["pitch"] if stressed else 0
    raw = path.with_suffix(".raw.mp3")
    await edge_tts.Communicate(
        text, VOICE, rate=pct(rate), volume=pct(volume), pitch=f"{pitch:+d}Hz"
    ).save(str(raw))
    # The service pads every phrase with quiet at both ends. Trim it, so the
    # only pauses are the ones marked in the script.
    trim = "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.04"
    ffmpeg("-i", str(raw), "-af", f"{trim},areverse,{trim},areverse", "-ar", "24000", "-ac", "1", str(path))


def ffmpeg(*args):
    subprocess.run([FFMPEG, "-y", "-loglevel", "error", *args], check=True)


def silence(seconds, path):
    ffmpeg("-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono", "-t", f"{seconds}", str(path))


def length(path):
    result = subprocess.run([FFMPEG, "-i", str(path)], capture_output=True, text=True)
    h, m, s = re.search(r"Duration: (\d+):(\d+):([\d.]+)", result.stderr).groups()
    return int(h) * 3600 + int(m) * 60 + float(s)


def join(parts, path):
    """Joins audio files end to end, re-encoding so every piece matches."""
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8") as listing:
        for part in parts:
            listing.write(f"file '{Path(part).as_posix()}'\n")
    ffmpeg("-f", "concat", "-safe", "0", "-i", listing.name, "-ar", "24000", "-ac", "1", "-q:a", "3", str(path))


async def build_scene(number, text, work):
    """Builds one scene's audio and returns when each spoken phrase starts and ends."""
    parts, phrases, clock = [], [], 0.0
    for i, step in enumerate(pieces(text)):
        piece = work / f"s{number:02d}-{i:02d}.wav"
        if step[0] == "pause":
            silence(step[1], piece)
        else:
            await speak(step[1], step[2], piece)
        took = length(piece)
        if step[0] == "say":
            phrases.append({"text": step[1], "start": round(clock, 2), "end": round(clock + took, 2)})
        clock += took
        parts.append(piece)
    tail = work / f"s{number:02d}-tail.wav"
    silence(SCENE_TAIL, tail)
    parts.append(tail)
    join(parts, OUT / f"scene-{number:02d}.mp3")
    return phrases


async def main():
    OUT.mkdir(exist_ok=True)
    scenes = read_scenes()
    wanted = {int(arg) for arg in sys.argv[1:]} or set(range(1, len(scenes) + 1))
    timings_file = OUT / "timings.json"
    timings = json.loads(timings_file.read_text()) if timings_file.exists() else {}
    with tempfile.TemporaryDirectory() as tmp:
        for number, text in enumerate(scenes, 1):
            if number in wanted:
                phrases = await build_scene(number, text, Path(tmp))
                key = f"scene-{number:02d}"
                timings[key] = {"length": round(length(OUT / f"{key}.mp3"), 2), "phrases": phrases}
                print(f"scene {number}: {timings[key]['length']} s")
    timings = {key: timings[key] for key in sorted(timings) if int(key[-2:]) <= len(scenes)}
    timings_file.write_text(json.dumps(timings, indent=2))
    files = [OUT / f"scene-{n:02d}.mp3" for n in range(1, len(scenes) + 1)]
    if all(f.exists() for f in files):
        join(files, OUT / "voiceover.mp3")
        print(f"voiceover.mp3: {sum(s['length'] for s in timings.values()):.0f} seconds")


asyncio.run(main())
