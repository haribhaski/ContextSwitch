from contextswitch.connectors.github import (
    get_recent_commits,
    normalize_commits
)


OWNER = "haribhaski"
REPO = "Financial-Specific-CHAT-BOT-Using-Hybrid-RAG-System-with-Citation-Enforcement"


commits = get_recent_commits(
    OWNER,
    REPO,
    limit=5
)

evidence = normalize_commits(commits)

for item in evidence:
    print(item)