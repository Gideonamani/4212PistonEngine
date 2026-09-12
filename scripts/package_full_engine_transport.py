"""Create or verify the deterministic gzip transport for the published V5 GLB."""
import argparse
import gzip
import hashlib
from io import BytesIO
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "web" / "engine.glb"
TARGET = ROOT / "web" / "engine.glb.gz"


def packed(source: Path) -> bytes:
    output = BytesIO()
    # GzipFile fixes the otherwise platform-dependent OS byte in the gzip header.
    with gzip.GzipFile(filename='', mode='wb', fileobj=output, compresslevel=9, mtime=0) as writer:
        writer.write(source.read_bytes())
    return output.getvalue()


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
        # Compression streams may differ across supported zlib versions. The contract
        # checks the committed transport hash; this check proves its byte-for-byte
        # decoded model binding without rebuilding it on the runner.
        assert gzip.decompress(TARGET.read_bytes()) == SOURCE.read_bytes(), "Transport does not decode to the published engine asset"
    else:
        TARGET.write_bytes(transport)
    print({"source_bytes": SOURCE.stat().st_size, "transport_bytes": len(transport), "transport_sha256": digest(transport)})


if __name__ == "__main__":
    main()
