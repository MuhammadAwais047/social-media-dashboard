# Orbit 🪐

A social media analytics dashboard demo built with **pure vanilla JavaScript** — no frameworks, no chart libraries, no build step.

**Live demo:** https://muhammadawais047.github.io/social-media-dashboard/

## Features

- **Overview** — KPI cards with trend sparklines, an interactive follower/reach/engagement growth chart, platform mix bars, top-performing posts and upcoming scheduled content
- **Analytics** — profile visits, link clicks and saves; a multi-platform follower growth chart with toggleable series; format performance donut and engagement bars
- **Content library** — filter by status or search across your posts, with per-platform badges, engagement metrics and scheduling info
- **Composer** — plan a post for any platform, set a format, caption and publish time, or save it as a draft; everything persists in `localStorage`
- **Audience** — age and gender breakdown, top locations and an interactive "best time to post" heatmap
- **Time ranges** — 7, 30 or 90 day views that drive the KPIs and charts
- **Responsive** — sidebar collapses into a mobile tab bar; reduced-motion support

## How it works

All analytics data is **fictional and generated deterministically** from seeded pseudo-random numbers, so the dashboard always renders the same trends. Charts are hand-built SVG: scales, grid lines, area fills, crosshair and tooltips are drawn and animated in plain JavaScript.

Content you create in the composer is stored in `localStorage` (`orbit-posts-v1`) alongside the seeded posts. User-authored text is rendered with `textContent`, so nothing is injected as HTML.

## Tech

HTML5 · CSS3 · Vanilla JavaScript (ES2020) · SVG · localStorage

## Run locally

```bash
python -m http.server 8000
```

Then open http://localhost:8000

## License

MIT — see [LICENSE](LICENSE).
