#!/usr/bin/env python3
"""Generate the ORBIT IDE brand icon (original artwork, no Tauri default)."""
import math, os
from PIL import Image, ImageDraw, ImageFilter

S = 4096          # supersampled master
OUT = 1024        # final size
RADIUS = 0.22     # squircle corner radius fraction

CX, CY = S / 2, S / 2
RX, RY = 0.345 * S, 0.158 * S      # orbit ellipse radii (rotated later)
RING_W = 0.048 * S
PLANET_R = 0.146 * S
SAT_R = 0.034 * S
TILT = -26                          # degrees, rotates whole orbit group

C1 = (124, 92, 255)   # purple
C2 = (57, 217, 138)   # green
C3 = (255, 92, 135)   # pink
BG_TOP = (16, 18, 46)
BG_BOT = (28, 16, 62)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def make_bg():
    g = Image.new('RGB', (S, S))
    d = ImageDraw.Draw(g)
    for y in range(S):
        d.line([(0, y), (S, y)], fill=lerp(BG_TOP, BG_BOT, y / S))
    # center glow
    glow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    rr = 0.52 * S
    gd.ellipse([CX - rr, CY - rr, CX + rr, CY + rr], fill=(124, 92, 255, 66))
    glow = glow.filter(ImageFilter.GaussianBlur(S * 0.12))
    g = Image.alpha_composite(g.convert('RGBA'), glow)

    mask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, S - 1, S - 1], radius=int(RADIUS * S), fill=255)
    out = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    out.paste(g, (0, 0), mask)
    return out


def orbit_points(t):
    """parametric point on the ellipse, t in [0, 360). math convention y-up."""
    a = math.radians(t)
    return (CX + RX * math.cos(a), CY - RY * math.sin(a))


def draw_arc_half(img, t0, t1, steps=760):
    """draw ring half; color lerps green(right) -> purple(left) along horizontal span."""
    d = ImageDraw.Draw(img)
    for i in range(steps):
        t = t0 + (t1 - t0) * i / steps
        t2 = t0 + (t1 - t0) * (i + 1) / steps
        p = orbit_points(t)
        q = orbit_points(t2)
        color = lerp(C2, C1, (1 - math.cos(math.radians((t + t2) / 2))) / 2)
        d.line([p, q], fill=color + (255,), width=int(RING_W))
        # round caps
        d.ellipse([p[0] - RING_W / 2, p[1] - RING_W / 2,
                   p[0] + RING_W / 2, p[1] + RING_W / 2], fill=color + (255,))


def make_planet():
    """planet via exact per-pixel numpy fields (no draw-order pitfalls)."""
    import numpy as np
    RG = PLANET_R * 2.4                      # halo reach
    size = int(RG * 2)
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    c = size / 2
    rr = np.hypot(xx - c, yy - c)
    pr = float(PLANET_R)

    # planet body: 3-stop radial gradient, hard clip at planet edge
    s = np.clip(rr / pr, 0, 1)               # 0 center -> 1 edge
    t1 = np.clip(s / 0.42, 0, 1)
    t2 = np.clip((s - 0.42) / 0.58, 0, 1)
    CENTER_C = np.array([208, 182, 255], np.float32)
    MID_C = np.array(C1, np.float32)
    EDGE_C = np.array([82, 50, 212], np.float32)
    r_, g_, b_ = [CENTER_C[k] + (MID_C[k] - CENTER_C[k]) * t1
                  + (EDGE_C[k] - MID_C[k]) * t2 for k in range(3)]
    body_a = (rr <= pr).astype(np.float32) * 255.0

    # top-left highlight: light lavender, quadratic falloff
    hr = pr * 0.62
    hx, hy = c - pr * 0.34, c - pr * 0.42
    rh = np.clip(np.hypot(xx - hx, yy - hy) / hr, 0, 1)
    hl_a = 46.0 * (1 - rh) ** 2
    hl_c = np.array([238, 230, 255], np.float32)

    # halo: purple glow between planet edge and canvas edge, alpha -> 0 exactly at edge
    halo_in, halo_out = pr * 0.98, RG
    halot = np.clip((rr - halo_in) / (halo_out - halo_in), 0, 1)
    halo_a = 95.0 * (1 - halot) ** 2 * (rr > halo_in)
    halo_a = np.minimum(halo_a, 255).astype(np.float32)
    halo_c = np.array(C1, np.float32)

    def over(dst, src_c, src_a):
        """standard 'src over dst' compositing of two RGBA float layers."""
        d_c, d_a = dst
        a = src_a / 255.0
        out_a = a + (d_a / 255.0) * (1 - a)
        out_c = np.where(out_a[..., None] > 0,
                         (src_c * (src_a / 255.0)[..., None]
                          + d_c * (d_a / 255.0)[..., None] * (1 - a)[..., None])
                         / np.maximum(out_a[..., None], 1e-6), 0)
        return out_c, out_a * 255.0

    col = np.dstack([r_, g_, b_])
    img_c, img_a = over((np.zeros((size, size, 3), np.float32),
                         np.zeros((size, size), np.float32)), col, body_a)
    img_c, img_a = over((img_c, img_a), hl_c, hl_a)
    img_c, img_a = over((img_c, img_a), halo_c, halo_a)

    out = np.dstack([np.clip(img_c, 0, 255).astype(np.uint8),
                     np.clip(img_a, 0, 255).astype(np.uint8)])
    from PIL import Image as _I
    return _I.fromarray(out, 'RGBA')


def rotate_about_center(img, deg):
    return img.rotate(deg, resample=Image.BICUBIC, center=(CX, CY))


def build(size):
    bg = make_bg()
    top_half = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    bot_half = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    draw_arc_half(top_half, 0, 180)      # upper half (behind planet)
    draw_arc_half(bot_half, 180, 360)    # lower half (in front)
    # rotate whole orbit group
    top_half = rotate_about_center(top_half, TILT)
    bot_half = rotate_about_center(bot_half, TILT)
    planet = make_planet()

    # satellite dot rides the front (lower) half, right side
    sat_t = 325  # degrees, lower-right of front arc
    sx, sy = rotate_point_about_center(orbit_points(sat_t), TILT)
    sat = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sat)
    glow_r = SAT_R * 3.2
    sd.ellipse([sx - glow_r, sy - glow_r, sx + glow_r, sy + glow_r], fill=C2 + (90,))
    sat = sat.filter(ImageFilter.GaussianBlur(SAT_R * 1.0))
    sd2 = ImageDraw.Draw(sat)
    sd2.ellipse([sx - SAT_R, sy - SAT_R, sx + SAT_R, sy + SAT_R], fill=(230, 255, 244, 255))

    out = Image.alpha_composite(bg, top_half)
    out.alpha_composite(planet, (int(CX - planet.width / 2), int(CY - planet.height / 2)))
    out = Image.alpha_composite(out, bot_half)
    out = Image.alpha_composite(out, sat)
    return out.resize((size, size), Image.LANCZOS)


def rotate_point_about_center(pt, deg):
    x, y = pt
    a = math.radians(deg)
    dx, dy = x - CX, y - CY
    return (CX + dx * math.cos(a) - dy * math.sin(a),
            CY + dx * math.sin(a) + dy * math.cos(a))


if __name__ == '__main__':
    import sys
    out = sys.argv[1] if len(sys.argv) > 1 else 'icon.png'
    build(OUT).convert('RGB').save(out, optimize=True)
    print('saved', out)
