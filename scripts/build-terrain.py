"""Render the Nepal map from AWS Terrarium tiles and geoBoundaries ADM0."""
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from pathlib import Path
import json
import math
import os
import subprocess

import numpy as np
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[1] / "dist"
ZOOM = 8
WORLD = 256 * 2 ** ZOOM
WIDTH, HEIGHT = 1680, 960
WEST, SOUTH, EAST, NORTH = 79.45, 25.81, 88.92, 30.93
BOUNDARY = "https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/NPL/ADM0/geoBoundaries-NPL-ADM0_simplified.geojson"
TILES = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium"


def download(url):
    return subprocess.check_output(["curl", "--fail", "--silent", "--show-error", "--location",
                                    "--retry", "3", "--retry-all-errors", "--max-time", "20", url])


def mercator(lon, lat):
    return (lon + 180) / 360, (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2


def draw():
    x0, y0 = mercator(WEST, NORTH)
    x1, y1 = mercator(EAST, SOUTH)
    left, top = int(x0 * WORLD) // 256, int(y0 * WORLD) // 256
    right, bottom = int(x1 * WORLD) // 256, int(y1 * WORLD) // 256
    mosaic = Image.new("RGB", ((right - left + 1) * 256, (bottom - top + 1) * 256))

    def load_tile(tile):
        x, y = tile
        return (x - left) * 256, (y - top) * 256, Image.open(BytesIO(download(f"{TILES}/{ZOOM}/{x}/{y}.png"))).convert("RGB")

    with ThreadPoolExecutor(max_workers=6) as pool:
        for x, y, tile in pool.map(load_tile, [(x, y) for x in range(left, right + 1) for y in range(top, bottom + 1)]):
            mosaic.paste(tile, (x, y))

    raw = np.asarray(mosaic, dtype=np.float32)
    elevation = raw[:, :, 0] * 256 + raw[:, :, 1] + raw[:, :, 2] / 256 - 32768
    crop = (x0 * WORLD - left * 256, y0 * WORLD - top * 256, x1 * WORLD - left * 256, y1 * WORLD - top * 256)
    z = np.asarray(Image.fromarray(elevation).resize((WIDTH, HEIGHT), Image.Resampling.BILINEAR, box=crop))
    dy, dx = np.gradient(z / 355)
    norm = np.sqrt(1 + dx * dx + dy * dy)
    light = (0.74 + 0.47 * dx + 0.47 * dy) / norm
    shade = np.clip(light - 0.74, -0.65, 0.25)

    geo = json.loads(download(BOUNDARY))
    rings = []
    mask = Image.new("L", (WIDTH, HEIGHT))
    painter = ImageDraw.Draw(mask)
    for feature in geo["features"]:
        geometry = feature["geometry"]
        polygons = geometry["coordinates"]
        if geometry["type"] == "Polygon":
            polygons = [polygons]
        for polygon in polygons:
            for index, ring in enumerate(polygon):
                pixels = []
                for lon, lat, *_ in ring:
                    x, y = mercator(lon, lat)
                    pixels.append((round((x-x0)/(x1-x0)*WIDTH, 2), round((y-y0)/(y1-y0)*HEIGHT, 2)))
                painter.polygon(pixels, fill=255 if index == 0 else 0)
                rings.append(pixels)

    def palette(low, foothills, uplands, stone, snow):
        return np.stack([
            np.interp(z, [60, 950, 2650, 4800, 6900], channel)
            for channel in zip(low, foothills, uplands, stone, snow)
        ], axis=-1)

    outside = palette((211, 205, 181), (193, 187, 160), (182, 177, 153),
                      (169, 161, 137), (230, 223, 203)) + shade[:, :, None] * 85
    inside = palette((185, 184, 137), (159, 164, 110), (151, 152, 103),
                     (165, 154, 115), (241, 235, 208)) + shade[:, :, None] * 155
    alpha = np.asarray(mask)[:, :, None] / 255
    pixels = np.clip(outside * (1-alpha) + inside * alpha, 0, 255).astype(np.uint8)
    image = Image.fromarray(pixels)
    image.save(OUT / "relief.webp", quality=89, method=6)
    outline = {"width": WIDTH, "height": HEIGHT, "bounds": [WEST, SOUTH, EAST, NORTH], "rings": rings}
    temporary = OUT / "geography.tmp"
    temporary.write_text("window.ATLAS_GEOGRAPHY = " + json.dumps(outline, separators=(",", ":")) + ";\n", encoding="utf8")
    os.replace(temporary, OUT / "geography.js")


if __name__ == "__main__":
    draw()
