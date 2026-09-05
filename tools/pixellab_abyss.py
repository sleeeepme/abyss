#!/usr/bin/env python3
"""PixelLab -> Abyss sprite production helper (stdlib only)."""

import argparse
import base64
import json
import os
import struct
import sys
import time
import urllib.error
import urllib.request
import zlib
from pathlib import Path


API_ROOT = "https://api.pixellab.ai/v2"
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def api_request(method, path, payload=None, api_root=API_ROOT):
    token = os.environ.get("PIXELLAB_API_TOKEN")
    if not token:
        raise RuntimeError("PIXELLAB_API_TOKEN is not set")
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        api_root.rstrip("/") + "/" + path.lstrip("/"),
        data=data,
        method=method,
        headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            return json.load(response)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")
        raise RuntimeError("PixelLab HTTP {}: {}".format(exc.code, detail)) from exc


def find_value(value, keys):
    if isinstance(value, dict):
        for key in keys:
            if key in value and value[key]:
                return value[key]
        for child in value.values():
            found = find_value(child, keys)
            if found:
                return found
    elif isinstance(value, list):
        for child in value:
            found = find_value(child, keys)
            if found:
                return found
    return None


def image_bytes(response):
    candidate = find_value(response, ("base64", "image_base64", "image_url", "url"))
    if not isinstance(candidate, str):
        raise RuntimeError("completed response contains no image: " + json.dumps(response)[:500])
    if candidate.startswith("data:"):
        return base64.b64decode(candidate.split(",", 1)[1])
    if candidate.startswith("http://") or candidate.startswith("https://"):
        with urllib.request.urlopen(candidate, timeout=60) as result:
            return result.read()
    return base64.b64decode(candidate)


def wait_for_job(job_id, interval, timeout, api_root):
    deadline = time.monotonic() + timeout
    while True:
        response = api_request("GET", "background-jobs/" + job_id, api_root=api_root)
        status = str(response.get("status", "")).lower()
        if status in ("completed", "succeeded", "success"):
            return response
        if status in ("failed", "cancelled", "canceled", "error"):
            raise RuntimeError("PixelLab job failed: " + json.dumps(response))
        if time.monotonic() >= deadline:
            raise RuntimeError("PixelLab job timed out: " + job_id)
        time.sleep(interval)


def generate(args):
    payload = {
        "description": args.description,
        "image_size": {"width": args.width, "height": args.height},
        "no_background": not args.background,
    }
    if args.seed is not None:
        payload["seed"] = args.seed
    response = api_request("POST", "generate-image-v2", payload, args.api_root)
    job_id = find_value(response, ("background_job_id", "job_id"))
    if job_id:
        response = wait_for_job(str(job_id), args.poll_interval, args.timeout, args.api_root)
    data = image_bytes(response)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(data)
    print("saved {} ({} bytes)".format(args.output, len(data)))


def raw_request(args):
    payload = json.loads(args.payload.read_text(encoding="utf-8"))
    response = api_request("POST", args.endpoint, payload, args.api_root)
    job_id = find_value(response, ("background_job_id", "job_id"))
    if job_id and args.wait:
        response = wait_for_job(str(job_id), args.poll_interval, args.timeout, args.api_root)
    if args.output and (not job_id or args.wait):
        data = image_bytes(response)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_bytes(data)
        print("saved {} ({} bytes)".format(args.output, len(data)))
    else:
        print(json.dumps(response, ensure_ascii=False, indent=2))


def decode_png(path):
    data = path.read_bytes()
    if not data.startswith(PNG_SIGNATURE):
        raise ValueError("not a PNG")
    pos, compressed, palette, transparency = 8, bytearray(), None, None
    width = height = depth = color_type = interlace = None
    while pos < len(data):
        length = struct.unpack(">I", data[pos:pos + 4])[0]
        kind, chunk = data[pos + 4:pos + 8], data[pos + 8:pos + 8 + length]
        pos += length + 12
        if kind == b"IHDR":
            width, height, depth, color_type, _, _, interlace = struct.unpack(">IIBBBBB", chunk)
        elif kind == b"PLTE":
            palette = [tuple(chunk[i:i + 3]) for i in range(0, len(chunk), 3)]
        elif kind == b"tRNS":
            transparency = chunk
        elif kind == b"IDAT":
            compressed.extend(chunk)
        elif kind == b"IEND":
            break
    channels = {2: 3, 3: 1, 6: 4}.get(color_type)
    if depth != 8 or interlace != 0 or channels is None:
        raise ValueError("only non-interlaced 8-bit RGB, RGBA, or indexed PNG is supported")
    stride = width * channels
    source, offset, previous, rows = zlib.decompress(bytes(compressed)), 0, bytearray(stride), []
    for _ in range(height):
        filter_type, offset = source[offset], offset + 1
        scan = source[offset:offset + stride]
        offset += stride
        row = bytearray(stride)
        for i, value in enumerate(scan):
            left = row[i - channels] if i >= channels else 0
            up = previous[i]
            upper_left = previous[i - channels] if i >= channels else 0
            if filter_type == 0:
                predictor = 0
            elif filter_type == 1:
                predictor = left
            elif filter_type == 2:
                predictor = up
            elif filter_type == 3:
                predictor = (left + up) // 2
            elif filter_type == 4:
                p = left + up - upper_left
                choices = (abs(p - left), abs(p - up), abs(p - upper_left))
                predictor = (left, up, upper_left)[choices.index(min(choices))]
            else:
                raise ValueError("unsupported PNG filter {}".format(filter_type))
            row[i] = (value + predictor) & 255
        rgba = bytearray()
        for x in range(width):
            pixel = row[x * channels:(x + 1) * channels]
            if color_type == 6:
                rgba.extend(pixel)
            elif color_type == 2:
                rgba.extend(pixel + b"\xff")
            else:
                index = pixel[0]
                if palette is None or index >= len(palette):
                    raise ValueError("invalid indexed PNG palette")
                rgba.extend(palette[index])
                rgba.append(transparency[index] if transparency and index < len(transparency) else 255)
        rows.append(bytes(rgba))
        previous = row
    return width, height, rows


def png_chunk(kind, payload):
    return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", zlib.crc32(kind + payload) & 0xffffffff)


def encode_rgba_png(width, height, rows):
    raw = b"".join(b"\x00" + row for row in rows)
    header = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    return PNG_SIGNATURE + png_chunk(b"IHDR", header) + png_chunk(b"IDAT", zlib.compress(raw, 9)) + png_chunk(b"IEND", b"")


def validate(path, expected_width=None, expected_height=None, max_colors=24, require_margin=False):
    width, height, rows = decode_png(path)
    colors, alphas, errors = set(), set(), []
    occupied = []
    for y, row in enumerate(rows):
        for x in range(width):
            rgba = tuple(row[x * 4:x * 4 + 4])
            alphas.add(rgba[3])
            if rgba[3]:
                colors.add(rgba[:3])
                occupied.append((x, y))
    if expected_width is not None and width != expected_width:
        errors.append("width {} != {}".format(width, expected_width))
    if expected_height is not None and height != expected_height:
        errors.append("height {} != {}".format(height, expected_height))
    if len(colors) > max_colors:
        errors.append("{} visible colors > {}".format(len(colors), max_colors))
    if not alphas.issubset({0, 255}):
        errors.append("intermediate alpha values: {}".format(sorted(alphas - {0, 255})))
    if require_margin and occupied:
        xs, ys = zip(*occupied)
        if min(xs) == 0 or min(ys) == 0 or max(xs) == width - 1 or max(ys) == height - 1:
            errors.append("visible pixels touch the canvas edge")
    return width, height, len(colors), errors


def validate_command(args):
    width, height, colors, errors = validate(
        args.input, args.width, args.height, args.max_colors, args.require_margin
    )
    if errors:
        print("FAIL {}: {}".format(args.input, "; ".join(errors)), file=sys.stderr)
        return 1
    print("PASS {}: {}x{}, {} visible colors, binary alpha".format(args.input, width, height, colors))
    return 0


def preview(args):
    width, height, rows = decode_png(args.input)
    scaled = []
    for row in rows:
        expanded = b"".join(row[x * 4:x * 4 + 4] * args.scale for x in range(width))
        scaled.extend([expanded] * args.scale)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(encode_rgba_png(width * args.scale, height * args.scale, scaled))
    print("saved {} ({}x{})".format(args.output, width * args.scale, height * args.scale))


def parser():
    root = argparse.ArgumentParser(description=__doc__)
    root.add_argument("--api-root", default=API_ROOT, help=argparse.SUPPRESS)
    commands = root.add_subparsers(dest="command", required=True)

    gen = commands.add_parser("generate", help="generate one transparent pixel-art image")
    gen.add_argument("description")
    gen.add_argument("--width", type=int, default=16)
    gen.add_argument("--height", type=int, default=16)
    gen.add_argument("--seed", type=int)
    gen.add_argument("--background", action="store_true")
    gen.add_argument("--output", type=Path, required=True)
    gen.add_argument("--poll-interval", type=float, default=6)
    gen.add_argument("--timeout", type=float, default=300)
    gen.set_defaults(func=generate)

    request = commands.add_parser("request", help="POST an advanced PixelLab JSON payload")
    request.add_argument("endpoint", help="for example generate-with-style-v2")
    request.add_argument("payload", type=Path)
    request.add_argument("--output", type=Path)
    request.add_argument("--wait", action="store_true")
    request.add_argument("--poll-interval", type=float, default=6)
    request.add_argument("--timeout", type=float, default=300)
    request.set_defaults(func=raw_request)

    check = commands.add_parser("validate", help="validate an Abyss production PNG")
    check.add_argument("input", type=Path)
    check.add_argument("--width", type=int)
    check.add_argument("--height", type=int)
    check.add_argument("--max-colors", type=int, default=24)
    check.add_argument("--require-margin", action="store_true")
    check.set_defaults(func=validate_command)

    show = commands.add_parser("preview", help="create a nearest-neighbor PNG preview")
    show.add_argument("input", type=Path)
    show.add_argument("output", type=Path)
    show.add_argument("--scale", type=int, default=4)
    show.set_defaults(func=preview)
    return root


def main():
    args = parser().parse_args()
    try:
        result = args.func(args)
        return result if isinstance(result, int) else 0
    except (OSError, ValueError, RuntimeError, json.JSONDecodeError) as exc:
        print("ERROR: " + str(exc), file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
