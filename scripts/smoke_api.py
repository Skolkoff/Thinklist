from __future__ import annotations

import argparse
import json
import sys
import time
from dataclasses import dataclass
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def normalize_base_url(value: str) -> str:
    return value.rstrip("/")


def unique_demo_email(prefix: str = "smoke") -> str:
    return f"{prefix}_{int(time.time() * 1000)}@example.com"


@dataclass(frozen=True)
class CheckResult:
    name: str
    ok: bool
    status: int | None
    summary: str


@dataclass(frozen=True)
class Check:
    name: str
    method: str
    url: str
    expected_status: int
    body: dict[str, Any] | None = None
    token: str | None = None

    def evaluate(self, status: int, body: str) -> CheckResult:
        if status == self.expected_status:
            return CheckResult(
                name=self.name,
                ok=True,
                status=status,
                summary=f"{self.method} {self.url} -> {status}",
            )
        excerpt = body.replace("\n", " ")[:220]
        return CheckResult(
            name=self.name,
            ok=False,
            status=status,
            summary=(
                f"{self.method} {self.url} -> {status}, "
                f"expected {self.expected_status}; body={excerpt}"
            ),
        )


def run_check(check: Check, timeout: float) -> CheckResult:
    payload = None
    headers = {"Accept": "application/json"}
    if check.body is not None:
        payload = json.dumps(check.body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if check.token:
        headers["Authorization"] = f"Bearer {check.token}"

    request = Request(check.url, data=payload, headers=headers, method=check.method)
    try:
        with urlopen(request, timeout=timeout) as response:
            body = response.read().decode("utf-8", errors="replace")
            return check.evaluate(response.status, body)
    except HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        return check.evaluate(error.code, body)
    except URLError as error:
        return CheckResult(
            name=check.name,
            ok=False,
            status=None,
            summary=f"{check.method} {check.url} -> connection_error: {error.reason}",
        )
    except TimeoutError:
        return CheckResult(
            name=check.name,
            ok=False,
            status=None,
            summary=f"{check.method} {check.url} -> timeout",
        )


def request_json(
    method: str,
    url: str,
    body: dict[str, Any] | None = None,
    token: str | None = None,
    timeout: float = 5.0,
) -> tuple[int, dict[str, Any] | None, str]:
    payload = None
    headers = {"Accept": "application/json"}
    if body is not None:
        payload = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"

    request = Request(url, data=payload, headers=headers, method=method)
    try:
        with urlopen(request, timeout=timeout) as response:
            text = response.read().decode("utf-8", errors="replace")
            return response.status, json.loads(text) if text else None, text
    except HTTPError as error:
        text = error.read().decode("utf-8", errors="replace")
        parsed = None
        try:
            parsed = json.loads(text) if text else None
        except json.JSONDecodeError:
            pass
        return error.code, parsed, text


def run_collection_crud_flow(backend_url: str, timeout: float) -> CheckResult:
    backend = normalize_base_url(backend_url)
    email = unique_demo_email("collections")
    password = "Password123!"
    board_name = f"Smoke Board {int(time.time())}"
    updated_name = f"{board_name} Updated"

    status, _, body = request_json(
        "POST",
        f"{backend}/auth/register",
        body={"email": email, "password": password, "nickname": email.split("@")[0]},
        timeout=timeout,
    )
    if status != 201:
        return CheckResult(
            "collection CRUD",
            False,
            status,
            f"register failed with {status}; body={body[:220]}",
        )

    status, login_payload, body = request_json(
        "POST",
        f"{backend}/auth/login",
        body={"email": email, "password": password},
        timeout=timeout,
    )
    token = (login_payload or {}).get("access_token")
    if status != 200 or not token:
        return CheckResult(
            "collection CRUD",
            False,
            status,
            f"login failed with {status}; body={body[:220]}",
        )

    status, created, body = request_json(
        "POST",
        f"{backend}/collections",
        body={"name": board_name, "visibility": "private"},
        token=token,
        timeout=timeout,
    )
    collection_id = str((created or {}).get("id") or "")
    if status != 201 or not collection_id:
        return CheckResult(
            "collection CRUD",
            False,
            status,
            f"create collection failed with {status}; body={body[:220]}",
        )

    steps: list[str] = [f"created={collection_id}"]
    try:
        status, _, body = request_json(
            "POST",
            f"{backend}/collections/{collection_id}/items",
            body={"paper_id": 1},
            token=token,
            timeout=timeout,
        )
        if status != 201:
            return CheckResult(
                "collection CRUD",
                False,
                status,
                f"add article failed with {status}; body={body[:220]}",
            )
        steps.append("added paper 1")

        status, updated, body = request_json(
            "PUT",
            f"{backend}/collections/{collection_id}",
            body={"name": updated_name, "visibility": "followers"},
            token=token,
            timeout=timeout,
        )
        if status != 200 or (updated or {}).get("visibility") != "followers":
            return CheckResult(
                "collection CRUD",
                False,
                status,
                f"update collection failed with {status}; body={body[:220]}",
            )
        steps.append("updated")

        status, listed, body = request_json(
            "GET",
            f"{backend}/collections?include_items=1",
            token=token,
            timeout=timeout,
        )
        items = (listed or {}).get("items") or []
        found = next((item for item in items if str(item.get("id")) == collection_id), None)
        if status != 200 or not found or "1" not in (found.get("articleIds") or []):
            return CheckResult(
                "collection CRUD",
                False,
                status,
                f"list collection failed with {status}; body={body[:220]}",
            )
        steps.append("listed with paper")
    finally:
        delete_status, _, _ = request_json(
            "DELETE",
            f"{backend}/collections/{collection_id}",
            token=token,
            timeout=timeout,
        )
        steps.append(f"delete={delete_status}")

    return CheckResult(
        "collection CRUD",
        True,
        200,
        " -> ".join(steps),
    )


def run_profile_update_flow(backend_url: str, timeout: float) -> CheckResult:
    backend = normalize_base_url(backend_url)
    email = unique_demo_email("profile")
    password = "Password123!"
    nickname = email.split("@")[0]
    updated_nickname = f"{nickname}_updated"
    payload = {
        "name": "Smoke Profile",
        "nickname": updated_nickname,
        "workplace": "Thinklist QA Lab",
        "field_of_study": "Computer Science",
        "bio": "Temporary smoke profile.",
        "interests": ["machine learning", "computer vision"],
    }

    status, _, body = request_json(
        "POST",
        f"{backend}/auth/register",
        body={"email": email, "password": password, "nickname": nickname},
        timeout=timeout,
    )
    if status != 201:
        return CheckResult(
            "profile update",
            False,
            status,
            f"register failed with {status}; body={body[:220]}",
        )

    status, login_payload, body = request_json(
        "POST",
        f"{backend}/auth/login",
        body={"email": email, "password": password},
        timeout=timeout,
    )
    token = (login_payload or {}).get("access_token")
    if status != 200 or not token:
        return CheckResult(
            "profile update",
            False,
            status,
            f"login failed with {status}; body={body[:220]}",
        )

    status, updated, body = request_json(
        "PUT",
        f"{backend}/me",
        body=payload,
        token=token,
        timeout=timeout,
    )
    if status != 200:
        return CheckResult(
            "profile update",
            False,
            status,
            f"update failed with {status}; body={body[:220]}",
        )

    for key in ["name", "nickname", "workplace", "bio"]:
        if (updated or {}).get(key) != payload[key]:
            return CheckResult(
                "profile update",
                False,
                status,
                f"update mismatch for {key}; body={body[:220]}",
            )
    if (updated or {}).get("fieldOfStudy") != payload["field_of_study"]:
        return CheckResult(
            "profile update",
            False,
            status,
            f"fieldOfStudy mismatch; body={body[:220]}",
        )

    status, profile, body = request_json(
        "GET",
        f"{backend}/me",
        token=token,
        timeout=timeout,
    )
    if status != 200:
        return CheckResult(
            "profile update",
            False,
            status,
            f"readback failed with {status}; body={body[:220]}",
        )

    expected_interests = sorted(payload["interests"])
    actual_interests = sorted((profile or {}).get("interests") or [])
    if (profile or {}).get("name") != payload["name"] or actual_interests != expected_interests:
        return CheckResult(
            "profile update",
            False,
            status,
            f"readback mismatch; body={body[:220]}",
        )

    return CheckResult(
        "profile update",
        True,
        200,
        f"updated {email} -> nickname={updated_nickname} -> interests={len(actual_interests)}",
    )


def run_comments_flow(backend_url: str, timeout: float) -> CheckResult:
    backend = normalize_base_url(backend_url)
    email = unique_demo_email("comments")
    password = "Password123!"
    nickname = email.split("@")[0]

    status, _, body = request_json(
        "POST",
        f"{backend}/auth/register",
        body={"email": email, "password": password, "nickname": nickname},
        timeout=timeout,
    )
    if status != 201:
        return CheckResult(
            "comments",
            False,
            status,
            f"register failed with {status}; body={body[:220]}",
        )

    status, login_payload, body = request_json(
        "POST",
        f"{backend}/auth/login",
        body={"email": email, "password": password},
        timeout=timeout,
    )
    token = (login_payload or {}).get("access_token")
    if status != 200 or not token:
        return CheckResult(
            "comments",
            False,
            status,
            f"login failed with {status}; body={body[:220]}",
        )

    status, created, body = request_json(
        "POST",
        f"{backend}/papers/1/comments",
        body={"content": "Smoke comment for article discussion."},
        token=token,
        timeout=timeout,
    )
    comment_id = str((created or {}).get("id") or "")
    if status != 201 or not comment_id:
        return CheckResult(
            "comments",
            False,
            status,
            f"create comment failed with {status}; body={body[:220]}",
        )

    steps = [f"created={comment_id}"]
    try:
        status, listed, body = request_json(
            "GET",
            f"{backend}/papers/1/comments?limit=10",
            timeout=timeout,
        )
        items = (listed or {}).get("items") or []
        if status != 200 or not any(str(item.get("id")) == comment_id for item in items):
            return CheckResult(
                "comments",
                False,
                status,
                f"guest list failed with {status}; body={body[:220]}",
            )
        steps.append("guest listed")

        status, reacted, body = request_json(
            "POST",
            f"{backend}/comments/{comment_id}/reactions",
            body={"emoji": "heart"},
            token=token,
            timeout=timeout,
        )
        if status != 201 or (reacted or {}).get("reactionCounts", {}).get("heart") != 1:
            return CheckResult(
                "comments",
                False,
                status,
                f"react failed with {status}; body={body[:220]}",
            )
        steps.append("reacted")

        status, unreacted, body = request_json(
            "DELETE",
            f"{backend}/comments/{comment_id}/reactions/heart",
            token=token,
            timeout=timeout,
        )
        if status != 200 or (unreacted or {}).get("reactionCounts", {}).get("heart", 0) != 0:
            return CheckResult(
                "comments",
                False,
                status,
                f"unreact failed with {status}; body={body[:220]}",
            )
        steps.append("unreacted")
    finally:
        delete_status, _, _ = request_json(
            "DELETE",
            f"{backend}/comments/{comment_id}",
            token=token,
            timeout=timeout,
        )
        steps.append(f"delete={delete_status}")

    return CheckResult("comments", True, 200, " -> ".join(steps))


def build_checks(
    backend_url: str,
    ml_url: str,
    token: str | None,
    include_rebuild: bool,
) -> list[Check]:
    backend = normalize_base_url(backend_url)
    ml = normalize_base_url(ml_url)
    checks = [
        Check("backend health", "GET", f"{backend}/health", 200),
        Check("tags", "GET", f"{backend}/tags", 200),
        Check("feed", "GET", f"{backend}/feed?limit=5", 200),
        Check("search", "GET", f"{backend}/search?q=learning&limit=5", 200),
        Check("paper detail", "GET", f"{backend}/papers/1", 200),
        Check("ml health", "GET", f"{ml}/health", 200),
        Check(
            "ml rank",
            "POST",
            f"{ml}/ml/rank",
            200,
            body={
                "user_id": 1,
                "positive_paper_ids": [1],
                "candidate_paper_ids": [1, 2, 3, 4, 5],
            },
        ),
    ]
    if include_rebuild:
        checks.append(Check("ml rebuild", "POST", f"{ml}/ml/rebuild", 200))
    if token:
        checks.extend(
            [
                Check("me", "GET", f"{backend}/me", 200, token=token),
                Check(
                    "collections",
                    "GET",
                    f"{backend}/collections?include_items=1",
                    200,
                    token=token,
                ),
                Check("saved papers", "GET", f"{backend}/me/saved", 200, token=token),
            ]
        )
    return checks


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run Thinklist API smoke checks.")
    parser.add_argument("--backend-url", default="http://localhost:8000")
    parser.add_argument("--ml-url", default="http://localhost:8001")
    parser.add_argument("--token", default=None, help="Optional bearer token for auth checks.")
    parser.add_argument(
        "--include-rebuild",
        action="store_true",
        help="Also call POST /ml/rebuild. This mutates the in-memory ML index.",
    )
    parser.add_argument(
        "--include-collection-crud",
        action="store_true",
        help="Create a temporary user and collection, add paper 1, update it, list it, then delete it.",
    )
    parser.add_argument(
        "--include-profile-update",
        action="store_true",
        help="Create a temporary user, update profile fields and interests, then read them back.",
    )
    parser.add_argument(
        "--include-comments",
        action="store_true",
        help="Create a temporary user, add/list/react/unreact/delete an article comment.",
    )
    parser.add_argument("--timeout", type=float, default=5.0)
    args = parser.parse_args(argv)

    checks = build_checks(
        backend_url=args.backend_url,
        ml_url=args.ml_url,
        token=args.token,
        include_rebuild=args.include_rebuild,
    )
    results = [run_check(check, timeout=args.timeout) for check in checks]
    if args.include_collection_crud:
        results.append(run_collection_crud_flow(args.backend_url, timeout=args.timeout))
    if args.include_profile_update:
        results.append(run_profile_update_flow(args.backend_url, timeout=args.timeout))
    if args.include_comments:
        results.append(run_comments_flow(args.backend_url, timeout=args.timeout))

    for result in results:
        prefix = "PASS" if result.ok else "FAIL"
        print(f"[{prefix}] {result.name}: {result.summary}")

    failed = [result for result in results if not result.ok]
    if failed:
        print(f"\n{len(failed)} smoke check(s) failed.", file=sys.stderr)
        return 1

    print(f"\nAll {len(results)} smoke checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
