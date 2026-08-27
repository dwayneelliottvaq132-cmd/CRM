import pathlib

# backend/app/services/storage_service.py -> backend/data/uploads
UPLOAD_ROOT = pathlib.Path(__file__).resolve().parents[2] / "data" / "uploads"


def save_file(subdir: str, stem: str, ext: str, data: bytes) -> str:
    """Writes `data` to backend/data/uploads/{subdir}/{stem}{ext} and returns the path
    relative to backend/data/, e.g. "uploads/attachments/7.jpg" — the form stored on
    the model and used to reconstruct the path for load_file(). `stem` should uniquely
    identify the file within `subdir` (an entity id when there's one file per entity,
    e.g. save_pdf below; an attachment id when an entity can have several)."""
    directory = UPLOAD_ROOT / subdir
    directory.mkdir(parents=True, exist_ok=True)
    file_path = directory / f"{stem}{ext}"
    file_path.write_bytes(data)
    return f"uploads/{subdir}/{stem}{ext}"


def load_file(relative_path: str) -> bytes | None:
    """Reads a file previously saved by save_file()/save_pdf(), given the relative path
    stored on the model. Returns None if the path is empty or the file is missing."""
    if not relative_path:
        return None
    file_path = UPLOAD_ROOT.parent / relative_path
    if not file_path.is_file():
        return None
    return file_path.read_bytes()


def save_pdf(subdir: str, entity_id: int, data: bytes) -> str:
    """One-PDF-per-entity convenience wrapper over save_file (drawings, purchase orders)."""
    return save_file(subdir, str(entity_id), ".pdf", data)


def load_pdf(relative_path: str) -> bytes | None:
    return load_file(relative_path)


def delete_file(relative_path: str) -> None:
    if not relative_path:
        return
    file_path = UPLOAD_ROOT.parent / relative_path
    file_path.unlink(missing_ok=True)
