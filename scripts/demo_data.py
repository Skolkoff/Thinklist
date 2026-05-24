from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

try:
    from scripts.smoke_api import normalize_base_url
except ModuleNotFoundError:
    from smoke_api import normalize_base_url


@dataclass(frozen=True)
class DemoDataCounts:
    papers: int
    tags: int
    target_total: int = 5000
    target_reached: bool = False
    scheduler_enabled: bool = False


DEFAULT_MIN_PAPERS = 5000
DEFAULT_MIN_TAGS = 80


def should_run_ingestion(
    papers: int,
    tags: int,
    min_papers: int,
    min_tags: int,
) -> bool:
    return papers < min_papers or tags < min_tags


def request_json(
    method: str,
    url: str,
    body: dict[str, Any] | None = None,
    timeout: float = 30.0,
) -> dict[str, Any]:
    data = None
    headers = {"Accept": "application/json"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    request = Request(url, data=data, headers=headers, method=method)
    try:
        with urlopen(request, timeout=timeout) as response:
            payload = response.read().decode("utf-8", errors="replace")
            if response.status >= 400:
                raise RuntimeError(f"{method} {url} failed with {response.status}: {payload}")
            return json.loads(payload) if payload else {}
    except HTTPError as error:
        payload = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{method} {url} failed with {error.code}: {payload}") from error
    except URLError as error:
        raise RuntimeError(f"{method} {url} failed: {error.reason}") from error


def fetch_counts(backend_url: str, min_papers: int, timeout: float) -> DemoDataCounts:
    backend = normalize_base_url(backend_url)
    tags_payload = request_json("GET", f"{backend}/tags", timeout=timeout)
    status_payload = request_json("GET", f"{backend}/admin/ingestion/status", timeout=timeout)
    papers = int(status_payload.get("current_total") or 0)
    if papers <= 0:
        feed_payload = request_json("GET", f"{backend}/feed?limit={min_papers}", timeout=timeout)
        papers = len(feed_payload.get("items") or [])
    return DemoDataCounts(
        papers=papers,
        tags=len(tags_payload.get("items") or []),
        target_total=int(status_payload.get("target_total") or min_papers),
        target_reached=bool(status_payload.get("target_reached")),
        scheduler_enabled=bool(status_payload.get("scheduler_enabled")),
    )


def prepare_demo_data(
    backend_url: str,
    ml_url: str,
    min_papers: int,
    min_tags: int,
    timeout: float,
) -> int:
    backend = normalize_base_url(backend_url)
    ml = normalize_base_url(ml_url)

    before = fetch_counts(backend, min_papers=min_papers, timeout=timeout)
    print(f"Before: papers_at_least={before.papers}/{min_papers}, tags={before.tags}/{min_tags}")

    if should_run_ingestion(before.papers, before.tags, min_papers, min_tags):
        print("Running one incremental arXiv ingestion batch...")
        ingestion = request_json("POST", f"{backend}/admin/ingestion/run", timeout=timeout)
        print(f"Ingestion: {json.dumps(ingestion, ensure_ascii=False)}")
    else:
        print("Ingestion skipped: current data meets demo minimums.")

    print("Rebuilding ML index...")
    rebuild = request_json("POST", f"{ml}/ml/rebuild", timeout=timeout)
    print(f"ML rebuild: {json.dumps(rebuild, ensure_ascii=False)}")

    after = fetch_counts(backend, min_papers=min_papers, timeout=timeout)
    print(f"After: papers_at_least={after.papers}/{min_papers}, tags={after.tags}/{min_tags}")

    if should_run_ingestion(after.papers, after.tags, min_papers, min_tags):
        print(
            "Demo data is still below the final target; background ingestion will continue accumulating batches.",
            file=sys.stderr,
        )
        if not after.scheduler_enabled:
            print("Background ingestion scheduler is disabled.", file=sys.stderr)
            return 1
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Prepare Thinklist demo data and ML index.")
    parser.add_argument("--backend-url", default="http://localhost:8000")
    parser.add_argument("--ml-url", default="http://localhost:8001")
    parser.add_argument("--min-papers", type=int, default=DEFAULT_MIN_PAPERS)
    parser.add_argument("--min-tags", type=int, default=DEFAULT_MIN_TAGS)
    parser.add_argument("--timeout", type=float, default=60.0)
    args = parser.parse_args(argv)

    return prepare_demo_data(
        backend_url=args.backend_url,
        ml_url=args.ml_url,
        min_papers=args.min_papers,
        min_tags=args.min_tags,
        timeout=args.timeout,
    )


if __name__ == "__main__":
    raise SystemExit(main())
