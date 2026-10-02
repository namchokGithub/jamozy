#!/usr/bin/env python3
"""Compare the plain word list with the leveled NIKL list and the Tagger queue.

Reports:
  - word counts in each list and which words appear in only one of them;
  - unique Hangul syllables in each list;
  - syllables of either list that are not in the Jamo SVG Tagger queue yet;
  - leveled-list rows whose word cell contains anything except Hangul/digits.

Rules (match `pnpm jamo-svg:enqueue` for the plain list):
  - Plain list (.md): skip blank lines and lines starting with `#`; every other
    line is one word.
  - Leveled list (.txt): tab-separated with a header row
    (순위, 단어, 품사, 풀이, 등급); the word is the 단어 column with its trailing
    sense number removed (가격03 → 가격). With --strip-parentheses, text in
    parentheses is removed too (도쿄(동경) → 도쿄), as was done when the 76
    extra words were appended to the plain list.
  - A syllable is any character from 가 (U+AC00) to 힣 (U+D7A3).

Usage (from the repository root):
  python3 docs/research/compare_word_lists.py
  python3 docs/research/compare_word_lists.py --strip-parentheses
  python3 docs/research/compare_word_lists.py --words other.md --leveled other.txt
  python3 docs/research/compare_word_lists.py --write-missing-words missing.md
"""

import argparse
import json
import re
import sys
from pathlib import Path

HANGUL_FIRST, HANGUL_LAST = "가", "힣"


def syllables(words):
    return {char for word in words for char in word if HANGUL_FIRST <= char <= HANGUL_LAST}


def read_plain_list(path):
    lines = (line.strip() for line in path.read_text(encoding="utf-8").splitlines())
    return [line for line in lines if line and not line.startswith("#")]


def read_leveled_list(path, strip_parentheses):
    rows = []
    lines = path.read_text(encoding="utf-8").splitlines()
    for number, line in enumerate(lines[1:], start=2):  # line 1 is the header
        cells = line.split("\t")
        if len(cells) < 2 or not cells[1].strip():
            continue
        raw = cells[1].strip()
        word = re.sub(r"\d+$", "", raw)
        if strip_parentheses:
            word = re.sub(r"\(.*?\)", "", word).strip()
        rank = int(cells[0]) if cells[0].strip().isdigit() else None
        level = cells[4].strip() if len(cells) > 4 else ""
        rows.append({"line": number, "rank": rank, "raw": raw, "word": word, "level": level})
    return rows


def read_queue(path):
    if not path.exists():
        return set()
    return {entry["syllable"] for entry in json.loads(path.read_text(encoding="utf-8"))["entries"]}


def show(title, items, limit):
    items = list(items)
    shown = items if limit <= 0 else items[:limit]
    more = "" if len(shown) == len(items) else f" … (+{len(items) - len(shown)} more)"
    print(f"{title} ({len(items)}): {' '.join(shown)}{more}")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--words", default="docs/informations/korean_words.md", help="plain word list")
    parser.add_argument("--leveled", default="docs/informations/5800_korean_words_with_lvl.txt", help="leveled TSV list")
    parser.add_argument("--queue", default="tools/jamo-svg/queue/pretendard-600/queue.json", help="Tagger queue file")
    parser.add_argument("--strip-parentheses", action="store_true", help="drop (…) from leveled words")
    parser.add_argument("--limit", type=int, default=80, help="max items printed per list (0 = all)")
    parser.add_argument("--write-missing-words", metavar="FILE", help="write leveled-only words, in rank order, one per line")
    args = parser.parse_args()

    words_path, leveled_path, queue_path = Path(args.words), Path(args.leveled), Path(args.queue)
    for path in (words_path, leveled_path):
        if not path.exists():
            sys.exit(f"Missing file: {path}")

    plain = read_plain_list(words_path)
    rows = read_leveled_list(leveled_path, args.strip_parentheses)
    plain_set = set(plain)
    leveled_set = {row["word"] for row in rows}
    queue = read_queue(queue_path)

    print(f"Plain list:   {words_path} — {len(plain)} lines, {len(plain_set)} unique words")
    print(f"Leveled list: {leveled_path} — {len(rows)} rows, {len(leveled_set)} unique words")
    duplicates = len(plain) - len(plain_set)
    if duplicates:
        print(f"  note: plain list repeats {duplicates} words")

    # Leveled-only words in rank order (lowest 순위 first), like the appended section.
    best_rank = {}
    for row in rows:
        if row["word"] in plain_set:
            continue
        rank = row["rank"] if row["rank"] is not None else 10**9
        best_rank[row["word"]] = min(rank, best_rank.get(row["word"], 10**9))
    leveled_only = sorted(best_rank, key=lambda word: (best_rank[word], word))

    show("Only in plain list", sorted(plain_set - leveled_set), args.limit)
    show("Only in leveled list (rank order)", leveled_only, args.limit)

    plain_syllables, leveled_syllables = syllables(plain_set), syllables(leveled_set)
    print(f"Syllables: plain {len(plain_syllables)}, leveled {len(leveled_syllables)}, both {len(plain_syllables | leveled_syllables)}")
    show("Leveled syllables missing from plain list", sorted(leveled_syllables - plain_syllables), args.limit)
    if queue:
        print(f"Queue: {queue_path} — {len(queue)} syllables")
        show("Plain-list syllables not in queue", sorted(plain_syllables - queue), args.limit)
        show("Leveled-list syllables not in queue", sorted(leveled_syllables - queue), args.limit)
    else:
        print(f"Queue: {queue_path} not found; skipped queue comparison")

    odd = [f"{row['raw']} (line {row['line']})" for row in rows if re.search(r"[^가-힣0-9]", row["raw"])]
    show("Leveled word cells with non-Hangul characters", odd, args.limit)

    if args.write_missing_words:
        Path(args.write_missing_words).write_text("\n".join(leveled_only) + "\n", encoding="utf-8")
        print(f"Wrote {len(leveled_only)} words to {args.write_missing_words}")


if __name__ == "__main__":
    main()
