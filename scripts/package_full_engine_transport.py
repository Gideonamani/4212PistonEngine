"""Create or verify the deterministic gzip transport for the published V5 GLB."""
import argparse
import gzip
import hashlib
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "web" / "engine.glb"
TARGET = ROOT / "web" / "engine.glb.gz"


def packed(source: Path) -> bytes:
    return gzip.compress(source.read_bytes(), compresslevel=9, mtime=0)


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="verify the committed transport without changing it")
    args = parser.parse_args()
    assert SOURCE.is_file(), f"Missing source asset: {SOURCE}"
    transport = packed(SOURCE)
    if args.check:
        assert TARGET.is_file(), f"Missing transport asset: {TARGET}"
        assert TARGET.read_bytes() == transport, "Transport is stale; rerun package_full_engine_transport.py"
    else:
        TARGET.write_bytes(transport)
    print({"source_bytes": SOURCE.stat().st_size, "transport_bytes": len(transport), "transport_sha256": digest(transport)})


if __name__ == "__main__":
    main()
