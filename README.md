# NCKU Exam Toolkit

A static engineering reference and browser-local toolkit built with React, TypeScript and Vite. No account, database, backend, or external AI API is required. User notes, benchmark records and workflow entries stay in the browser's LocalStorage until exported or cleared.

## Current features

- Global client-side search with aliases and fuzzy matching (`Ctrl/Cmd+K`). Results cover articles, commands, troubleshooting and official documentation.
- Nested topic navigation, validated Markdown/JSON content, related links, table of contents and code copying.
- Command library with examples, options, precautions, official sources and one-click copy.
- McBopomofoWeb 2.1.0 integrated as a locally hosted browser IME. Standard Zhuyin keyboard, composition, candidate selection, mixed text and copy are supplied by the upstream engine. Original MIT license is in `public/ime/LICENSE.txt`.
- Prompt builder that assembles text locally without calling an AI API.
- Performance workbench with repeated trials, unit normalization, average, median, min/max, population standard deviation, speedup, improvement and throughput. It saves experiment details and an editable optimization workflow, and exports CSV/JSON.
- Personal notes with JSON import/export and a clear-local-data action.
- Troubleshooting and official documentation structures. Practice scenarios are reserved for supplied, source-graded material.
- Responsive desktop/mobile layout and dark/light mode.

## Project layout

```text
src/
  App.tsx           UI and interactions
  content.ts        schemas, topic tree, sample commands/docs
  content/          Markdown and JSON articles; add files here
  tools.ts          benchmark and prompt calculations
  base.css          global styles
  theme.css         component styles and responsive layout
public/ime/         self-hosted McBopomofoWeb example build and MIT license
vercel.json         Vercel static build configuration
```

## Local development

```sh
npm install
npm run dev
npm run build
npm run preview
```

`npm run build` includes TypeScript checking and writes the static site to `dist/`. Vercel builds the same way after a push to the production branch.

Run the focused calculation checks with `npm test`. To publish future changes after GitHub and Vercel are connected, commit and push to `main`; Vercel then rebuilds the static output.

## Existing project review

Before implementation, the accessible repositories included Eason One, LTA, English Output Trainer, SignalForge and Eason Trading. [LTA's design specification](https://github.com/easonlsystems/LTA/blob/main/DESIGN.md) emphasizes restrained dark surfaces, clear state and direct actions. [EOT's historical visual contract](https://github.com/eason11133/english-output-trainer/blob/main/EOT_LEARNER_EXPERIENCE_VISUAL_CONTRACT_V1.md) emphasizes one dominant action, Chinese-first text and meaningful progress. [Eason One](https://github.com/eason11133/eason-one) and [Eason Trading](https://github.com/eason11133/eason-trading) separate authoritative state from presentations and explicitly describe verification. This toolkit carries forward restrained presentation, short paths to useful actions, modular data and visible sources. It uses a simpler static architecture because no shared state or backend is required.

## Add content

Place a `.md` or `.json` file in `src/content/`. Vite's glob import automatically includes it; no React component edit is needed. A Markdown example is `src/content/docker-exec.md`; a JSON example is `src/content/concurrency.json`.

Markdown starts with simple YAML front matter. List fields use comma-separated values:

```yaml
---
id: unique-id
title: Article title
category: Docker
tags: docker, cli
aliases: container command
difficulty: beginner
priority: P1
source_type: official
source_url: https://docs.example.org/page
verified: true
updated_at: 2026-11-09
summary: One sentence.
related: other-article-id
---

## First heading

Verified body text.
```

The runtime validates each record with Zod on import. Invalid records fail the build or page load visibly instead of silently appearing in search. The source type is `official`, `community`, `personal` or `speculative`. Keep `verified: false` until claims have been checked. Use official links for documentation entries. Cross-links can use normal Markdown URLs; `related` IDs appear below an article.

## McBopomofoWeb provenance

The IME is the [OpenVanilla McBopomofoWeb](https://github.com/openvanilla/McBopomofoWeb) 2.1.0 browser example, built from upstream source with `npm install && npm run build`. This repository stores its generated `bundle.js`, example UI scripts/styles, and the complete MIT license under `public/ime/`. The original demo's analytics, remote CSS/scripts and unrelated conversion panes were removed or hidden for this embedded input surface. The app loads the IME only when the Zhuyin page is opened.

To update the IME, review the upstream version/license and repeat the build, copy the browser example assets into `public/ime/`, then reapply the local `toolkit.css` and privacy/asset changes in `index.html`. Run keyboard, candidate and copy tests before deployment.

## Privacy and limitations

The site does not send entered code, notes, prompts or benchmark data to an API. Clicking an official documentation link navigates to that external site. LocalStorage is per browser profile and can be erased by the browser; export data regularly. The imported example content is intentionally small, and exam scenarios and detailed prompt templates await reviewed source material. The full upstream IME bundle is about 5 MB and loads on demand.
