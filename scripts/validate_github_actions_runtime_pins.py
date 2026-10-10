from pathlib import Path

WORKFLOWS = Path(".github/workflows")

BLOCKED_ACTION_REFS = {
    "actions/checkout@11d5960a326750d5838078e36cf38b85af677262": "checkout pre-Node 24 runtime",
    "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020": "setup-node pre-Node 24 runtime",
    "actions/configure-pages@983d7736d9b0ae728b81ab479565c72886d7745b": "configure-pages pre-Node 24 runtime",
    "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02": "upload-artifact pre-Node 24 runtime",
    "actions/upload-pages-artifact@56afc609e74202658d3ffba0e8f6dda462b719fa": "upload-pages-artifact pre-Node 24 runtime",
    "actions/deploy-pages@d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e": "deploy-pages pre-Node 24 runtime",
}

REQUIRED_PAGES_REFS = {
    "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
    "actions/configure-pages@45bfe0192ca1faeb007ade9deae92b16b8254a0d",
    "actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9",
    "actions/upload-pages-artifact@fc324d3547104276b827a68afc52ff2a11cc49c9",
    "actions/deploy-pages@368f82528645a54fb793d4d04e342629a3f51346",
}


def main() -> None:
    failures = []
    for path in sorted(WORKFLOWS.glob("*.y*ml")):
        text = path.read_text(encoding="utf-8")
        for blocked, reason in BLOCKED_ACTION_REFS.items():
            if blocked in text:
                failures.append(f"{path}: blocked {blocked} ({reason})")

    pages = WORKFLOWS / "pages.yml"
    pages_text = pages.read_text(encoding="utf-8")
    if "runs-on: ubuntu-latest" in pages_text:
        failures.append(f"{pages}: public Pages deploy must pin ubuntu-24.04 runner")
    if "runs-on: ubuntu-24.04" not in pages_text:
        failures.append(f"{pages}: missing pinned ubuntu-24.04 runner")
    for required in sorted(REQUIRED_PAGES_REFS):
        if required not in pages_text:
            failures.append(f"{pages}: missing required public Pages action pin {required}")

    if failures:
        print("GITHUB_ACTIONS_NODE24_RUNTIME_PINS=FAIL")
        print("\n".join(failures))
        raise SystemExit(1)

    print("GITHUB_ACTIONS_NODE24_RUNTIME_PINS=PASS")


if __name__ == "__main__":
    main()
