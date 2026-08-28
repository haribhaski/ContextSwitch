import os
import requests
from dotenv import load_dotenv

load_dotenv()

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")


import base64


def get_readme(owner: str, repo: str) -> dict | None:

    url = f"https://api.github.com/repos/{owner}/{repo}/readme"

    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {GITHUB_TOKEN}",
    }

    response = requests.get(
        url,
        headers=headers,
        timeout=20
    )

    if response.status_code == 404:
        return None

    response.raise_for_status()

    data = response.json()

    content = base64.b64decode(
        data["content"]
    ).decode(
        "utf-8",
        errors="ignore"
    )

    return {
        "id": "github_readme",
        "source": "github",
        "type": "readme",
        "content": content
    }

def get_repository_info(
    owner: str,
    repo: str
) -> dict:

    url = f"https://api.github.com/repos/{owner}/{repo}"

    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {GITHUB_TOKEN}",
    }

    response = requests.get(
        url,
        headers=headers,
        timeout=20
    )

    response.raise_for_status()

    data = response.json()

    return {
        "id": "github_repository",
        "source": "github",
        "type": "repository",
        "content": {
            "name": data["name"],
            "description": data.get("description"),
            "language": data.get("language"),
            "topics": data.get("topics", [])
        }
    }

def get_initial_project_evidence(
    owner: str,
    repo: str
) -> list:

    evidence = []

    repository = get_repository_info(
        owner,
        repo
    )

    evidence.append(repository)

    readme = get_readme(
        owner,
        repo
    )

    if readme:
        evidence.append(readme)

    commits = get_recent_commits(
        owner,
        repo,
        limit=15
    )

    evidence.extend(
        normalize_commits(commits)
    )

    return evidence


def get_recent_commits(
    owner: str,
    repo: str,
    limit: int = 10
) -> list:

    url = f"https://api.github.com/repos/{owner}/{repo}/commits"

    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2026-03-10"
    }
    if GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"

    params = {
        "per_page": limit
    }

    response = requests.get(
        url,
        headers=headers,
        params=params,
        timeout=20
    )

    response.raise_for_status()

    commits = response.json()

    return commits

def normalize_commits(commits: list) -> list:

    evidence = []

    for commit in commits:

        sha = commit["sha"]

        message = commit["commit"]["message"]

        author = (
            commit.get("author", {}) or {}
        ).get(
            "login",
            commit["commit"]["author"]["name"]
        )

        timestamp = commit["commit"]["author"]["date"]

        evidence.append({
            "id": f"github_{sha[:7]}",
            "source": "github",
            "type": "commit",
            "timestamp": timestamp,
            "content": (
                f"{author} committed: {message}"
            )
        })

    return evidence


def get_commits_since(
    owner: str,
    repo: str,
    since_iso: str,
    limit: int = 30,
) -> list:

    url = f"https://api.github.com/repos/{owner}/{repo}/commits"

    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {GITHUB_TOKEN}",
    }

    params = {
        "since": since_iso,
        "per_page": limit,
    }

    response = requests.get(
        url,
        headers=headers,
        params=params,
        timeout=20,
    )

    response.raise_for_status()

    return response.json()
