import base64
import os
import re
from datetime import datetime, timezone
from typing import Any

import requests
from dotenv import load_dotenv


load_dotenv()

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")

GITHUB_API_VERSION = "2022-11-28"

REQUEST_TIMEOUT = 20


# ============================================================
# HTTP HELPERS
# ============================================================


def _github_headers() -> dict:
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
    }

    if GITHUB_TOKEN:
        headers["Authorization"] = (
            f"Bearer {GITHUB_TOKEN}"
        )

    return headers


def _github_get(
    url: str,
    params: dict | None = None,
) -> Any:
    response = requests.get(
        url,
        headers=_github_headers(),
        params=params,
        timeout=REQUEST_TIMEOUT,
    )

    response.raise_for_status()

    return response.json()


# ============================================================
# DATE HELPERS
# ============================================================


def parse_github_timestamp(
    value: str | None,
) -> datetime | None:
    if not value:
        return None

    try:
        return datetime.fromisoformat(
            value.replace("Z", "+00:00")
        )
    except ValueError:
        return None


def timestamp_after(
    timestamp: str | None,
    since: str,
) -> bool:
    timestamp_dt = parse_github_timestamp(
        timestamp
    )

    since_dt = parse_github_timestamp(since)

    if not timestamp_dt or not since_dt:
        return False

    return timestamp_dt > since_dt


# ============================================================
# REPOSITORY
# ============================================================


def get_repository_info(
    owner: str,
    repo: str,
) -> dict:
    url = (
        f"https://api.github.com/repos/"
        f"{owner}/{repo}"
    )

    data = _github_get(url)

    return {
        "id": "github_repository",
        "source": "github",
        "type": "repository",
        "timestamp": data.get(
            "updated_at"
        ),
        "actor": None,
        "content": {
            "name": data["name"],
            "description": data.get(
                "description"
            ),
            "language": data.get(
                "language"
            ),
            "topics": data.get(
                "topics",
                [],
            ),
            "default_branch": data.get(
                "default_branch"
            ),
        },
        "url": data.get("html_url"),
        "metadata": {
            "owner": owner,
            "repo": repo,
        },
    }


# ============================================================
# README
# ============================================================


def get_readme(
    owner: str,
    repo: str,
) -> dict | None:
    url = (
        f"https://api.github.com/repos/"
        f"{owner}/{repo}/readme"
    )

    response = requests.get(
        url,
        headers=_github_headers(),
        timeout=REQUEST_TIMEOUT,
    )

    if response.status_code == 404:
        return None

    response.raise_for_status()

    data = response.json()

    content = base64.b64decode(
        data["content"]
    ).decode(
        "utf-8",
        errors="ignore",
    )

    return {
        "id": "github_readme",
        "source": "github",
        "type": "readme",
        "timestamp": None,
        "actor": None,
        "content": content,
        "url": data.get("html_url"),
        "metadata": {
            "path": data.get("path"),
        },
    }


# ============================================================
# COMMITS
# ============================================================


def get_recent_commits(
    owner: str,
    repo: str,
    limit: int = 15,
) -> list:
    url = (
        f"https://api.github.com/repos/"
        f"{owner}/{repo}/commits"
    )

    return _github_get(
        url,
        params={
            "per_page": limit,
        },
    )


def get_commits_since(
    owner: str,
    repo: str,
    since_iso: str,
    limit: int = 30,
) -> list:
    url = (
        f"https://api.github.com/repos/"
        f"{owner}/{repo}/commits"
    )

    return _github_get(
        url,
        params={
            "since": since_iso,
            "per_page": limit,
        },
    )


def normalize_commits(
    commits: list,
) -> list:
    evidence = []

    for commit in commits:
        sha = commit["sha"]

        commit_data = commit[
            "commit"
        ]

        message = commit_data[
            "message"
        ]

        github_author = (
            commit.get("author") or {}
        )

        author = (
            github_author.get("login")
            or commit_data.get(
                "author",
                {},
            ).get(
                "name",
                "Unknown author",
            )
        )

        timestamp = (
            commit_data.get(
                "author",
                {},
            ).get("date")
        )

        evidence.append(
            {
                "id": (
                    f"github_commit_"
                    f"{sha[:7]}"
                ),
                "source": "github",
                "type": "commit",
                "timestamp": timestamp,
                "actor": author,
                "content": (
                    f"{author} committed: "
                    f"{message}"
                ),
                "url": commit.get(
                    "html_url"
                ),
                "metadata": {
                    "sha": sha,
                    "message": message,
                },
            }
        )

    return evidence


def get_commit_details(
    owner: str,
    repo: str,
    sha: str,
) -> dict:
    url = (
        f"https://api.github.com/repos/"
        f"{owner}/{repo}/commits/{sha}"
    )

    return _github_get(url)


def normalize_commit_details(
    commit: dict,
) -> list:
    evidence = []

    sha = commit["sha"]

    timestamp = (
        commit.get(
            "commit",
            {},
        )
        .get(
            "author",
            {},
        )
        .get("date")
    )

    for index, file in enumerate(
        commit.get(
            "files",
            [],
        )
    ):
        filename = file.get(
            "filename"
        )

        content = (
            f"Commit {sha[:7]} changed "
            f"'{filename}'. "
            f"Status: "
            f"{file.get('status')}. "
            f"Additions: "
            f"{file.get('additions', 0)}, "
            f"deletions: "
            f"{file.get('deletions', 0)}."
        )

        patch = file.get("patch")

        if patch:
            content += (
                "\nPatch excerpt:\n"
                + patch[:1500]
            )

        evidence.append(
            {
                "id": (
                    f"github_commit_"
                    f"{sha[:7]}_file_"
                    f"{index}"
                ),
                "source": "github",
                "type": "code_change",
                "timestamp": timestamp,
                "actor": None,
                "content": content,
                "url": commit.get(
                    "html_url"
                ),
                "metadata": {
                    "sha": sha,
                    "filename": filename,
                    "status": file.get(
                        "status"
                    ),
                    "additions": file.get(
                        "additions",
                        0,
                    ),
                    "deletions": file.get(
                        "deletions",
                        0,
                    ),
                },
            }
        )

    return evidence


# ============================================================
# PULL REQUESTS
# ============================================================


def get_pull_requests(
    owner: str,
    repo: str,
    state: str = "all",
    limit: int = 20,
) -> list:
    url = (
        f"https://api.github.com/repos/"
        f"{owner}/{repo}/pulls"
    )

    return _github_get(
        url,
        params={
            "state": state,
            "sort": "updated",
            "direction": "desc",
            "per_page": limit,
        },
    )


def normalize_pull_requests(
    pull_requests: list,
) -> list:
    evidence = []

    for pr in pull_requests:
        merged = (
            pr.get("merged_at")
            is not None
        )

        if merged:
            status = "merged"
        else:
            status = pr.get(
                "state",
                "unknown",
            )

        content = (
            f"Pull request "
            f"#{pr['number']} "
            f"'{pr['title']}' "
            f"is {status}."
        )

        if pr.get("body"):
            content += (
                "\nDescription: "
                + pr["body"]
            )

        evidence.append(
            {
                "id": (
                    f"github_pr_"
                    f"{pr['number']}"
                ),
                "source": "github",
                "type": "pull_request",
                "timestamp": (
                    pr.get("updated_at")
                ),
                "actor": (
                    pr.get(
                        "user",
                        {},
                    ).get("login")
                ),
                "content": content,
                "url": pr.get(
                    "html_url"
                ),
                "metadata": {
                    "number": pr[
                        "number"
                    ],
                    "state": pr.get(
                        "state"
                    ),
                    "merged": merged,
                    "merged_at": pr.get(
                        "merged_at"
                    ),
                    "title": pr.get(
                        "title"
                    ),
                    "body": pr.get(
                        "body"
                    ),
                    "head_sha": (
                        pr.get(
                            "head",
                            {},
                        ).get("sha")
                    ),
                },
            }
        )

    return evidence


# ============================================================
# PR FILES
# ============================================================


def get_pull_request_files(
    owner: str,
    repo: str,
    pull_number: int,
    limit: int = 30,
) -> list:
    url = (
        f"https://api.github.com/repos/"
        f"{owner}/{repo}/pulls/"
        f"{pull_number}/files"
    )

    return _github_get(
        url,
        params={
            "per_page": limit,
        },
    )


def normalize_pull_request_files(
    pull_number: int,
    files: list,
    pr_timestamp: str | None = None,
    pr_url: str | None = None,
) -> list:
    evidence = []

    for index, file in enumerate(
        files
    ):
        filename = file.get(
            "filename"
        )

        content = (
            f"Pull request "
            f"#{pull_number} changed "
            f"file '{filename}'. "
            f"Status: "
            f"{file.get('status')}. "
            f"Additions: "
            f"{file.get('additions', 0)}, "
            f"deletions: "
            f"{file.get('deletions', 0)}."
        )

        patch = file.get("patch")

        if patch:
            content += (
                "\nPatch excerpt:\n"
                + patch[:2000]
            )

        evidence.append(
            {
                "id": (
                    f"github_pr_"
                    f"{pull_number}_file_"
                    f"{index}"
                ),
                "source": "github",
                "type": "code_change",
                "timestamp": pr_timestamp,
                "actor": None,
                "content": content,
                "url": pr_url,
                "metadata": {
                    "pull_number": (
                        pull_number
                    ),
                    "filename": filename,
                    "status": file.get(
                        "status"
                    ),
                    "additions": file.get(
                        "additions",
                        0,
                    ),
                    "deletions": file.get(
                        "deletions",
                        0,
                    ),
                },
            }
        )

    return evidence


# ============================================================
# ISSUES
# ============================================================


def get_issues(
    owner: str,
    repo: str,
    state: str = "all",
    limit: int = 30,
) -> list:
    url = (
        f"https://api.github.com/repos/"
        f"{owner}/{repo}/issues"
    )

    issues = _github_get(
        url,
        params={
            "state": state,
            "sort": "updated",
            "direction": "desc",
            "per_page": limit,
        },
    )

    # GitHub exposes PRs through
    # /issues too, so remove them.
    return [
        issue
        for issue in issues
        if "pull_request"
        not in issue
    ]


def normalize_issues(
    issues: list,
) -> list:
    evidence = []

    for issue in issues:
        labels = [
            label["name"]
            for label in issue.get(
                "labels",
                [],
            )
        ]

        content = (
            f"Issue "
            f"#{issue['number']} "
            f"'{issue['title']}' "
            f"is {issue['state']}."
        )

        if issue.get("body"):
            content += (
                "\nDescription: "
                + issue["body"]
            )

        if labels:
            content += (
                "\nLabels: "
                + ", ".join(labels)
            )

        evidence.append(
            {
                "id": (
                    f"github_issue_"
                    f"{issue['number']}"
                ),
                "source": "github",
                "type": "issue",
                "timestamp": (
                    issue.get(
                        "updated_at"
                    )
                ),
                "actor": (
                    issue.get(
                        "user",
                        {},
                    ).get("login")
                ),
                "content": content,
                "url": issue.get(
                    "html_url"
                ),
                "metadata": {
                    "number": issue[
                        "number"
                    ],
                    "state": issue.get(
                        "state"
                    ),
                    "title": issue.get(
                        "title"
                    ),
                    "labels": labels,
                    "closed_at": (
                        issue.get(
                            "closed_at"
                        )
                    ),
                },
            }
        )

    return evidence


# ============================================================
# ISSUE / PR COMMENTS
# ============================================================


def get_issue_comments(
    owner: str,
    repo: str,
    since: str | None = None,
    limit: int = 30,
) -> list:
    url = (
        f"https://api.github.com/repos/"
        f"{owner}/{repo}/issues/"
        f"comments"
    )

    params = {
        "sort": "updated",
        "direction": "desc",
        "per_page": limit,
    }

    if since:
        params["since"] = since

    return _github_get(
        url,
        params=params,
    )


def normalize_issue_comments(
    comments: list,
) -> list:
    evidence = []

    for comment in comments:
        issue_number = (
            comment[
                "issue_url"
            ]
            .rstrip("/")
            .split("/")[-1]
        )

        body = (
            comment.get(
                "body",
                "",
            )
            or ""
        )

        evidence.append(
            {
                "id": (
                    f"github_comment_"
                    f"{comment['id']}"
                ),
                "source": "github",
                "type": (
                    "issue_comment"
                ),
                "timestamp": (
                    comment.get(
                        "updated_at"
                    )
                ),
                "actor": (
                    comment.get(
                        "user",
                        {},
                    ).get("login")
                ),
                "content": (
                    f"Comment on "
                    f"issue/PR "
                    f"#{issue_number}: "
                    f"{body}"
                ),
                "url": comment.get(
                    "html_url"
                ),
                "metadata": {
                    "issue_number": (
                        int(
                            issue_number
                        )
                    ),
                },
            }
        )

    return evidence


# ============================================================
# PR REVIEW COMMENTS
# ============================================================


def get_pr_review_comments(
    owner: str,
    repo: str,
    limit: int = 30,
) -> list:
    url = (
        f"https://api.github.com/repos/"
        f"{owner}/{repo}/pulls/"
        f"comments"
    )

    return _github_get(
        url,
        params={
            "sort": "updated",
            "direction": "desc",
            "per_page": limit,
        },
    )


def normalize_pr_review_comments(
    comments: list,
) -> list:
    evidence = []

    for comment in comments:
        pull_number = None

        pull_url = (
            comment.get(
                "pull_request_url"
            )
        )

        if pull_url:
            try:
                pull_number = int(
                    pull_url
                    .rstrip("/")
                    .split("/")[-1]
                )
            except ValueError:
                pass

        evidence.append(
            {
                "id": (
                    "github_pr_review_"
                    f"{comment['id']}"
                ),
                "source": "github",
                "type": (
                    "pull_request_"
                    "review_comment"
                ),
                "timestamp": (
                    comment.get(
                        "updated_at"
                    )
                ),
                "actor": (
                    comment.get(
                        "user",
                        {},
                    ).get("login")
                ),
                "content": (
                    "Pull request "
                    "review comment on "
                    f"{comment.get('path', 'unknown file')}: "
                    f"{comment.get('body', '')}"
                ),
                "url": comment.get(
                    "html_url"
                ),
                "metadata": {
                    "pull_number": (
                        pull_number
                    ),
                    "path": comment.get(
                        "path"
                    ),
                    "commit_id": (
                        comment.get(
                            "commit_id"
                        )
                    ),
                },
            }
        )

    return evidence


# ============================================================
# EVIDENCE QUALITY
# ============================================================


def deduplicate_evidence(
    evidence: list,
) -> list:
    seen_ids = set()
    seen_content = set()

    result = []

    for item in evidence:
        evidence_id = item.get(
            "id"
        )

        content = str(
            item.get(
                "content",
                "",
            )
        ).strip()

        normalized_content = (
            " ".join(
                content.lower().split()
            )
        )

        if evidence_id in seen_ids:
            continue

        if (
            normalized_content
            and normalized_content
            in seen_content
        ):
            continue

        if evidence_id:
            seen_ids.add(
                evidence_id
            )

        if normalized_content:
            seen_content.add(
                normalized_content
            )

        result.append(item)

    return result


def evidence_priority(
    item: dict,
) -> int:
    evidence_type = item.get(
        "type"
    )

    metadata = item.get(
        "metadata",
        {},
    )

    if (
        evidence_type
        == "pull_request"
        and metadata.get("merged")
    ):
        return 100

    if (
        evidence_type == "issue"
        and metadata.get(
            "state"
        )
        == "closed"
    ):
        return 90

    if evidence_type == (
        "code_change"
    ):
        return 85

    if evidence_type == (
        "pull_request"
    ):
        return 75

    if evidence_type == "issue":
        return 70

    if evidence_type == (
        "pull_request_"
        "review_comment"
    ):
        return 65

    if evidence_type == (
        "issue_comment"
    ):
        return 55

    if evidence_type == "commit":
        return 50

    if evidence_type == "readme":
        return 40

    if evidence_type == (
        "repository"
    ):
        return 20

    return 10


def rank_evidence(
    evidence: list,
) -> list:
    return sorted(
        evidence,
        key=lambda item: (
            evidence_priority(item),
            parse_github_timestamp(
                item.get(
                    "timestamp"
                )
            )
            or datetime.min.replace(
                tzinfo=timezone.utc
            ),
        ),
        reverse=True,
    )


# ============================================================
# CROSS-EVIDENCE LINKING
# ============================================================


def extract_reference_numbers(
    text: str,
) -> set[int]:
    """
    Detect GitHub references such as:
    #12
    fixes #12
    closes #18
    resolves #22
    """

    if not text:
        return set()

    matches = re.findall(
        r"#(\d+)",
        text,
    )

    return {
        int(match)
        for match in matches
    }


def extract_keywords(
    text: str,
) -> set[str]:
    """
    Very lightweight keyword extraction
    used for evidence similarity.
    """

    if not text:
        return set()

    stop_words = {
        "the",
        "and",
        "for",
        "with",
        "from",
        "this",
        "that",
        "into",
        "using",
        "add",
        "added",
        "update",
        "updated",
        "implement",
        "implemented",
        "change",
        "changed",
        "fix",
        "fixed",
        "pull",
        "request",
        "issue",
        "commit",
    }

    words = re.findall(
        r"[a-zA-Z0-9_]+",
        text.lower(),
    )

    return {
        word
        for word in words
        if len(word) >= 4
        and word
        not in stop_words
    }


def evidence_text(
    item: dict,
) -> str:
    content = item.get(
        "content",
        "",
    )

    if isinstance(
        content,
        dict,
    ):
        content = " ".join(
            str(value)
            for value
            in content.values()
            if value
        )

    metadata = item.get(
        "metadata",
        {},
    )

    title = metadata.get(
        "title",
        "",
    )

    message = metadata.get(
        "message",
        "",
    )

    return (
        f"{content} "
        f"{title} "
        f"{message}"
    )


def evidence_similarity(
    first: dict,
    second: dict,
) -> float:
    first_keywords = (
        extract_keywords(
            evidence_text(first)
        )
    )

    second_keywords = (
        extract_keywords(
            evidence_text(second)
        )
    )

    if (
        not first_keywords
        or not second_keywords
    ):
        return 0.0

    intersection = (
        first_keywords
        & second_keywords
    )

    union = (
        first_keywords
        | second_keywords
    )

    return (
        len(intersection)
        / len(union)
    )


def are_explicitly_linked(
    first: dict,
    second: dict,
) -> bool:
    first_metadata = first.get(
        "metadata",
        {},
    )

    second_metadata = second.get(
        "metadata",
        {},
    )

    first_type = first.get(
        "type"
    )

    second_type = second.get(
        "type"
    )

    # --------------------------------
    # PR ↔ PR file
    # --------------------------------

    if (
        first_type
        == "pull_request"
        and second_metadata.get(
            "pull_number"
        )
        == first_metadata.get(
            "number"
        )
    ):
        return True

    if (
        second_type
        == "pull_request"
        and first_metadata.get(
            "pull_number"
        )
        == second_metadata.get(
            "number"
        )
    ):
        return True

    # --------------------------------
    # Issue / PR ↔ comment
    # --------------------------------

    first_number = (
        first_metadata.get(
            "number"
        )
    )

    second_number = (
        second_metadata.get(
            "number"
        )
    )

    first_comment_number = (
        first_metadata.get(
            "issue_number"
        )
    )

    second_comment_number = (
        second_metadata.get(
            "issue_number"
        )
    )

    if (
        first_number
        and second_comment_number
        == first_number
    ):
        return True

    if (
        second_number
        and first_comment_number
        == second_number
    ):
        return True

    # --------------------------------
    # PR ↔ commit SHA
    # --------------------------------

    first_head_sha = (
        first_metadata.get(
            "head_sha"
        )
    )

    second_head_sha = (
        second_metadata.get(
            "head_sha"
        )
    )

    first_sha = (
        first_metadata.get(
            "sha"
        )
    )

    second_sha = (
        second_metadata.get(
            "sha"
        )
    )

    if (
        first_head_sha
        and second_sha
        and first_head_sha
        == second_sha
    ):
        return True

    if (
        second_head_sha
        and first_sha
        and second_head_sha
        == first_sha
    ):
        return True

    # --------------------------------
    # Explicit #number references
    # --------------------------------

    first_refs = (
        extract_reference_numbers(
            evidence_text(first)
        )
    )

    second_refs = (
        extract_reference_numbers(
            evidence_text(second)
        )
    )

    if (
        second_number
        and second_number
        in first_refs
    ):
        return True

    if (
        first_number
        and first_number
        in second_refs
    ):
        return True

    return False


def link_related_evidence(
    evidence: list,
    similarity_threshold: float = 0.35,
) -> list:
    """
    Adds related_evidence_ids to each
    evidence item's metadata.

    Linking can happen because of:

    - matching PR number
    - matching issue number
    - comment parent relationship
    - matching commit SHA
    - explicit #issue references
    - strong keyword similarity
    """

    for item in evidence:
        item.setdefault(
            "metadata",
            {},
        )

        item[
            "metadata"
        ].setdefault(
            "related_evidence_ids",
            [],
        )

    for first_index in range(
        len(evidence)
    ):
        for second_index in range(
            first_index + 1,
            len(evidence),
        ):
            first = evidence[
                first_index
            ]

            second = evidence[
                second_index
            ]

            explicitly_linked = (
                are_explicitly_linked(
                    first,
                    second,
                )
            )

            similarity = (
                evidence_similarity(
                    first,
                    second,
                )
            )

            if (
                not explicitly_linked
                and similarity
                < similarity_threshold
            ):
                continue

            first_id = first.get(
                "id"
            )

            second_id = second.get(
                "id"
            )

            if (
                first_id
                and first_id
                not in second[
                    "metadata"
                ][
                    "related_evidence_ids"
                ]
            ):
                second[
                    "metadata"
                ][
                    "related_evidence_ids"
                ].append(
                    first_id
                )

            if (
                second_id
                and second_id
                not in first[
                    "metadata"
                ][
                    "related_evidence_ids"
                ]
            ):
                first[
                    "metadata"
                ][
                    "related_evidence_ids"
                ].append(
                    second_id
                )

    return evidence


# ============================================================
# FINAL PROCESSING PIPELINE
# ============================================================


def process_evidence(
    evidence: list,
) -> list:
    evidence = (
        deduplicate_evidence(
            evidence
        )
    )

    evidence = (
        link_related_evidence(
            evidence
        )
    )

    evidence = rank_evidence(
        evidence
    )

    return evidence


# ============================================================
# INITIAL PROJECT EVIDENCE
# ============================================================


def get_initial_project_evidence(
    owner: str,
    repo: str,
) -> list:
    evidence = []

    # Repository metadata
    evidence.append(
        get_repository_info(
            owner,
            repo,
        )
    )

    # README
    readme = get_readme(
        owner,
        repo,
    )

    if readme:
        evidence.append(
            readme
        )

    # Recent commits
    commits = get_recent_commits(
        owner,
        repo,
        limit=15,
    )

    evidence.extend(
        normalize_commits(
            commits
        )
    )

    # Commit file changes
    for commit in commits[:8]:
        details = (
            get_commit_details(
                owner,
                repo,
                commit["sha"],
            )
        )

        evidence.extend(
            normalize_commit_details(
                details
            )
        )

    # Pull requests
    pull_requests = (
        get_pull_requests(
            owner,
            repo,
            limit=10,
        )
    )

    evidence.extend(
        normalize_pull_requests(
            pull_requests
        )
    )

    # PR files
    for pr in pull_requests[:5]:
        files = (
            get_pull_request_files(
                owner,
                repo,
                pr["number"],
                limit=20,
            )
        )

        evidence.extend(
            normalize_pull_request_files(
                pull_number=pr[
                    "number"
                ],
                files=files,
                pr_timestamp=pr.get(
                    "updated_at"
                ),
                pr_url=pr.get(
                    "html_url"
                ),
            )
        )

    # Issues
    issues = get_issues(
        owner,
        repo,
        limit=20,
    )

    evidence.extend(
        normalize_issues(
            issues
        )
    )

    # Issue / PR comments
    comments = get_issue_comments(
        owner,
        repo,
        limit=20,
    )

    evidence.extend(
        normalize_issue_comments(
            comments
        )
    )

    # Review comments
    review_comments = (
        get_pr_review_comments(
            owner,
            repo,
            limit=20,
        )
    )

    evidence.extend(
        normalize_pr_review_comments(
            review_comments
        )
    )

    return process_evidence(
        evidence
    )


# ============================================================
# RESUME EVIDENCE
# ============================================================


def get_resume_project_evidence(
    owner: str,
    repo: str,
    since: str,
) -> list:
    evidence = []

    # --------------------------------
    # New commits
    # --------------------------------

    commits = get_commits_since(
        owner,
        repo,
        since,
        limit=30,
    )

    evidence.extend(
        normalize_commits(
            commits
        )
    )

    # Commit file changes
    for commit in commits[:10]:
        details = (
            get_commit_details(
                owner,
                repo,
                commit["sha"],
            )
        )

        evidence.extend(
            normalize_commit_details(
                details
            )
        )

    # --------------------------------
    # Pull requests
    # --------------------------------

    pull_requests = (
        get_pull_requests(
            owner,
            repo,
            limit=30,
        )
    )

    recent_prs = [
        pr
        for pr
        in pull_requests
        if timestamp_after(
            pr.get(
                "updated_at"
            ),
            since,
        )
    ]

    evidence.extend(
        normalize_pull_requests(
            recent_prs
        )
    )

    for pr in recent_prs[:8]:
        files = (
            get_pull_request_files(
                owner,
                repo,
                pr["number"],
                limit=30,
            )
        )

        evidence.extend(
            normalize_pull_request_files(
                pull_number=pr[
                    "number"
                ],
                files=files,
                pr_timestamp=pr.get(
                    "updated_at"
                ),
                pr_url=pr.get(
                    "html_url"
                ),
            )
        )

    # --------------------------------
    # Issues
    # --------------------------------

    issues = get_issues(
        owner,
        repo,
        limit=40,
    )

    recent_issues = [
        issue
        for issue in issues
        if timestamp_after(
            issue.get(
                "updated_at"
            ),
            since,
        )
    ]

    evidence.extend(
        normalize_issues(
            recent_issues
        )
    )

    # --------------------------------
    # Comments
    # --------------------------------

    comments = get_issue_comments(
        owner,
        repo,
        since=since,
        limit=40,
    )

    evidence.extend(
        normalize_issue_comments(
            comments
        )
    )

    # --------------------------------
    # Review comments
    # --------------------------------

    review_comments = (
        get_pr_review_comments(
            owner,
            repo,
            limit=40,
        )
    )

    recent_reviews = [
        comment
        for comment
        in review_comments
        if timestamp_after(
            comment.get(
                "updated_at"
            ),
            since,
        )
    ]

    evidence.extend(
        normalize_pr_review_comments(
            recent_reviews
        )
    )

    # --------------------------------
    # Clean + link + rank
    # --------------------------------

    return process_evidence(
        evidence
    )