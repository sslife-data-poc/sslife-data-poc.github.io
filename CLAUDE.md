# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

데이터거버넌스팀 공개 홈페이지 (PoC). A single-file static site served by GitHub Pages from the root of `main`. There is no build step, package manager, linter, or test suite — edit `index.html` and open it in a browser (e.g. `open index.html`) to preview.

## Structure

- `index.html` — the entire site: inline `<style>` (line ~9) and markup, no JavaScript, no external assets. Page is one scroll with anchor sections `#about`, `#focus`, `#knowledge` linked from the header nav; the "HOW WE WORK" section has no id/nav link. Section eyebrows are numbered (`01 / ABOUT` … `04 / KNOWLEDGE`), so keep numbering consistent when adding or reordering sections.
- `.nojekyll` — disables Jekyll processing; leave in place.
- Content is Korean; keep copy in Korean and match the existing tone.

## Constraints

- Everything in this repo, including Git history, is public. Only externally publishable content belongs here — no internal documents, personal data, credentials, API keys, or unapproved material.
- No LLM calls or OpenRouter integration in this site (per README); don't add API keys or backend dependencies.
- Content changes are meant to go through PRs reviewed for wording, links, and disclosure scope before merging to `main`.

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues (`gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-label vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
