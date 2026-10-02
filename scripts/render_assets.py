"""
Procedural, fully original imagery for the Solenne site.

Every image is rendered from noise, gradients and signed-distance shapes —
no photography, no third-party assets. Output: a responsive AVIF + WebP set
at 640 / 1024 / 1600 / 2400 / 3840 px wide, plus public/img/manifest.json
(read by the <picture> Vite plugin), and two silent texture loops.

    pip install numpy scipy pillow
    python3 scripts/render_assets.py            # images + video
    python3 scripts/render_assets.py --only hero
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, map_coordinates, zoom

ROOT = Path(__file__).resolve().parent.parent
IMG = ROOT / "public" / "img"
VID = ROOT / "public" / "video"
WIDTHS = [640, 1024, 1600, 2400, 3840]
BASE = 1920  # render width; larger sizes are upsampled then re-grained


# ---------------------------------------------------------------- helpers
def hexrgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i : i + 2], 16) for i in (0, 2, 4)], dtype=np.float32) / 255


def grid(h, w):
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    return x / w, y / h


def lerp(a, b, t):
    t = np.asarray(t, dtype=np.float32)
    if t.ndim == 2:
        t = t[..., None]
    return a + (b - a) * t


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def vgrad(h, w, stops):
    """stops: [(pos 0..1, '#hex'), ...] top to bottom."""
    _, y = grid(h, w)
    out = np.zeros((h, w, 3), np.float32)
    pos = [s[0] for s in stops]
    cols = [hexrgb(s[1]) for s in stops]
    for c in range(3):
        out[..., c] = np.interp(y, pos, [col[c] for col in cols])
    return out


def noise(h, w, cells, seed, octaves=1, persistence=0.5):
    rng = np.random.default_rng(seed)
    total = np.zeros((h, w), np.float32)
    amp, norm = 1.0, 0.0
    for o in range(octaves):
        c = max(2, int(cells * 2**o))
        ch = max(2, int(c * h / w))
        g = rng.random((ch + 3, c + 3)).astype(np.float32)
        z = zoom(g, ((h + 3 * h / ch) / (ch + 3), (w + 3 * w / c) / (c + 3)), order=3)
        total += amp * z[:h, :w]
        norm += amp
        amp *= persistence
    return np.clip(total / norm, 0, 1)


def blur(a, s):
    if a.ndim == 3:
        return np.stack([gaussian_filter(a[..., c], s) for c in range(a.shape[2])], -1)
    return gaussian_filter(a, s)


def paint(img, mask, col, alpha=1.0):
    m = np.clip(mask * alpha, 0, 1)[..., None]
    c = col if isinstance(col, np.ndarray) and col.ndim == 3 else np.asarray(col, np.float32)
    return img * (1 - m) + c * m


def rect(h, w, x0, y0, x1, y1, soft=1.0):
    x, y = grid(h, w)
    px = soft / w
    py = soft / h
    return smooth(x0 - px, x0 + px, x) * (1 - smooth(x1 - px, x1 + px, x)) * smooth(y0 - py, y0 + py, y) * (
        1 - smooth(y1 - py, y1 + py, y)
    )


def arch(h, w, cx, top, bottom, half_w, soft=1.0):
    """Round arch: semicircle of radius half_w sitting on a rectangle. Coords in 0..1 of width/height."""
    x, y = grid(h, w)
    X = x * w
    Y = y * h
    cxp, r = cx * w, half_w * w
    spring = top * h + r
    inside_rect = np.maximum(np.abs(X - cxp) - r, Y - bottom * h)
    d_circle = np.sqrt((X - cxp) ** 2 + (Y - spring) ** 2) - r
    d = np.where(Y < spring, np.maximum(d_circle, Y - bottom * h), inside_rect)
    return np.clip(0.5 - d / (2 * soft), 0, 1)


def glow(h, w, cx, cy, rx, ry):
    x, y = grid(h, w)
    d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
    return np.exp(-d)


def vignette(img, k=0.35):
    h, w, _ = img.shape
    x, y = grid(h, w)
    d = np.sqrt((x - 0.5) ** 2 * 1.2 + (y - 0.5) ** 2)
    return img * (1 - k * smooth(0.3, 0.85, d))[..., None]


def ridge(w, seed, base, amp, cells=6):
    n = noise(2, w, cells, seed, octaves=4)[0]
    return base - amp * n


def tone(img, lift=0.0, gamma=1.0):
    img = np.clip(img, 0, 1)
    return np.clip(lift + (1 - lift) * img**gamma, 0, 1)


def stones(h, w, seed, col, var=0.06):
    n = noise(h, w, 40, seed, octaves=4) - 0.5
    n2 = noise(h, w, 220, seed + 1, octaves=2) - 0.5
    return np.clip(col + (n * var + n2 * var * 0.6)[..., None], 0, 1)


# ---------------------------------------------------------------- scenes
def scene_hero(h, w):
    img = vgrad(h, w, [(0, "#2e3d63"), (0.28, "#6f86a8"), (0.5, "#b5cedb"), (0.62, "#e9c4c8"), (0.7, "#f3d2c4"), (1, "#f3d2c4")])
    img = paint(img, glow(h, w, 0.72, 0.6, 0.35, 0.12), hexrgb("#fde6d2"), 0.8)
    clouds = smooth(0.55, 0.8, noise(h, w, 5, 3, octaves=5)) * (1 - smooth(0.3, 0.55, grid(h, w)[1]))
    img = paint(img, clouds, hexrgb("#d9b9c6"), 0.35)
    x, y = grid(h, w)
    # far hills, two layers with aerial perspective
    for i, (base, amp, col, a) in enumerate([(0.62, 0.09, "#8c93b4", 0.85), (0.69, 0.07, "#6a6c93", 0.95)]):
        r = ridge(w, 10 + i, base, amp)
        img = paint(img, smooth(-0.004, 0.004, y - r[None, :]), hexrgb(col), a)
    shore = 0.75
    # pavilion: long, low, arcaded
    body = rect(h, w, 0.16, 0.5, 0.84, shore, 1.2)
    facade = stones(h, w, 7, hexrgb("#c9a9a6"), 0.05)
    facade = lerp(facade, hexrgb("#a88494"), smooth(0.5, 0.75, y) * 0.5)
    img = paint(img, body, facade)
    img = paint(img, rect(h, w, 0.15, 0.495, 0.85, 0.51, 1), hexrgb("#e6cfc6"))  # cornice
    for i in range(10):
        cx = 0.2 + i * (0.6 / 9)
        if abs(cx - 0.5) < 0.05:
            continue
        a = arch(h, w, cx, 0.56, shore - 0.012, 0.018)
        interior = lerp(hexrgb("#4b3346"), hexrgb("#f6c79a"), smooth(0.62, shore, y) * 0.55)
        img = paint(img, a, interior)
    # the doorway the camera flies into: its sill sits at 50% / 75%
    door = arch(h, w, 0.5, 0.53, shore, 0.045)
    door_col = lerp(hexrgb("#fbf3e6"), hexrgb("#b5cedb"), smooth(0.53, 0.75, y))
    img = paint(img, door, door_col)
    img = paint(img, blur(door, 18) * (1 - door), hexrgb("#fde3c4"), 0.55)
    # lake: mirrored, rippled, darkened
    sky_part = img[: int(shore * h)][::-1]
    lake_h = h - int(shore * h)
    refl = sky_part[:lake_h]
    if refl.shape[0] < lake_h:
        refl = np.concatenate([refl, np.repeat(refl[-1:], lake_h - refl.shape[0], 0)])
    ripple = (noise(lake_h, w, 3, 21, octaves=3) - 0.5) * 18
    ripple += np.sin(np.linspace(0, 90, lake_h))[:, None] * 1.2
    yy, xx = np.mgrid[0:lake_h, 0:w].astype(np.float32)
    refl = np.stack([map_coordinates(refl[..., c], [yy, np.clip(xx + ripple, 0, w - 1)], order=1, mode="nearest") for c in range(3)], -1)
    refl = blur(refl, 1.6)
    depth = np.linspace(0, 1, lake_h)[:, None, None]
    refl = lerp(refl * 0.82, hexrgb("#33405f"), depth * 0.55)
    streaks = smooth(0.6, 0.95, noise(lake_h, w, 1, 23)[..., None] * noise(lake_h, w * 1, 60, 24)[..., None])
    refl = refl + streaks * 0.08
    img[int(shore * h) :] = refl
    img = paint(img, rect(h, w, 0, shore - 0.002, 1, shore + 0.004, 1), hexrgb("#3c3550"), 0.6)
    # foreground reeds at the edges
    rng = np.random.default_rng(31)
    reeds = np.zeros((h, w), np.float32)
    for _ in range(260):
        side = rng.random() < 0.5
        bx = rng.uniform(0, 0.17) if side else rng.uniform(0.83, 1)
        top = rng.uniform(0.74, 0.93)
        lean = rng.uniform(-0.02, 0.02)
        xs = (bx + lean * (1 - (y - top) / (1 - top)))
        reeds = np.maximum(reeds, (np.abs(x - xs) < rng.uniform(0.0007, 0.0016)) * (y > top))
    img = paint(img, blur(reeds, 0.8), hexrgb("#221a2c"), 0.92)
    return vignette(tone(img), 0.3)


def scene_facade(h, w, seed=40):
    x, y = grid(h, w)
    img = vgrad(h, w, [(0, "#9fbdd0"), (0.18, "#c7dbe5"), (1, "#c7dbe5")])
    wall = stones(h, w, seed, hexrgb("#e4d5c3"), 0.07)
    img = paint(img, rect(h, w, -0.1, 0.12, 1.1, 1.1, 1), wall)
    # coursing lines
    course = (np.abs(((y * h) % (h / 14)) - 1) < 0.8).astype(np.float32)
    img = paint(img, course * (y > 0.12), hexrgb("#c9b7a3"), 0.6)
    for row in range(3):
        for col in range(2):
            cx = 0.28 + col * 0.44
            top = 0.18 + row * 0.28
            a = arch(h, w, cx, top, top + 0.24, 0.15)
            inside = lerp(hexrgb("#6a5560"), hexrgb("#3d2b3a"), smooth(top, top + 0.24, y))
            img = paint(img, a, inside)
            img = paint(img, arch(h, w, cx, top - 0.008, top + 0.24, 0.158) * (1 - a), hexrgb("#f3eadf"), 0.8)
    # raking shadow
    sh = smooth(-0.02, 0.02, (x * 0.9 + y * 0.55) - 0.75)
    img = img * (1 - sh * 0.28)[..., None] + sh[..., None] * hexrgb("#5d4a66") * 0.06
    return vignette(tone(img), 0.25)


def scene_interior(h, w, seed=50, view=True, furniture="none"):
    x, y = grid(h, w)
    img = stones(h, w, seed, hexrgb("#efe6da"), 0.03)
    floor_y = 0.74
    floor = lerp(hexrgb("#c6a585"), hexrgb("#9c7b60"), smooth(floor_y, 1, y))
    planks = (np.abs(((x * w + (y - floor_y) * w * 0.4) % (w / 9)) - 1) < 0.9).astype(np.float32)
    floor = paint(floor, planks, hexrgb("#8a6a52"), 0.25)
    img = paint(img, smooth(floor_y - 0.002, floor_y + 0.002, y), floor)
    if view:
        win = arch(h, w, 0.5, 0.12, floor_y, 0.2)
        outside = vgrad(h, w, [(0, "#9fbdd0"), (0.45, "#cfe0e8"), (0.55, "#e9d3d0"), (0.6, "#8c93b4"), (0.62, "#6f8aa6"), (1, "#5c7896")])
        img = paint(img, win, outside)
        mull = (np.abs(x - 0.5) < 0.002) | (np.abs(y - 0.45) < 0.002)
        img = paint(img, mull * win, hexrgb("#efe6da"))
        # light pool on the floor
        shear = arch(h, w, 0.5, 0.74, 1.1, 0.24)
        img = paint(img, blur(shear, 6) * (y > floor_y), hexrgb("#fff1dc"), 0.45)
    if furniture == "bed":
        img = paint(img, rect(h, w, 0.08, 0.64, 0.34, 0.82, 2), hexrgb("#f6f1ea"))
        img = paint(img, rect(h, w, 0.08, 0.56, 0.1, 0.82, 2), hexrgb("#6e5446"))
        img = paint(img, rect(h, w, 0.11, 0.61, 0.2, 0.66, 3), hexrgb("#e4dcd2"))
    elif furniture == "sofa":
        img = paint(img, rect(h, w, 0.06, 0.66, 0.3, 0.8, 3), hexrgb("#b5cedb"))
        img = paint(img, rect(h, w, 0.06, 0.6, 0.3, 0.67, 3), hexrgb("#9fb9c6"))
        img = paint(img, rect(h, w, 0.72, 0.7, 0.9, 0.73, 2), hexrgb("#4a3a3a"))
    elif furniture == "kitchen":
        img = paint(img, rect(h, w, 0.62, 0.62, 0.98, 0.8, 2), hexrgb("#e8e2d8"))
        img = paint(img, rect(h, w, 0.62, 0.6, 0.98, 0.625, 1), hexrgb("#f8f5ee"))
        img = paint(img, rect(h, w, 0.02, 0.2, 0.22, 0.74, 2), hexrgb("#d7cbbb"))
    img = img * (0.86 + 0.14 * smooth(0, 0.5, 1 - np.abs(x - 0.5)))[..., None]
    return vignette(tone(img), 0.3)


def scene_panorama(h, w, seed=60, mood="morning"):
    x, y = grid(h, w)
    if mood == "morning":
        img = vgrad(h, w, [(0, "#a9c4d4"), (0.45, "#dbe6ea"), (0.55, "#f3e3df"), (1, "#f3e3df")])
    else:
        img = vgrad(h, w, [(0, "#6d6a96"), (0.35, "#c79cb5"), (0.55, "#f8c9c3"), (1, "#f8c9c3")])
    img = paint(img, glow(h, w, 0.3, 0.5, 0.4, 0.15), hexrgb("#fff4e8"), 0.6)
    horizon = 0.56
    cols = ["#b9bfd2", "#9aa3c0", "#7b84a6", "#5d6589"] if mood == "morning" else ["#c7a3bd", "#a3829f", "#7c6584", "#55456a"]
    for i, c in enumerate(cols):
        r = ridge(w, seed + i, horizon - 0.02 + i * 0.03, 0.06 + i * 0.03, 3 + i)
        img = paint(img, smooth(-0.003, 0.003, y - r[None, :]) * (y < horizon + 0.02 + i * 0.05), hexrgb(c), 0.9)
        mist = glow(h, w, 0.5, horizon + i * 0.03, 2, 0.02)
        img = paint(img, mist, hexrgb("#f3f3ec"), 0.25)
    water_top = horizon + 0.12
    lake_h = h - int(water_top * h)
    refl = img[: int(water_top * h)][::-1][:lake_h]
    if refl.shape[0] < lake_h:
        refl = np.concatenate([refl, np.repeat(refl[-1:], lake_h - refl.shape[0], 0)])
    yy, xx = np.mgrid[0:lake_h, 0:w].astype(np.float32)
    rip = (noise(lake_h, w, 4, seed + 9, octaves=3) - 0.5) * 14
    refl = np.stack([map_coordinates(refl[..., c], [yy, np.clip(xx + rip, 0, w - 1)], order=1, mode="nearest") for c in range(3)], -1)
    refl = lerp(blur(refl, 2), hexrgb("#6f86a8" if mood == "morning" else "#5a4a6e"), np.linspace(0.1, 0.5, lake_h)[:, None])
    img[int(water_top * h) :] = refl
    # pier
    if mood == "morning":
        img = paint(img, rect(h, w, 0.58, water_top + 0.06, 1.0, water_top + 0.075, 1.5), hexrgb("#4a3b45"))
        for px in np.arange(0.6, 1.0, 0.045):
            img = paint(img, rect(h, w, px, water_top + 0.07, px + 0.004, water_top + 0.14, 1), hexrgb("#3a2e38"))
    return vignette(tone(img), 0.22)


def scene_reeds(h, w, seed=70):
    x, y = grid(h, w)
    img = vgrad(h, w, [(0, "#cfe0e8"), (0.5, "#f3e9e2"), (0.52, "#b5cedb"), (1, "#8fa9bf")])
    img = paint(img, glow(h, w, 0.6, 0.45, 0.5, 0.2), hexrgb("#fffaf0"), 0.7)
    rng = np.random.default_rng(seed)
    for layer, (col, n, blurv) in enumerate([("#9a9cb3", 120, 3.0), ("#5e5872", 140, 1.2), ("#2b2234", 90, 0.4)]):
        m = np.zeros((h, w), np.float32)
        for _ in range(n):
            bx = rng.random()
            top = rng.uniform(0.15, 0.6) + layer * 0.08
            bend = rng.uniform(-0.05, 0.05)
            t = np.clip((y - top) / (1 - top), 0, 1)
            xs = bx + bend * (1 - t) ** 2
            width = rng.uniform(0.0012, 0.003) * (0.4 + t)
            m = np.maximum(m, (np.abs(x - xs) < width) * (y > top))
            # seed heads
            m = np.maximum(m, glow(h, w, bx + bend, top + 0.03, 0.004, 0.03) > 0.5)
        img = paint(img, blur(m, blurv), hexrgb(col), 0.9)
    return vignette(tone(img), 0.25)


def scene_pool(h, w, seed=80):
    x, y = grid(h, w)
    img = stones(h, w, seed, hexrgb("#e6dccd"), 0.05)
    joints = ((np.abs(((x * w) % (w / 8)) - 1) < 0.8) | (np.abs(((y * h) % (h / 6)) - 1) < 0.8)).astype(np.float32)
    img = paint(img, joints, hexrgb("#cdbfac"), 0.7)
    pool = rect(h, w, 0.18, 0.2, 0.82, 0.8, 2)
    c1 = noise(h, w, 18, seed + 1, octaves=3)
    caust = smooth(0.45, 0.5, c1) * (1 - smooth(0.5, 0.56, c1))
    water = lerp(hexrgb("#6fa7bf"), hexrgb("#3f7e9e"), y)
    water = water + caust[..., None] * 0.22
    img = paint(img, pool, water)
    img = paint(img, blur(pool, 8) * (1 - pool), hexrgb("#7a6a5c"), 0.25)
    sh = smooth(-0.01, 0.01, x * 0.7 - y * 0.3 - 0.35)
    img = img * (1 - 0.18 * (1 - sh))[..., None]
    return vignette(tone(img), 0.25)


def scene_spa(h, w, seed=90):
    x, y = grid(h, w)
    img = stones(h, w, seed, hexrgb("#5a4048"), 0.06)
    niche = arch(h, w, 0.5, 0.15, 0.85, 0.2)
    img = paint(img, niche, lerp(hexrgb("#f6c79a"), hexrgb("#b47a6e"), y))
    img = paint(img, blur(niche, 40) * (1 - niche), hexrgb("#e8a98c"), 0.4)
    img = paint(img, rect(h, w, 0.0, 0.8, 1, 1.0, 2), hexrgb("#3a2a33"))
    steam = noise(h, w, 4, seed + 2, octaves=5) * smooth(1, 0.3, y)
    img = paint(img, steam, hexrgb("#f3e9e2"), 0.45)
    return vignette(tone(img), 0.35)


def scene_library(h, w, seed=100):
    x, y = grid(h, w)
    img = stones(h, w, seed, hexrgb("#d9c9b5"), 0.04)
    rng = np.random.default_rng(seed)
    palette = ["#340c24", "#17233b", "#b5cedb", "#f8bbcb", "#8c6a54", "#efe6da", "#6a5c7a"]
    for cx in (0.2, 0.5, 0.8):
        a = arch(h, w, cx, 0.1, 0.92, 0.12)
        img = paint(img, a, hexrgb("#4b3a37"))
        for shelf in range(7):
            sy0 = 0.26 + shelf * 0.095
            bx = cx - 0.11
            while bx < cx + 0.11:
                bw = rng.uniform(0.006, 0.014)
                bh = rng.uniform(0.055, 0.075)
                img = paint(img, rect(h, w, bx, sy0 + 0.08 - bh, bx + bw, sy0 + 0.08, 0.8) * a, hexrgb(palette[rng.integers(len(palette))]), 0.9)
                bx += bw + 0.001
            img = paint(img, rect(h, w, cx - 0.12, sy0 + 0.08, cx + 0.12, sy0 + 0.086, 1) * a, hexrgb("#7a5f4e"))
    img = paint(img, glow(h, w, 0.5, 0.0, 0.6, 0.4), hexrgb("#fff3df"), 0.35)
    return vignette(tone(img), 0.35)


def scene_garden(h, w, seed=110):
    x, y = grid(h, w)
    img = vgrad(h, w, [(0, "#dfe8d8"), (1, "#7d9473")])
    for i, (cells, col, a) in enumerate([(6, "#5f7a5a", 0.8), (12, "#46624a", 0.7), (24, "#8faa7d", 0.5)]):
        n = noise(h, w, cells, seed + i, octaves=4)
        img = paint(img, smooth(0.45, 0.6, n), hexrgb(col), a)
    path = np.abs(x - 0.5 - (y - 1) * 0.2) < (0.02 + 0.2 * y**2)
    img = paint(img, blur(path.astype(np.float32) * (y > 0.45), 3), hexrgb("#e6dccd"), 0.9)
    bokeh = smooth(0.82, 0.86, noise(h, w, 30, seed + 9))
    img = paint(img, blur(bokeh, 4), hexrgb("#f8f3d8"), 0.4)
    return vignette(tone(img), 0.3)


def scene_cellar(h, w, seed=120):
    x, y = grid(h, w)
    img = stones(h, w, seed, hexrgb("#6a3f3a"), 0.08)
    bricks = (np.abs(((y * h) % (h / 26)) - 1) < 0.8).astype(np.float32)
    img = paint(img, bricks, hexrgb("#3f2626"), 0.5)
    for i, (s, col) in enumerate([(0.42, "#2a1a1e"), (0.3, "#3a2328"), (0.18, "#4f3034"), (0.08, "#140c10")]):
        img = paint(img, arch(h, w, 0.5, 0.5 - s, 1.2, s), hexrgb(col), 0.9)
    for lx in (0.32, 0.68):
        img = paint(img, glow(h, w, lx, 0.35, 0.05, 0.07), hexrgb("#ffc985"), 0.9)
    img = paint(img, glow(h, w, 0.5, 0.75, 0.2, 0.2), hexrgb("#f6c79a"), 0.35)
    return vignette(tone(img), 0.4)


def scene_boathouse(h, w, seed=130):
    img = scene_panorama(h, w, seed, "dusk")
    x, y = grid(h, w)
    img = paint(img, rect(h, w, 0.0, 0.7, 0.55, 0.74, 1.5), hexrgb("#3a2e38"))
    for px in np.arange(0.02, 0.55, 0.06):
        img = paint(img, rect(h, w, px, 0.73, px + 0.006, 0.86, 1), hexrgb("#2a2030"))
    img = paint(img, rect(h, w, 0.08, 0.5, 0.36, 0.7, 1.5), hexrgb("#4b3346"))
    img = paint(img, arch(h, w, 0.22, 0.54, 0.7, 0.06), hexrgb("#f6c79a"))
    return img


def scene_orangery(h, w, seed=140):
    x, y = grid(h, w)
    img = vgrad(h, w, [(0, "#e7efe6"), (1, "#cfdcc8")])
    for cx in (0.17, 0.5, 0.83):
        a = arch(h, w, cx, 0.08, 0.95, 0.14)
        inner = lerp(hexrgb("#f4f8f1"), hexrgb("#a8c49c"), y)
        img = paint(img, a, inner)
        bars = ((np.abs(((x * w) % (w / 28)) - 1) < 0.9) | (np.abs(((y * h) % (h / 9)) - 1) < 0.9)).astype(np.float32)
        img = paint(img, bars * a, hexrgb("#f3f3ec"), 0.9)
    leaves = smooth(0.55, 0.62, noise(h, w, 10, seed, octaves=4)) * smooth(0.35, 0.8, y)
    img = paint(img, leaves, hexrgb("#4e6b4c"), 0.85)
    img = paint(img, rect(h, w, 0, 0.94, 1, 1, 1), hexrgb("#d6c7b4"))
    return vignette(tone(img), 0.25)


def scene_lobby(h, w, seed=150):
    x, y = grid(h, w)
    img = stones(h, w, seed, hexrgb("#e8ddd0"), 0.05)
    for i, cx in enumerate(np.linspace(0.1, 0.9, 5)):
        depth = 1 - abs(cx - 0.5) * 1.4
        a = arch(h, w, cx, 0.2 + (1 - depth) * 0.05, 0.86, 0.065)
        img = paint(img, a, lerp(hexrgb("#c7dbe5"), hexrgb("#f3e3df"), y))
    img = paint(img, rect(h, w, 0, 0.86, 1, 1, 1), lerp(hexrgb("#d9cbbb"), hexrgb("#bfa992"), y))
    refl = (y > 0.86) * smooth(0.04, 0.0, np.abs(((x * 5) % 1) - 0.5) - 0.37)
    img = paint(img, blur(refl, 4), hexrgb("#f3f3ec"), 0.3)
    img = paint(img, glow(h, w, 0.5, -0.1, 0.5, 0.5), hexrgb("#fffaf0"), 0.4)
    return vignette(tone(img), 0.25)


def scene_architecture(h, w, seed=160):
    x, y = grid(h, w)
    img = vgrad(h, w, [(0, "#5b6f99"), (0.35, "#b5cedb"), (0.6, "#f2d5d0"), (1, "#f2d5d0")])
    img = paint(img, glow(h, w, 0.5, 0.25, 0.25, 0.25), hexrgb("#fff6ea"), 0.5)
    body = rect(h, w, 0.04, 0.22, 0.96, 1.1, 1.2)
    wall = stones(h, w, seed, hexrgb("#dcc6bd"), 0.05)
    wall = lerp(wall, hexrgb("#b48f9a"), smooth(0.3, 1, y) * 0.45)
    img = paint(img, body, wall)
    img = paint(img, rect(h, w, 0.03, 0.2, 0.97, 0.235, 1), hexrgb("#efe1d8"))
    for storey, (top, bot, hw) in enumerate([(0.3, 0.58, 0.032), (0.64, 0.98, 0.04)]):
        n = 9 if storey == 0 else 7
        for cx in np.linspace(0.12, 0.88, n):
            a = arch(h, w, cx, top, bot, hw)
            inner = lerp(hexrgb("#4b2f43"), hexrgb("#f1b98f"), smooth(top, bot, y) * (0.3 + 0.5 * storey))
            img = paint(img, a, inner)
            img = paint(img, arch(h, w, cx, top - 0.01, bot, hw + 0.006) * (1 - a), hexrgb("#f3eadf"), 0.55)
    img = paint(img, rect(h, w, 0.03, 0.6, 0.97, 0.615, 1), hexrgb("#efe1d8"))
    return vignette(tone(img), 0.3)


def scene_night(h, w, seed=170):
    x, y = grid(h, w)
    img = vgrad(h, w, [(0, "#0f1530"), (0.5, "#2c2e57"), (0.62, "#5a4a73"), (1, "#5a4a73")])
    stars = (np.random.default_rng(seed).random((h, w)) > 0.9993) * (y < 0.45)
    img = paint(img, blur(stars.astype(np.float32), 0.7) * 2.5, hexrgb("#f3f3ec"), 0.8)
    shore = 0.66
    r = ridge(w, seed + 1, 0.58, 0.07)
    img = paint(img, smooth(-0.003, 0.003, y - r[None, :]), hexrgb("#1c1834"))
    img = paint(img, rect(h, w, 0.22, 0.46, 0.78, shore, 1.2), hexrgb("#2b2032"))
    for i, cx in enumerate(np.linspace(0.26, 0.74, 9)):
        lit = "#ffcf94" if i % 3 else "#fbe7c4"
        img = paint(img, arch(h, w, cx, 0.5, shore - 0.01, 0.02), hexrgb(lit), 0.95)
    img = paint(img, blur(rect(h, w, 0.22, 0.48, 0.78, shore, 1), 25), hexrgb("#ffb877"), 0.25)
    lake_h = h - int(shore * h)
    refl = img[: int(shore * h)][::-1][:lake_h]
    yy, xx = np.mgrid[0:lake_h, 0:w].astype(np.float32)
    rip = (noise(lake_h, w, 2, seed + 4, octaves=3) - 0.5) * 26
    yrip = np.sin(np.linspace(0, 140, lake_h))[:, None] * 3
    refl = np.stack([map_coordinates(refl[..., c], [np.clip(yy + yrip, 0, lake_h - 1), np.clip(xx + rip, 0, w - 1)], order=1, mode="nearest") for c in range(3)], -1)
    img[int(shore * h) :] = lerp(blur(refl, 1.5) * 0.7, hexrgb("#141a33"), np.linspace(0, 0.6, lake_h)[:, None])
    return vignette(tone(img), 0.35)


def scene_terrace(h, w, seed=180):
    img = scene_panorama(h, w, seed, "dusk")
    x, y = grid(h, w)
    img = paint(img, rect(h, w, 0, 0.78, 1, 1, 1.5), stones(h, w, seed, hexrgb("#d8c3b4"), 0.05))
    img = paint(img, rect(h, w, 0, 0.7, 1, 0.715, 1), hexrgb("#efe1d8"))
    for px in np.linspace(0.02, 0.98, 30):
        img = paint(img, rect(h, w, px, 0.715, px + 0.008, 0.78, 1), hexrgb("#e3d2c6"))
    img = paint(img, rect(h, w, 0.06, 0.82, 0.3, 0.86, 2), hexrgb("#f3f3ec"))
    return img


SCENES = {
    # name: (fn, aspect w/h, kwargs, alt is authored in HTML)
    "hero": (scene_hero, 16 / 9, {}),
    "overview-facade": (scene_facade, 4 / 5, {}),
    "overview-interior": (scene_interior, 3 / 2, {}),
    "location-panorama": (scene_panorama, 2 / 1, {"mood": "morning"}),
    "location-reeds": (scene_reeds, 4 / 5, {}),
    "location-hills": (scene_panorama, 3 / 2, {"seed": 66, "mood": "dusk"}),
    "amenity-pool": (scene_pool, 4 / 3, {}),
    "amenity-spa": (scene_spa, 4 / 3, {}),
    "amenity-library": (scene_library, 4 / 3, {}),
    "amenity-garden": (scene_garden, 4 / 3, {}),
    "amenity-cellar": (scene_cellar, 4 / 3, {}),
    "amenity-boathouse": (scene_boathouse, 4 / 3, {}),
    "amenity-orangery": (scene_orangery, 4 / 3, {}),
    "amenity-lobby": (scene_lobby, 4 / 3, {}),
    "architecture": (scene_architecture, 16 / 9, {}),
    "residence-one": (scene_interior, 3 / 2, {"seed": 51, "furniture": "bed"}),
    "residence-two": (scene_interior, 3 / 2, {"seed": 52, "furniture": "sofa"}),
    "residence-three": (scene_interior, 3 / 2, {"seed": 53, "furniture": "kitchen"}),
    "residence-penthouse": (scene_terrace, 3 / 2, {}),
    "closing": (scene_night, 16 / 9, {}),
}


def grain(img, amount, seed):
    rng = np.random.default_rng(seed)
    g = rng.normal(0, amount, img.shape[:2]).astype(np.float32)[..., None]
    return np.clip(img + g, 0, 1)


def export(name, img, manifest):
    h0, w0, _ = img.shape
    base = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8))
    entry = {"w": w0, "h": h0, "sizes": []}
    for i, W in enumerate(WIDTHS):
        H = round(W * h0 / w0)
        im = base.resize((W, H), Image.LANCZOS)
        arr = np.asarray(im).astype(np.float32) / 255
        arr = grain(arr, 0.012, i + sum(map(ord, name)))
        im = Image.fromarray((arr * 255).astype(np.uint8))
        q_avif = 52 if W >= 2400 else 58
        im.save(IMG / f"{name}-{W}.avif", quality=q_avif, speed=6)
        im.save(IMG / f"{name}-{W}.webp", quality=74 if W >= 2400 else 80, method=5)
        entry["sizes"].append(W)
        entry["ratio"] = [W, H]
    entry["w"], entry["h"] = entry["ratio"]
    manifest[name] = entry
    kb = (IMG / f"{name}-1600.avif").stat().st_size // 1024
    print(f"  {name}: 1600 avif {kb} KB")


# ---------------------------------------------------------------- video
def video_water(path, w=1280, h=720, fps=24, secs=5):
    """Seamless loop: every motion term is periodic in `secs`."""
    frames = fps * secs
    x, y = grid(h, w)
    base = vgrad(h, w, [(0, "#8fb0c4"), (0.5, "#6f8fae"), (1, "#3f5878")])
    n1 = noise(h, w, 6, 1, octaves=3)
    proc = ffmpeg_pipe(path, w, h, fps)
    for f in range(frames):
        t = 2 * np.pi * f / frames
        persp = 1 / (0.15 + y)
        wave = (
            np.sin(x * 40 * persp ** 0.5 + y * 90 + 3 * t + n1 * 6)
            + 0.6 * np.sin(x * 23 - y * 140 * persp ** 0.3 - 2 * t + n1 * 9)
            + 0.4 * np.sin(y * 300 + 4 * t + n1 * 12)
        )
        glints = smooth(1.35, 1.9, wave) * (0.4 + 0.6 * glow(h, w, 0.62, 0.15, 0.6, 0.5))
        frame = base + (wave * 0.025)[..., None] + glints[..., None] * hexrgb("#fff4e3") * 0.55
        proc.stdin.write((np.clip(frame, 0, 1) * 255).astype(np.uint8).tobytes())
    finish(proc, path)


def video_leaves(path, w=720, h=900, fps=24, secs=6):
    frames = fps * secs
    x, y = grid(h, w)
    wall = stones(h, w, 5, hexrgb("#efe4d6"), 0.04)
    pad = 120
    big = noise(h + pad * 2, w + pad * 2, 7, 9, octaves=4)
    proc = ffmpeg_pipe(path, w, h, fps)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    for f in range(frames):
        t = 2 * np.pi * f / frames
        dx = pad + 40 * np.sin(t) + 14 * np.sin(2 * t + 1) + 10 * np.sin(yy / 90 + t)
        dy = pad + 20 * np.cos(t) + 8 * np.sin(xx / 120 - 2 * t)
        n = map_coordinates(big, [yy + dy, xx + dx], order=1)
        shade = smooth(0.46, 0.56, n)
        shade = gaussian_filter(shade, 6)
        light = (1 - shade)[..., None]
        frame = wall * (0.78 + 0.22 * light) + light * hexrgb("#fff2dc") * 0.08
        frame = frame * (1 - 0.06 * shade[..., None]) + shade[..., None] * hexrgb("#6a5c7a") * 0.05
        proc.stdin.write((np.clip(frame, 0, 1) * 255).astype(np.uint8).tobytes())
    finish(proc, path)


def ffmpeg_pipe(path, w, h, fps):
    raw = path.with_suffix(".y4m")
    return subprocess.Popen(
        ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{w}x{h}", "-r", str(fps), "-i", "-", "-pix_fmt", "yuv420p", str(raw)],
        stdin=subprocess.PIPE,
    )


def finish(proc, path):
    proc.stdin.close()
    proc.wait()
    raw = path.with_suffix(".y4m")
    run = lambda *a: subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw), *a], check=True)
    run("-c:v", "libx264", "-profile:v", "high", "-crf", "24", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", str(path.with_suffix(".mp4")))
    run("-c:v", "libvpx-vp9", "-crf", "36", "-b:v", "0", "-row-mt", "1", "-an", str(path.with_suffix(".webm")))
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw), "-frames:v", "1", "-c:v", "libwebp", "-quality", "78", str(path.with_name(path.stem + "-poster.webp"))], check=True)
    raw.unlink()
    print(f"  {path.stem}: mp4 {path.with_suffix('.mp4').stat().st_size // 1024} KB, webm {path.with_suffix('.webm').stat().st_size // 1024} KB")


def main():
    IMG.mkdir(parents=True, exist_ok=True)
    VID.mkdir(parents=True, exist_ok=True)
    only = sys.argv[sys.argv.index("--only") + 1] if "--only" in sys.argv else None
    mpath = IMG / "manifest.json"
    manifest = json.loads(mpath.read_text()) if mpath.exists() else {}
    for name, (fn, aspect, kw) in SCENES.items():
        if only and only != name:
            continue
        h = round(BASE / aspect)
        export(name, fn(h, BASE, **kw), manifest)
    mpath.write_text(json.dumps(dict(sorted(manifest.items())), indent=1))
    if not only or only == "video":
        video_water(VID / "water.mp4")
        video_leaves(VID / "leaves.mp4")


if __name__ == "__main__":
    main()
