from __future__ import annotations


DOMAIN_PREFIXES: tuple[tuple[str, str], ...] = (
    ("cs.", "computer_science"),
    ("stat.", "statistics"),
    ("math.", "mathematics"),
    ("q-bio.", "biology"),
    ("physics.", "physics"),
    ("cond-mat.", "physics"),
    ("astro-ph.", "physics"),
    ("econ.", "economics"),
    ("q-fin.", "finance"),
)

ADJACENT_SIMILARITY_MIN = 0.35
ADJACENT_SIMILARITY_MAX = 0.92


def domain_for_tag(tag: str) -> str:
    normalized = tag.strip()
    for prefix, domain in DOMAIN_PREFIXES:
        if normalized.startswith(prefix):
            return domain
    return "other"


def domains_for_tags(tags: list[str]) -> set[str]:
    return {domain_for_tag(tag) for tag in tags if tag.strip()}


def is_adjacent_domain(
    user_domains: set[str],
    candidate_domains: set[str],
    semantic_similarity: float,
) -> bool:
    if not user_domains or not candidate_domains:
        return False
    if user_domains.intersection(candidate_domains):
        return False
    return ADJACENT_SIMILARITY_MIN <= semantic_similarity <= ADJACENT_SIMILARITY_MAX
