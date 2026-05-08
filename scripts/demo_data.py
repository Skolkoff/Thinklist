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
    feed_payload = request_json("GET", f"{backend}/feed?limit={min_papers}", timeout=timeout)
    return DemoDataCounts(
        papers=len(feed_payload.get("items") or []),
        tags=len(tags_payload.get("items") or []),
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
        print("Running arXiv ingestion...")
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
        print("Demo data is still below required minimums.", file=sys.stderr)
        return 1
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Prepare Thinklist demo data and ML index.")
    parser.add_argument("--backend-url", default="http://localhost:8000")
    parser.add_argument("--ml-url", default="http://localhost:8001")
    parser.add_argument("--min-papers", type=int, default=50)
    parser.add_argument("--min-tags", type=int, default=10)
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
