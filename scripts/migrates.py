"""Run SQL migration files in numeric filename order."""

from pathlib import Path


MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "migrations"


def migrate(database_url: str | None = None) -> None:
    """Apply all migration SQL files that are newer than the last migration."""
    if database_url is None:
        raise RuntimeError("DATABASE_URL is required")

    if not MIGRATIONS_DIR.is_dir():
        raise RuntimeError(f"Migrations directory not found: {MIGRATIONS_DIR}")

    migrations = sorted(MIGRATIONS_DIR.glob("*.sql"), key=lambda path: path.name)
    if not migrations:
        raise RuntimeError(f"No SQL migrations found in {MIGRATIONS_DIR}")

    raise NotImplementedError(
        "Migration execution has not been configured for this repository; "
        f"found migrations: {', '.join(path.name for path in migrations)}"
    )


if __name__ == "__main__":
    import os

    migrate(os.getenv("DATABASE_URL"))
