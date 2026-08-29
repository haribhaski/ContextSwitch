import argparse
import json
import os
from pathlib import Path

import requests


API_BASE = "http://127.0.0.1:8000"

CONFIG_FILE = Path(".contextswitch")


# ============================================================
# CONFIG
# ============================================================

def save_config(config: dict):
    with open(CONFIG_FILE, "w") as file:
        json.dump(config, file, indent=2)


def load_config() -> dict:
    if not CONFIG_FILE.exists():
        raise RuntimeError(
            "ContextSwitch is not initialized here.\n"
            "Run: cs init"
        )

    with open(CONFIG_FILE, "r") as file:
        return json.load(file)


# ============================================================
# INIT
# ============================================================

def command_init(args):
    config = {
        "team_id": args.team,
        "project_id": args.project,
        "worker_id": args.worker,
        "source": args.source,
    }

    save_config(config)

    print()
    print("ContextSwitch initialized")
    print(f"Team:    {args.team}")
    print(f"Project: {args.project}")
    print(f"Worker:  {args.worker}")
    print(f"Source:  {args.source}")
    print()


# ============================================================
# SEND ENTRY
# ============================================================

def send_entry(
    entry_type: str,
    content: str,
):
    config = load_config()

    team_id = config["team_id"]
    project_id = config["project_id"]
    worker_id = config["worker_id"]
    source = config.get("source", "cli")

    url = (
        f"{API_BASE}/teams/"
        f"{team_id}/projects/"
        f"{project_id}/entries"
    )

    payload = {
        "worker_id": worker_id,
        "entry_type": entry_type,
        "content": content,
        "source": source,
    }

    try:
        response = requests.post(
            url,
            json=payload,
            timeout=60,
        )

    except requests.RequestException as exc:
        print(
            "Could not connect to ContextSwitch backend."
        )
        print(exc)
        return

    if not response.ok:
        print(
            f"Backend returned error "
            f"{response.status_code}"
        )

        try:
            print(
                response.json()
            )
        except Exception:
            print(
                response.text
            )

        return

    result = response.json()

    print()
    print(
        f"✓ {entry_type.upper()} logged"
    )

    print(
        f"Entry ID: "
        f"{result.get('entry_id')}"
    )

    if result.get(
        "conflict_detected"
    ):

        conflict = result.get(
            "conflict",
            {},
        )

        print()
        print(
            "⚠ CONFLICT DETECTED"
        )

        print(
            f"Topic: "
            f"{conflict.get('topic')}"
        )

        side_a = conflict.get(
            "side_a",
            {},
        )

        side_b = conflict.get(
            "side_b",
            {},
        )

        print()
        print(
            f"{side_a.get('worker_id')}: "
            f"{side_a.get('position')}"
        )

        print(
            f"{side_b.get('worker_id')}: "
            f"{side_b.get('position')}"
        )

        print()

        reason = conflict.get(
            "reason"
        )

        if reason:
            print(
                f"Reason: {reason}"
            )

    print()


# ============================================================
# LOG
# ============================================================

def command_log(args):
    send_entry(
        entry_type="decision",
        content=args.message,
    )


# ============================================================
# DONE
# ============================================================

def command_done(args):
    send_entry(
        entry_type="completed",
        content=args.message,
    )


# ============================================================
# BLOCKED
# ============================================================

def command_blocked(args):
    send_entry(
        entry_type="blocker",
        content=args.message,
    )


# ============================================================
# FAIL
# ============================================================

def command_fail(args):
    send_entry(
        entry_type="failure",
        content=args.message,
    )


# ============================================================
# EXPORT
# ============================================================

def command_export(args):
    config = load_config()

    team_id = config["team_id"]
    project_id = config["project_id"]

    url = (
        f"{API_BASE}/teams/"
        f"{team_id}/projects/"
        f"{project_id}/export"
    )

    try:
        response = requests.get(
            url,
            timeout=30,
        )

    except requests.RequestException as exc:
        print(
            "Could not connect to ContextSwitch backend."
        )
        print(exc)
        return

    if not response.ok:
        print(
            f"Backend returned error "
            f"{response.status_code}"
        )
        print(
            response.text
        )
        return

    data = response.json()

    state = data.get(
        "state",
        {},
    )

    conflicts = data.get(
        "active_conflicts",
        [],
    )

    print()
    print(
        "=" * 60
    )
    print(
        "CONTEXTSWITCH PROJECT CONTEXT"
    )
    print(
        "=" * 60
    )

    print()
    print("PROJECT")
    print(
        data.get(
            "project_name",
            project_id,
        )
    )

    print()
    print("GOAL")
    print(
        state.get(
            "goal",
            ""
        )
        or "Not defined"
    )

    print_section(
        "COMPLETED",
        state.get(
            "progress",
            [],
        ),
    )

    print_section(
        "DECISIONS",
        state.get(
            "decisions",
            [],
        ),
    )

    print_section(
        "FAILED ATTEMPTS",
        state.get(
            "failures",
            [],
        ),
    )

    print_section(
        "BLOCKERS",
        state.get(
            "blockers",
            [],
        ),
    )

    print_section(
        "OPEN QUESTIONS",
        state.get(
            "open_questions",
            [],
        ),
    )

    print_section(
        "DEPENDENCIES",
        state.get(
            "dependencies",
            [],
        ),
    )

    print_section(
        "NEXT ACTIONS",
        state.get(
            "next_actions",
            [],
        ),
    )

    print()
    print("ACTIVE CONFLICTS")

    if not conflicts:
        print("- None")

    else:
        for conflict in conflicts:

            print(
                f"- {conflict.get('topic')}"
            )

            side_a = conflict.get(
                "side_a",
                {},
            )

            side_b = conflict.get(
                "side_b",
                {},
            )

            print(
                f"  {side_a.get('worker_id')}: "
                f"{side_a.get('position')}"
            )

            print(
                f"  {side_b.get('worker_id')}: "
                f"{side_b.get('position')}"
            )

    print()
    print(
        "=" * 60
    )
    print()


def print_section(
    title: str,
    items: list,
):
    print()
    print(title)

    if not items:
        print("- None")
        return

    for item in items:
        print(
            f"- {item}"
        )


# ============================================================
# STATUS
# ============================================================

def command_status(args):
    config = load_config()

    team_id = config["team_id"]
    project_id = config["project_id"]

    url = (
        f"{API_BASE}/teams/"
        f"{team_id}/projects/"
        f"{project_id}"
    )

    try:
        response = requests.get(
            url,
            timeout=30,
        )

    except requests.RequestException as exc:
        print(
            "Could not connect to ContextSwitch backend."
        )
        print(exc)
        return

    if not response.ok:
        print(
            response.text
        )
        return

    data = response.json()

    project = data.get(
        "project",
        {},
    )

    members = data.get(
        "members",
        [],
    )

    conflicts = data.get(
        "active_conflicts",
        [],
    )

    print()
    print(
        f"Project: "
        f"{project.get('name')}"
    )

    print(
        f"Team: "
        f"{team_id}"
    )

    print(
        f"Members: "
        f"{len(members)}"
    )

    print(
        f"Active conflicts: "
        f"{len(conflicts)}"
    )

    print()


# ============================================================
# MAIN CLI
# ============================================================

def main():
    parser = argparse.ArgumentParser(
        prog="cs",
        description=(
            "ContextSwitch - shared memory "
            "for AI development teams"
        ),
    )

    subparsers = parser.add_subparsers(
        dest="command",
        required=True,
    )

    # --------------------------------------------------------
    # cs init
    # --------------------------------------------------------

    init_parser = subparsers.add_parser(
        "init",
        help="Initialize ContextSwitch",
    )

    init_parser.add_argument(
        "--team",
        required=True,
        help="Team ID",
    )

    init_parser.add_argument(
        "--project",
        required=True,
        help="Project ID",
    )

    init_parser.add_argument(
        "--worker",
        required=True,
        help="Your worker ID",
    )

    init_parser.add_argument(
        "--source",
        default="cli",
        help=(
            "AI/tool source: "
            "cursor, claude, antigravity, cli"
        ),
    )

    init_parser.set_defaults(
        func=command_init
    )

    # --------------------------------------------------------
    # cs log
    # --------------------------------------------------------

    log_parser = subparsers.add_parser(
        "log",
        help="Log a project decision",
    )

    log_parser.add_argument(
        "message"
    )

    log_parser.set_defaults(
        func=command_log
    )

    # --------------------------------------------------------
    # cs done
    # --------------------------------------------------------

    done_parser = subparsers.add_parser(
        "done",
        help="Mark work as completed",
    )

    done_parser.add_argument(
        "message"
    )

    done_parser.set_defaults(
        func=command_done
    )

    # --------------------------------------------------------
    # cs blocked
    # --------------------------------------------------------

    blocked_parser = (
        subparsers.add_parser(
            "blocked",
            help="Log a blocker",
        )
    )

    blocked_parser.add_argument(
        "message"
    )

    blocked_parser.set_defaults(
        func=command_blocked
    )

    # --------------------------------------------------------
    # cs fail
    # --------------------------------------------------------

    fail_parser = subparsers.add_parser(
        "fail",
        help="Record a failed attempt",
    )

    fail_parser.add_argument(
        "message"
    )

    fail_parser.set_defaults(
        func=command_fail
    )

    # --------------------------------------------------------
    # cs status
    # --------------------------------------------------------

    status_parser = (
        subparsers.add_parser(
            "status",
            help="Show project status",
        )
    )

    status_parser.set_defaults(
        func=command_status
    )

    # --------------------------------------------------------
    # cs export
    # --------------------------------------------------------

    export_parser = (
        subparsers.add_parser(
            "export",
            help=(
                "Export shared context "
                "for another AI tool"
            ),
        )
    )

    export_parser.set_defaults(
        func=command_export
    )

    # --------------------------------------------------------

    args = parser.parse_args()

    args.func(args)


if __name__ == "__main__":
    main()