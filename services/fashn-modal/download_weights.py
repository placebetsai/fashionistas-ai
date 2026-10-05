#!/usr/bin/env python3
"""Bake FASHN VTON v1.5 model weights into the Modal image at build time.

This is a self-contained re-implementation of upstream
``fashn-AI/fashn-vton-1.5/scripts/download_weights.py`` so that the Modal
image build does not depend on an upstream checkout being present on the
machine that runs ``modal deploy``.

It downloads three things:

1. ``model.safetensors``           ~1.94 GB - the TryOnModel (MMDiT) weights
2. ``dwpose/*.onnx``               ~0.35 GB - YOLOX person detector + DWPose
3. fashn-human-parser weights      ~0.24 GB - SegFormer-B4, cached under $HF_HOME

Everything lands inside the image, so containers never download weights at
request time.

Usage:
    python download_weights.py --weights-dir /fashn/weights
"""

from __future__ import annotations

import argparse
import os
import sys

from huggingface_hub import hf_hub_download

TRYON_REPO = "fashn-ai/fashn-vton-1.5"
TRYON_FILE = "model.safetensors"

DWPOSE_REPO = "fashn-ai/DWPose"
DWPOSE_FILES = ("yolox_l.onnx", "dw-ll_ucoco_384.onnx")

# Lower bounds, not exact sizes: they exist only to turn a truncated download
# into a loud build failure instead of a mysterious runtime error. They are
# deliberately loose so an upstream re-upload of larger weights still passes.
MIN_BYTES = {
    TRYON_FILE: 1_500_000_000,
    "yolox_l.onnx": 150_000_000,
    "dw-ll_ucoco_384.onnx": 100_000_000,
}


class DownloadError(RuntimeError):
    """Raised when a weight file is missing or implausibly small."""


def _check(path: str, label: str) -> str:
    floor = MIN_BYTES.get(label, 1)
    size = os.path.getsize(path)
    if size < floor:
        raise DownloadError(
            f"{path} is {size} bytes, expected at least {floor}. "
            "Refusing to bake a truncated weight file into the image."
        )
    print(f"  ok  {label}  {size:,} bytes", flush=True)
    return path


def download_tryon_model(weights_dir: str) -> str:
    print(f"Downloading {TRYON_REPO}/{TRYON_FILE} ...", flush=True)
    path = hf_hub_download(repo_id=TRYON_REPO, filename=TRYON_FILE, local_dir=weights_dir)
    return _check(path, TRYON_FILE)


def download_dwpose_models(weights_dir: str) -> str:
    dwpose_dir = os.path.join(weights_dir, "dwpose")
    os.makedirs(dwpose_dir, exist_ok=True)
    for filename in DWPOSE_FILES:
        print(f"Downloading {DWPOSE_REPO}/{filename} ...", flush=True)
        path = hf_hub_download(repo_id=DWPOSE_REPO, filename=filename, local_dir=dwpose_dir)
        _check(path, filename)
    return dwpose_dir


def download_human_parser() -> None:
    """Construct the parser once so its weights land in $HF_HOME during build."""
    print("Warming fashn-human-parser (weights go to HF_HOME) ...", flush=True)
    from fashn_human_parser import FashnHumanParser

    parser = FashnHumanParser(device="cpu")
    del parser

    hf_home = os.environ.get("HF_HOME")
    if not hf_home:
        print("  warning: HF_HOME is unset; parser weights went to the default cache", flush=True)
        return

    cache_root = os.path.join(hf_home, "hub")
    parser_cache = os.path.join(cache_root, "models--fashn-ai--fashn-human-parser")
    if not os.path.isdir(parser_cache):
        raise DownloadError(
            f"expected {parser_cache} to exist after constructing FashnHumanParser"
        )
    total = 0
    for root, _dirs, files in os.walk(parser_cache):
        for name in files:
            total += os.path.getsize(os.path.join(root, name))
    if total < 200_000_000:
        raise DownloadError(
            f"human parser cache at {parser_cache} is only {total:,} bytes; "
            "expected at least 200,000,000"
        )
    print(f"  ok  fashn-human-parser cache  {total:,} bytes", flush=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="Download FASHN VTON v1.5 weights")
    parser.add_argument("--weights-dir", required=True, help="Destination for model weights")
    args = parser.parse_args()

    weights_dir = os.path.abspath(args.weights_dir)
    os.makedirs(weights_dir, exist_ok=True)
    print(f"weights dir: {weights_dir}", flush=True)
    print(f"HF_HOME:     {os.environ.get('HF_HOME', '<default>')}", flush=True)

    download_tryon_model(weights_dir)
    download_dwpose_models(weights_dir)
    download_human_parser()

    print("All FASHN VTON v1.5 weights are present.", flush=True)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except DownloadError as exc:
        print(f"ERROR: {exc}", file=sys.stderr, flush=True)
        sys.exit(1)
