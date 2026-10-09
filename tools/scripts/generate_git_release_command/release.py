import argparse


def parse_args():
    parser = argparse.ArgumentParser(
        description="Generate Git/GitHub release commands."
    )
    parser.add_argument(
        "version",
        help="Release version, e.g. 0.1.0 or v0.1.0",
    )
    return parser.parse_args()


def main():
    args = parse_args()

    version = args.version.removeprefix("v")
    tag = f"v{version}"
    title = f"{tag} — MVP core (pre-release)"
    notes_file = f"docs/releases/release-notes-{tag}.md"

    print(f'git tag -a {tag} -m "{title}"')
    print(f"git push origin {tag}")
    print(
        f"gh release create {tag} --prerelease "
        f'--title "{title}" '
        f"--notes-file {notes_file}"
    )


if __name__ == "__main__":
    main()
