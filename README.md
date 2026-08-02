# Portfolio

A modern, dark-themed portfolio website built with Astro v5 and Tailwind CSS v4.

## Features

- **Data-driven**: All personal content lives in `src/data/profile.json` — swap this one file to rebrand the entire site
- **Blog**: Content Collections with Markdown, automatic RSS feed
- **Dark theme**: Animated aurora background, gradient text, glassmorphism, scroll reveals
- **Sections**: Hero, About, Experience, Projects, Skills, Education, Blog, Contact
- **Responsive**: Mobile-first, fully responsive
- **Accessible**: Semantic HTML, focus states, reduced-motion support

## Quick Start

```bash
npm install
npm run dev
```

## Customization

### Profile Data

Edit `src/data/profile.json` — this is the single source of truth for all personal data (name, experience, projects, skills, education, socials).

### Blog Posts

Add Markdown files to `src/content/blog/`. Frontmatter schema:

```yaml
---
title: "Post Title"
description: "Short description"
publishDate: 2024-01-15
tags: ["tag1", "tag2"]
readingTime: "5 min read"
draft: false
---
```

### Images

Place images in `public/images/`. Reference them as `/images/filename.ext` in profile.json and blog frontmatter.

### Colors

Edit CSS custom properties in `src/styles/global.css` under `@theme`.

## Build

```bash
npm run build    # Outputs to dist/
npm run preview  # Preview the production build
```

## Tech Stack

- [Astro v5](https://astro.build) — Static site generator with Content Collections
- [Tailwind CSS v4](https://tailwindcss.com) — Utility-first CSS
- [@astrojs/rss](https://docs.astro.build/en/guides/rss/) — RSS feed generation
