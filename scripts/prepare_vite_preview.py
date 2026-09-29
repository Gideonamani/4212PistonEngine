"""Shared helper for isolated previews of the React/Vite teaching application."""
from pathlib import Path
import shutil


def prepare_vite_preview(repo: Path, preview: Path) -> None:
    preview.mkdir(parents=True, exist_ok=True)
    for name in ('index.html', 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts'):
        shutil.copy2(repo / name, preview / name)
    shutil.copytree(repo / 'src', preview / 'src', dirs_exist_ok=True)
    shutil.copytree(
        repo / 'web',
        preview / 'web',
        dirs_exist_ok=True,
        ignore=shutil.ignore_patterns('*.glb', '*.glb.gz'),
    )


def print_preview_command(preview: Path) -> None:
    print('Prepared React/Vite preview:', preview)
    print(f'Run: npm run dev -- --host 127.0.0.1  (working directory: {preview})')
