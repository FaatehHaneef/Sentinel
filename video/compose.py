"""Turns the recorded clips and the voice-over into the demo video.

    python video/compose.py                 # the whole video: video/build/sentinel-demo.mp4
    python video/compose.py 4               # one scene, with its voice: video/build/preview-scene-04.mp4
    python video/compose.py --stills 4:9.5 6:12   # single frames as PNGs, for checking

Each scene's picture is fitted to its voice line. Footage plays at real speed,
is fast-forwarded (with a badge saying so) when the action takes longer than
the words, and holds when it is shorter. On top go the effects: a "focus" lifts
part of the screen out over a blurred background, a "spot" dims everything but
one area, and subtitles show what is being said.
"""

import bisect
import json
import re
import subprocess
import sys
from functools import lru_cache
from pathlib import Path

import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).parent
BUILD = ROOT / "build"
VOICE = ROOT / "voice"
W, H, FPS = 1920, 1080, 30
MAX_FF = 4.0  # fastest fast-forward; anything quicker becomes a jump cut
AMBER, NIGHT, SHADOW, PARCHMENT, SLATE = "#ffb347", (18, 21, 42), "#090a15", "#f3e9d2", "#2e3a5c"

PIXEL = str(ROOT / "fonts" / "PixelifySans.ttf")
SANS = str(ROOT / "fonts" / "Atkinson-Bold.ttf")

# Specs: an output time is a number, "end", or "P:<words>[+-s]" (when a phrase
# containing <words> starts). A source time is a number, "end", or
# "M:<mark>[+-s]" (a moment noted while recording).
SCENES = {
    "scene-01": {"clip": "scene-01", "effects": [{"kind": "kenburns", "to": 1.12}]},
    "scene-02": {"still": "slide-02.png", "effects": [{"kind": "kenburns", "to": 1.06}]},
    "scene-03": {
        "clip": "scene-03",
        "effects": [
            {"kind": "spot", "mark": f"who-{who}", "from": f"P:{words}", "to": f"P:{after}"}
            for who, words, after in [
                ("iris", "Grandma Iris", "Tobin's hands"),
                ("tobin", "Tobin's hands", "Pell's"),
                ("pell", "Pell's", "Knock"),
                ("knock", "Knock", "Echo"),
                ("echo", "Echo", "Dash"),
                ("dash", "Dash", "Cog's"),
                ("cog", "Cog's", "end"),
            ]
        ],
    },
    "scene-04": {
        "clip": "scene-04",
        "segments": [
            {"out": [0, "P:Here, Iris"], "src": [0, "M:pale-0.4"]},
            {"out": ["P:Here, Iris", "end"], "src": ["M:pale-0.4", "M:iris-gone-1.6"]},
        ],
        "effects": [
            {
                "kind": "focus",
                "mark": "pale",
                "from": "P:Here, Iris+0.2",
                "to": "P:Every problem",
                "label": "Contrast {v} : 1  ·  needs 4.5 : 1",
                "value": 1.6,
                "decimals": 1,
            }
        ],
    },
    "scene-05": {
        "clip": "scene-05",
        "segments": [
            {"out": [0, "P:The red marks"], "src": ["M:taps-4", "M:taps+0.4"]},
            {"out": ["P:The red marks", "P:and a tiny"], "src": ["M:taps+0.4", "M:taps+0.4"]},
            {"out": ["P:and a tiny", "end"], "src": ["M:taps+0.4", "M:after-taps"]},
        ],
        "effects": [
            {
                "kind": "focus",
                "mark": "taps",
                "from": "P:The red marks-0.2",
                "to": "end",
                "label": "20 shaky taps  ·  red ones missed",
            }
        ],
    },
    "scene-06": {
        "clip": "scene-06",
        # Each zoom holds the frame its box was measured on: the page shifts as it loads.
        "segments": [
            {"out": [0, "P:what it's costing-0.3"], "src": [0, "P:what it's costing-0.3"]},
            {"out": ["P:what it's costing-0.3", "P:And every shopper"], "src": ["M:money", "M:money"]},
            {"out": ["P:And every shopper", "end"], "src": ["M:verdict+0.1", "M:verdict+0.1"]},
        ],
        "effects": [
            {
                "kind": "focus",
                "mark": "money",
                "from": "P:what it's costing-0.3",
                "to": "P:And every shopper",
                "label": "An estimate, with its assumptions shown",
            },
            {"kind": "focus", "mark": "verdict", "from": "P:And every shopper+0.3", "to": "end", "label": "A verdict for each shopper", "trim": 46},
        ],
    },
    "scene-07": {
        "clip": "scene-07",
        "segments": [
            {"out": [0, "P:send the shoppers back"], "src": [0, "P:send the shoppers back"]},
            {"out": ["P:send the shoppers back", "P:Iris goes from"], "src": ["M:rerun-0.3", "M:fixed-0.3"]},
            {"out": ["P:Iris goes from", "P:actually pays-0.4"], "src": ["M:fixed-0.3", "M:paid-0.6"]},
            {"out": ["P:actually pays-0.4", "end"], "src": ["M:paid-0.6", "M:paid+1.2"]},
        ],
        "effects": [
            {"kind": "focus", "mark": "fix", "from": 0.4, "to": "P:send the shoppers back-0.3", "label": "The fix, as code"},
            {"kind": "focus", "track": "panel", "from": "P:Iris goes from+0.2", "to": "P:actually pays-0.5"},
            {"kind": "focus", "track": "panel", "from": "P:actually pays-0.2", "to": "end", "label": "Paid in the Braintree sandbox"},
        ],
    },
    "scene-08": {
        "clip": "scene-08",
        "segments": [
            {"out": [0, "P:so it reads"], "src": ["M:start", "M:agent-0.8"]},
            {"out": ["P:so it reads", "P:and places"], "src": ["M:agent-0.8", "M:order"]},
            {"out": ["P:and places", "end"], "src": ["M:receipt-0.3", "end"]},
        ],
        "effects": [
            {"kind": "focus", "track": "panel", "from": "P:so it reads+0.2", "to": "P:and places-0.1"},
            {"kind": "focus", "mark": "receipt", "from": "P:and places+0.1", "to": "end", "label": "A sandbox order, placed by the agent"},
        ],
    },
    "scene-09": {
        "clip": "scene-09",
        "effects": [
            {"kind": "focus", "mark": "ledger", "from": 0.9, "to": "P:And on your own site-0.7", "label": "The ledger"},
            {"kind": "focus", "mark": "snippet", "from": "P:one line", "to": "end", "label": "One line, and the shoppers can visit"},
        ],
    },
    "scene-10": {"still": "slide-11.png", "effects": [{"kind": "kenburns", "to": 1.05}]},
    "scene-11": {"still": "slide-12.png", "effects": [{"kind": "kenburns", "to": 1.05}]},
}

TIMINGS = json.loads((VOICE / "timings.json").read_text())


# ---- Time -------------------------------------------------------------------


def parse_offset(spec, prefix):
    m = re.fullmatch(prefix + r"(.+?)([+-]\d+(?:\.\d+)?)?", spec)
    return m.group(1), float(m.group(2) or 0)


def out_time(spec, scene):
    length = TIMINGS[scene]["length"]
    if isinstance(spec, (int, float)):
        return float(spec)
    if spec == "end":
        return length
    words, offset = parse_offset(spec, "P:")
    for phrase in TIMINGS[scene]["phrases"]:
        if words in phrase["text"]:
            return phrase["start"] + offset
    raise ValueError(f"{scene}: no phrase with {words!r}")


def src_time(spec, scene, clip):
    if isinstance(spec, (int, float)):
        return float(spec)
    if spec == "end":
        return clip["frames"][-1]["t"]
    if spec.startswith("P:"):
        return out_time(spec, scene)
    name, offset = parse_offset(spec, "M:")
    return clip["marks"][name]["t"] + offset


def segments(scene, cfg, clip):
    length = TIMINGS[scene]["length"]
    if not cfg.get("segments"):
        return [(0.0, length, 0.0, length)]
    return [
        (out_time(s["out"][0], scene), out_time(s["out"][1], scene), src_time(s["src"][0], scene, clip), src_time(s["src"][1], scene, clip))
        for s in cfg["segments"]
    ]


def source_at(t, segs):
    """Where in the footage to look at output time t, and how fast it is playing."""
    for o0, o1, s0, s1 in segs:
        if t < o1 or (o0, o1, s0, s1) == segs[-1]:
            span_o, span_s = max(o1 - o0, 1e-6), s1 - s0
            speed = span_s / span_o
            into = t - o0
            if speed <= 1:
                return s0 + min(into, span_s), 1.0
            if speed <= MAX_FF:
                return s0 + into * speed, speed
            half = span_o / 2
            return (s0 + into * MAX_FF, MAX_FF) if into < half else (s1 - (o1 - t) * MAX_FF, MAX_FF)
    return 0.0, 1.0


# ---- Pictures ---------------------------------------------------------------


@lru_cache(maxsize=4)
def load(path):
    image = Image.open(path).convert("RGB")
    return image if image.size == (W, H) else image.resize((W, H), Image.LANCZOS)


@lru_cache(maxsize=64)
def font(path, size):
    return ImageFont.truetype(path, size)


def blurred(frame, darken=0.45):
    small = frame.resize((W // 4, H // 4), Image.BILINEAR).filter(ImageFilter.GaussianBlur(3))
    small = Image.eval(small, lambda v: int(v * darken))
    return small.resize((W, H), Image.BILINEAR)


def ease(x):
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


def envelope(t, start, end, rise=0.45, fall=0.3):
    if t < start or t > end:
        return 0.0
    return min(ease((t - start) / rise), ease((end - t) / fall))


def scale_box(box, viewport_width):
    k = W / viewport_width
    x, y, w, h = box["x"] * k, box["y"] * k, box["w"] * k, box["h"] * k
    x, y = max(0, x), max(0, y)
    return x, y, min(w, W - x), min(h, H - y)


def label_image(text, size=38, face=SANS):
    f = font(face, size)
    left, top, right, bottom = f.getbbox(text)
    pad_x, pad_y = 26, 16
    image = Image.new("RGBA", (right - left + pad_x * 2 + 8, bottom - top + pad_y * 2 + 8), (0, 0, 0, 0))
    d = ImageDraw.Draw(image)
    w, h = image.size[0] - 8, image.size[1] - 8
    d.rectangle([8, 8, w + 7, h + 7], fill=SHADOW)
    d.rectangle([0, 0, w - 1, h - 1], fill=NIGHT, outline=AMBER, width=4)
    d.text((pad_x - left, pad_y - top), text, font=f, fill=AMBER)
    return image


def counted(text, value, decimals, progress):
    if value is None or "{v}" not in text:
        return text
    shown = value * (1 - (1 - min(progress, 1)) ** 3)
    return text.replace("{v}", f"{shown:,.{decimals}f}")


def apply_focus(frame, effect, t, box, start, end):
    e = envelope(t, start, end)
    if e <= 0 or not box:
        return frame
    x, y, bw, bh = box
    picture = Image.blend(frame, blurred(frame), e)
    crop = frame.crop((int(x), int(y), int(x + bw), int(y + bh)))
    k = max(0.4, min(W * 0.66 / bw, H * 0.6 / bh, 2.6))
    tw, th = bw * k, bh * k
    tx, ty = (W - tw) / 2, (H - th) / 2 - 70
    cx, cy = x + (tx - x) * e, y + (ty - y) * e
    cw, ch = bw + (tw - bw) * e, bh + (th - bh) * e
    d = ImageDraw.Draw(picture)
    d.rectangle([cx + 12, cy + 12, cx + cw + 12, cy + ch + 12], fill=SHADOW)
    picture.paste(crop.resize((max(1, int(cw)), max(1, int(ch))), Image.LANCZOS), (int(cx), int(cy)))
    d.rectangle([cx - 6, cy - 6, cx + cw + 5, cy + ch + 5], outline=AMBER, width=6)
    if effect.get("label") and e > 0.6:
        text = counted(effect["label"], effect.get("value_resolved"), effect.get("decimals", 0), (t - start) / 1.1)
        tag = label_image(text)
        alpha = tag.getchannel("A").point(lambda a: int(a * min(1, (e - 0.6) / 0.4)))
        tag.putalpha(alpha)
        picture.paste(tag, (int((W - tag.size[0]) / 2), int(cy + ch + 26)), tag)
    return picture


def apply_spot(frame, t, box, start, end):
    e = envelope(t, start, end, rise=0.25, fall=0.2)
    if e <= 0 or not box:
        return frame
    x, y, bw, bh = box
    mask = Image.new("L", (W, H), int(255 * 0.85 * e))
    ImageDraw.Draw(mask).rectangle([x, y, x + bw, y + bh], fill=0)
    picture = Image.composite(blurred(frame), frame, mask)
    ImageDraw.Draw(picture).rectangle([x - 5, y - 5, x + bw + 4, y + bh + 4], outline=AMBER, width=5)
    return picture


def kenburns(frame, t, length, to):
    z = 1 + (to - 1) * ease(t / length)
    cw, ch = W / z, H / z
    left, top = (W - cw) / 2, (H - ch) / 2
    return frame.crop((int(left), int(top), int(left + cw), int(top + ch))).resize((W, H), Image.BILINEAR)


def badge(frame, speed):
    tag = label_image(f">> {speed:.0f}x  fast-forward", size=26, face=PIXEL)
    frame.paste(tag, ((W - tag.size[0]) // 2, 22), tag)
    return frame


# ---- Subtitles --------------------------------------------------------------


def captions(scene):
    """Phrases joined into readable subtitle lines, with when to show each."""
    phrases = TIMINGS[scene]["phrases"]
    merged = []
    for p in phrases:  # stressed words were spoken separately; join them back
        if merged and p["start"] - merged[-1]["end"] < 0.12:
            merged[-1] = {"text": f"{merged[-1]['text']} {p['text']}", "start": merged[-1]["start"], "end": p["end"]}
        else:
            merged.append(dict(p))
    groups = []
    for p in merged:
        if groups and len(groups[-1]["text"]) + len(p["text"]) < 78 and p["start"] - groups[-1]["end"] < 0.45:
            groups[-1] = {"text": f"{groups[-1]['text']} {p['text']}", "start": groups[-1]["start"], "end": p["end"]}
        else:
            groups.append(dict(p))
    for i, g in enumerate(groups):
        nxt = groups[i + 1]["start"] if i + 1 < len(groups) else TIMINGS[scene]["length"]
        g["until"] = min(nxt, g["end"] + 0.5)
    return groups


@lru_cache(maxsize=32)
def caption_image(text):
    f = font(SANS, 36)
    words, lines, line = text.split(), [], ""
    for word in words:
        trial = f"{line} {word}".strip()
        if f.getlength(trial) > 900 and line:
            lines.append(line)
            line = word
        else:
            line = trial
    lines.append(line)
    line_h = 46
    width = int(max(f.getlength(l) for l in lines)) + 48
    height = line_h * len(lines) + 26
    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    d = ImageDraw.Draw(image)
    d.rectangle([0, 0, width - 1, height - 1], fill=(18, 21, 42, 225), outline=SLATE, width=3)
    for i, l in enumerate(lines):
        d.text(((width - f.getlength(l)) / 2, 12 + i * line_h), l, font=f, fill=PARCHMENT)
    return image


def subtitle(frame, scene, t):
    for c in captions(scene):
        if c["start"] - 0.05 <= t < c["until"]:
            image = caption_image(c["text"])
            frame.paste(image, ((W - image.size[0]) // 2, H - image.size[1] - 40), image)
            break
    return frame


# ---- Scenes -----------------------------------------------------------------


def prepare(scene):
    cfg = SCENES[scene]
    if "still" in cfg:
        return cfg, None, [], ROOT / "build" / cfg["still"]
    clip_dir = BUILD / cfg["clip"]
    clip = json.loads((clip_dir / "clip.json").read_text())
    clip["dir"] = clip_dir
    clip["times"] = [f["t"] for f in clip["frames"]]
    for effect in cfg.get("effects", []):
        if effect.get("value") == "mark":
            effect["value_resolved"] = clip["marks"][effect["mark"]].get("value")
        elif "value" in effect:
            effect["value_resolved"] = effect["value"]
    return cfg, clip, segments(scene, cfg, clip), None


def render(scene, t, prepared):
    cfg, clip, segs, still = prepared
    length = TIMINGS[scene]["length"]
    speed, s = 1.0, t
    if still:
        frame = load(str(still)).copy()
    else:
        s, speed = source_at(t, segs)
        i = max(0, bisect.bisect_right(clip["times"], s) - 1)
        frame = load(str(clip["dir"] / clip["frames"][i]["f"])).copy()
    for effect in cfg.get("effects", []):
        kind = effect["kind"]
        if kind == "kenburns":
            frame = kenburns(frame, t, length, effect["to"])
            continue
        start, end = out_time(effect["from"], scene), out_time(effect["to"], scene)
        raw = None
        if clip and effect.get("track"):
            samples = clip["tracks"][effect["track"]]
            i = bisect.bisect_right([x["t"] for x in samples], s) - 1
            raw = samples[max(0, i)]["box"] if samples else None
        elif clip and effect.get("mark") in clip["marks"]:
            raw = clip["marks"][effect["mark"]].get("box")
        if raw and effect.get("trim"):  # cut a strip off the bottom of the box
            raw = {**raw, "h": raw["h"] - effect["trim"]}
        box = scale_box(raw, clip["viewport"]["width"]) if raw else None
        if kind == "focus":
            frame = apply_focus(frame, effect, t, box, start, end)
        elif kind == "spot":
            frame = apply_spot(frame, t, box, start, end)
    zooming = any(
        e["kind"] == "focus" and out_time(e["from"], scene) - 0.1 <= t <= out_time(e["to"], scene) + 0.1
        for e in cfg.get("effects", [])
    )
    if speed > 1.3 and not zooming:
        frame = badge(frame, speed)
    return subtitle(frame, scene, t)


MUSIC = BUILD / "music.wav"  # from video/music.py; left out if missing
MUSIC_LEVEL = 0.11  # quiet, well under the voice


def music_args():
    """Mixes the background music under the voice, when there is some."""
    if not MUSIC.exists():
        return ["-map", "0:v", "-map", "1:a"]
    return ["-i", str(MUSIC), "-filter_complex",
            f"[2:a]volume={MUSIC_LEVEL}[m];[1:a][m]amix=inputs=2:duration=first:normalize=0[a]",
            "-map", "0:v", "-map", "[a]"]


def encode(scenes, target, audio):
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    process = subprocess.Popen(
        [ffmpeg, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
         "-i", str(audio), *music_args(), "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", str(target)],
        stdin=subprocess.PIPE,
    )
    previous = None
    for scene in scenes:
        prepared = prepare(scene)
        count = round(TIMINGS[scene]["length"] * FPS)
        for n in range(count):
            frame = render(scene, n / FPS, prepared)
            if previous is not None and n < 6:  # a short dissolve from the last scene
                frame = Image.blend(previous, frame, (n + 1) / 7)
            process.stdin.write(frame.tobytes())
        previous = frame
        print(f"{scene}: {count} frames")
    process.stdin.close()
    process.wait()
    print(f"wrote {target}")


def main():
    args = sys.argv[1:]
    if args and args[0] == "--stills":
        for spec in args[1:]:
            number, t = spec.split(":")
            scene = f"scene-{int(number):02d}"
            path = BUILD / f"still-{scene}-{t}.png"
            render(scene, float(t), prepare(scene)).save(path)
            print(path)
        return
    if args:
        scene = f"scene-{int(args[0]):02d}"
        encode([scene], BUILD / f"preview-{scene}.mp4", VOICE / f"{scene}.mp3")
        return
    encode(sorted(SCENES), BUILD / "sentinel-demo.mp4", VOICE / "voiceover.mp3")


main()
