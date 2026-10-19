(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* ignore */
      }
    },
  };

  const DAY = 86400000;
  const POSTS_KEY = "orbit-posts-v1";
  const TIP_KEY = "orbit-tip-dismissed-v1";

  const PLATFORMS = {
    instagram: { name: "Instagram", short: "IG", color: "#e1306c", chart: "#ff6f9f", followers: 48320 },
    tiktok: { name: "TikTok", short: "TT", color: "#25f4ee", chart: "#25f4ee", followers: 33820 },
    x: { name: "X", short: "X", color: "#e7e9ea", chart: "#c9d0db", followers: 21470 },
    linkedin: { name: "LinkedIn", short: "in", color: "#4e9bff", chart: "#4e9bff", followers: 9200 },
  };
  const TOTAL_FOLLOWERS = Object.values(PLATFORMS).reduce((sum, p) => sum + p.followers, 0);
  const RANGE_GROWTH = { 7: 0.24, 30: 1, 90: 2.85 };
  const GROWTH_30 = { instagram: 1180, tiktok: 1650, x: 560, linkedin: 450 };
  const REACH_30 = { 7: 324000, 30: 1240000, 90: 3420000 };
  const FORMAT_ICONS = { Reel: "🎬", Carousel: "📸", Static: "🖼️", Story: "⚡", Thread: "🧵", Text: "✍️" };
  const VIEW_TITLES = { overview: "Overview", analytics: "Analytics", content: "Content", audience: "Audience" };

  const state = {
    range: 30,
    metric: "followers",
    platform: "all",
    view: "overview",
    status: "all",
    query: "",
    hiddenPlatforms: new Set(),
  };

  /* ================= Helpers ================= */
  const fmtCompact = (n) => {
    if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
    if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
    return String(Math.round(n));
  };
  const fmtInt = (n) => Math.round(n).toLocaleString("en-US");
  const fmtDate = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const fmtDateTime = (d) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  const hash = (str) => {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };
  const mulberry32 = (a) => () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const toLocalInput = (date) => {
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const publishedInRange = () =>
    posts.filter((p) => p.status === "published" && p.date && Date.now() - Date.parse(p.date) <= state.range * DAY).length;

  /* ================= Seed data ================= */
  function seedPosts() {
    const daysAgo = (n) => new Date(Date.now() - n * DAY).toISOString();
    const inDays = (n, hour) => {
      const d = new Date(Date.now() + n * DAY);
      d.setHours(hour, 0, 0, 0);
      return d.toISOString();
    };
    return [
      { id: "p1", title: "5 editing tricks that saved me 3 hours", platform: "tiktok", format: "Reel", status: "published", date: daysAgo(1), reach: 96400, likes: 8420, comments: 312, saves: 1280, eng: 8.7, thumb: "🎬", grad: 1, caption: "Number three is the one nobody talks about." },
      { id: "p2", title: "A realistic week in my studio", platform: "instagram", format: "Carousel", status: "published", date: daysAgo(2), reach: 78100, likes: 5210, comments: 184, saves: 2140, eng: 7.3, thumb: "📸", grad: 2, caption: "No filter, just the messy middle." },
      { id: "p3", title: "The one tool I can't live without", platform: "linkedin", format: "Text", status: "published", date: daysAgo(3), reach: 42600, likes: 2110, comments: 266, saves: 540, eng: 6.8, thumb: "💡", grad: 3, caption: "" },
      { id: "p4", title: "Studio reset: every drawer, every cable", platform: "instagram", format: "Reel", status: "published", date: daysAgo(5), reach: 118900, likes: 9130, comments: 402, saves: 3020, eng: 6.5, thumb: "🧹", grad: 4, caption: "Satisfying, honestly." },
      { id: "p5", title: "3 lighting setups under $100", platform: "tiktok", format: "Reel", status: "published", date: daysAgo(8), reach: 142300, likes: 11200, comments: 517, saves: 4610, eng: 9.1, thumb: "💡", grad: 3, caption: "Budget gear, pro look." },
      { id: "p6", title: "Why I stopped chasing every trend", platform: "x", format: "Thread", status: "published", date: daysAgo(12), reach: 38900, likes: 1960, comments: 143, saves: 320, eng: 5.6, thumb: "🧵", grad: 5, caption: "" },
      { id: "p7", title: "My honest 2026 creator toolkit", platform: "linkedin", format: "Text", status: "published", date: daysAgo(18), reach: 33700, likes: 1480, comments: 198, saves: 410, eng: 5.1, thumb: "🧰", grad: 1, caption: "" },
      { id: "p8", title: "Bloopers: 47 takes for one line", platform: "instagram", format: "Static", status: "published", date: daysAgo(26), reach: 62400, likes: 4080, comments: 229, saves: 870, eng: 4.7, thumb: "😂", grad: 2, caption: "" },
      { id: "s1", title: "Behind the scenes: studio reset", platform: "instagram", format: "Reel", status: "scheduled", date: inDays(1, 18), caption: "The calm before the shoot.", thumb: "🎬", grad: 3 },
      { id: "s2", title: "My camera bag, honestly reviewed", platform: "tiktok", format: "Reel", status: "scheduled", date: inDays(3, 17), caption: "", thumb: "📷", grad: 5 },
      { id: "d1", title: "Q&A: how I price brand deals", platform: "x", format: "Thread", status: "draft", date: null, caption: "Draft notes: usage rights, exclusivity, timeline…", thumb: "✍️", grad: 4 },
    ];
  }

  let posts = store.get(POSTS_KEY, null);
  if (!Array.isArray(posts)) posts = seedPosts();
  posts = posts.filter(
    (p) => p && typeof p.title === "string" && PLATFORMS[p.platform] && ["published", "scheduled", "draft"].includes(p.status)
  );

  const savePosts = () => store.set(POSTS_KEY, posts);

  /* ================= Series generators ================= */
  const dateList = (days) => Array.from({ length: days }, (_, i) => new Date(Date.now() - (days - 1 - i) * DAY));

  function followersSeries(platformKey, days) {
    const end = platformKey === "all" ? TOTAL_FOLLOWERS : PLATFORMS[platformKey].followers;
    const base = platformKey === "all" ? 3840 : GROWTH_30[platformKey];
    const delta = base * RANGE_GROWTH[days];
    const start = end - delta;
    const rnd = mulberry32(hash(`followers-${platformKey}-${days}`));
    const values = [];
    let wobble = 0;
    for (let i = 0; i < days; i++) {
      wobble += (rnd() - 0.55) * (delta / days) * 0.4;
      values.push(start + (delta * i) / (days - 1) + wobble);
    }
    values[0] = start;
    values[values.length - 1] = end;
    return values;
  }

  function dailySeries(metric, platformKey, days) {
    const share = platformKey === "all" ? 1 : PLATFORMS[platformKey].followers / TOTAL_FOLLOWERS;
    const base = (REACH_30[days] * share) / days;
    const weekday = [0.92, 1.06, 1.0, 1.1, 1.04, 0.95, 0.9];
    const rnd = mulberry32(hash(`${metric}-${platformKey}-${days}`));
    return dateList(days).map((date) => {
      const reach = base * weekday[date.getDay()] * (0.84 + rnd() * 0.3);
      return metric === "reach" ? reach : reach * (0.043 + rnd() * 0.012);
    });
  }

  /* ================= KPIs ================= */
  function sparkSvg(seed, color) {
    const rnd = mulberry32(hash(seed));
    const arr = [];
    let v = 8 + rnd() * 5;
    for (let i = 0; i < 12; i++) {
      v += 1.1 + (rnd() - 0.5) * 2.4;
      arr.push(v);
    }
    const min = Math.min(...arr);
    const max = Math.max(...arr);
    const points = arr.map(
      (val, i) => `${((i * 84) / 11).toFixed(1)},${(30 - ((val - min) / (max - min || 1)) * 24).toFixed(1)}`
    );
    const area = `M0,34 L${points.join(" L")} L84,34 Z`;
    return `<svg viewBox="0 0 84 34" preserveAspectRatio="none" aria-hidden="true"><path d="${area}" fill="${color}" opacity="0.13"/><polyline points="${points.join(" ")}" fill="none" stroke="${color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  function renderKPIs() {
    const factor = {
      7: { growth: 0.9, eng: 5.1, engDelta: 0.5, reach: 324000, reachDelta: 12.4, postDelta: 1 },
      30: { growth: 3.5, eng: 4.8, engDelta: 0.6, reach: 1240000, reachDelta: 18.2, postDelta: 2 },
      90: { growth: 10.6, eng: 4.6, engDelta: 0.3, reach: 3420000, reachDelta: 9.1, postDelta: 6 },
    }[state.range];

    const data = [
      { label: "Total followers", value: fmtInt(TOTAL_FOLLOWERS), icon: "👥", delta: `↑ +${factor.growth}%`, note: `vs previous ${state.range} days`, color: "#8b7bff", seed: `followers-${state.range}` },
      { label: "Engagement rate", value: `${factor.eng.toFixed(1)}%`, icon: "❤️", delta: `↑ +${factor.engDelta.toFixed(1)} pts`, note: "vs previous period", color: "#ff6b8a", seed: `eng-${state.range}` },
      { label: "Reach", value: fmtCompact(factor.reach), icon: "📡", delta: `↑ +${factor.reachDelta}%`, note: "vs previous period", color: "#3dd6c8", seed: `reach-${state.range}` },
      { label: "Posts published", value: String(publishedInRange()), icon: "🗓️", delta: `↑ +${factor.postDelta}`, note: `in the last ${state.range} days`, color: "#ffb454", seed: `posts-${state.range}` },
    ];

    $("#kpis").innerHTML = data
      .map(
        (k) => `<article class="card kpi">
          <div class="kpi-top"><span class="kpi-label">${k.label}</span><span class="kpi-ico" aria-hidden="true">${k.icon}</span></div>
          <div class="kpi-value-row"><span class="kpi-value">${k.value}</span><span class="kpi-spark">${sparkSvg(k.seed, k.color)}</span></div>
          <div class="kpi-foot"><span class="delta up">${k.delta}</span><span>${k.note}</span></div>
        </article>`
      )
      .join("");
  }

  /* ================= Single chart ================= */
  const NS = "http://www.w3.org/2000/svg";
  const svgEl = (tag, attrs = {}) => {
    const n = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
    return n;
  };
  const svgText = (text, attrs = {}) => {
    const n = svgEl("text", attrs);
    n.textContent = text;
    return n;
  };

  function drawGrowthChart() {
    const svg = $("#growth-chart");
    const wrap = $("#chart-wrap");
    const tip = $("#chart-tip");
    if (!svg || !wrap) return;
    svg.textContent = "";
    tip.hidden = true;

    const days = state.range;
    const metric = state.metric;
    const platform = state.platform;
    const dates = dateList(days);
    const values =
      metric === "followers"
        ? followersSeries(platform, days)
        : dailySeries(metric, platform, days);
    const platformName = platform === "all" ? "all platforms" : PLATFORMS[platform].name;
    const metricName = metric === "followers" ? "Total followers" : metric === "reach" ? "Daily reach" : "Daily engagement";
    $("#chart-sub").textContent = `${metricName} · ${platformName} · last ${days} days`;

    const W = 720;
    const H = 268;
    const padL = 52;
    const padR = 16;
    const padT = 16;
    const padB = 30;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || Math.max(1, max * 0.03);
    const yMin = Math.max(0, min - span * 0.35);
    const yMax = max + span * 0.28;
    const xAt = (i) => padL + (days === 1 ? plotW / 2 : (i / (days - 1)) * plotW);
    const yAt = (v) => padT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;
    const points = values.map((v, i) => ({ x: xAt(i), y: yAt(v), v, date: dates[i] }));
    const color = platform === "all" ? "#7c6cff" : PLATFORMS[platform].chart;

    const defs = svgEl("defs");
    const grad = svgEl("linearGradient", { id: "growthFill", x1: "0", y1: "0", x2: "0", y2: "1" });
    grad.append(
      svgEl("stop", { offset: "0%", "stop-color": color, "stop-opacity": "0.32" }),
      svgEl("stop", { offset: "100%", "stop-color": color, "stop-opacity": "0" })
    );
    defs.append(grad);
    svg.append(defs);

    for (let t = 0; t <= 4; t++) {
      const gy = padT + (plotH * t) / 4;
      const val = yMax - ((yMax - yMin) * t) / 4;
      svg.append(svgEl("line", { class: "grid-line", x1: padL, y1: gy, x2: W - padR, y2: gy }));
      svg.append(svgText(fmtCompact(val), { class: "axis-label", x: padL - 8, y: gy + 4, "text-anchor": "end" }));
    }

    [0, 0.25, 0.5, 0.75, 1].forEach((f, idx) => {
      const i = Math.round((days - 1) * f);
      const anchor = idx === 0 ? "start" : idx === 4 ? "end" : "middle";
      svg.append(svgText(fmtDate(dates[i]), { class: "axis-label", x: xAt(i), y: H - 8, "text-anchor": anchor }));
    });

    const line = points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const area = `${line} L${points[points.length - 1].x.toFixed(1)},${padT + plotH} L${points[0].x.toFixed(1)},${padT + plotH} Z`;
    svg.append(svgEl("path", { d: area, fill: "url(#growthFill)" }));
    svg.append(
      svgEl("path", { d: line, fill: "none", stroke: color, "stroke-width": "2.4", "stroke-linecap": "round", "stroke-linejoin": "round" })
    );

    const crosshair = svgEl("line", {
      x1: 0, y1: padT, x2: 0, y2: padT + plotH,
      stroke: "rgba(255,255,255,0.22)", "stroke-width": "1", "stroke-dasharray": "4 4", opacity: "0",
    });
    const dot = svgEl("circle", { r: "4.5", fill: color, stroke: "#0b0e14", "stroke-width": "2", opacity: "0" });
    const overlay = svgEl("rect", { x: padL, y: padT, width: plotW, height: plotH, fill: "transparent" });
    svg.append(crosshair, dot, overlay);

    const positionTip = (px, py) => {
      const rect = svg.getBoundingClientRect();
      const wrapRect = wrap.getBoundingClientRect();
      const scale = Math.min(rect.width / W, rect.height / H);
      const ox = (rect.width - W * scale) / 2;
      const oy = (rect.height - H * scale) / 2;
      const left = rect.left - wrapRect.left + ox + px * scale;
      const top = rect.top - wrapRect.top + oy + py * scale;
      const tipH = tip.offsetHeight || 48;
      tip.style.left = `${clamp(left, 72, wrapRect.width - 72)}px`;
      tip.style.top = `${clamp(top, tipH + 20, wrapRect.height - 8)}px`;
    };

    overlay.addEventListener("pointermove", (ev) => {
      const rect = svg.getBoundingClientRect();
      const scale = Math.min(rect.width / W, rect.height / H);
      const ox = (rect.width - W * scale) / 2;
      const vx = (ev.clientX - rect.left - ox) / scale;
      const idx = clamp(Math.round(((vx - padL) / plotW) * (days - 1)), 0, days - 1);
      const p = points[idx];
      crosshair.setAttribute("x1", p.x);
      crosshair.setAttribute("x2", p.x);
      crosshair.setAttribute("opacity", "1");
      dot.setAttribute("cx", p.x);
      dot.setAttribute("cy", p.y);
      dot.setAttribute("opacity", "1");
      tip.hidden = false;
      $(".tip-date", tip).textContent = fmtDate(p.date);
      $(".tip-value", tip).textContent = `${fmtInt(p.v)} ${metric === "followers" ? "followers" : metric}`;
      positionTip(p.x, p.y);
    });

    overlay.addEventListener("pointerleave", () => {
      crosshair.setAttribute("opacity", "0");
      dot.setAttribute("opacity", "0");
      tip.hidden = true;
    });

    const first = fmtInt(values[0]);
    const last = fmtInt(values[values.length - 1]);
    svg.setAttribute("aria-label", `${metricName} for ${platformName} over the last ${days} days, from ${first} to ${last}.`);
  }

  /* ================= Multi chart ================= */
  function drawMultiChart() {
    const svg = $("#multi-chart");
    const wrap = $("#multi-wrap");
    const tip = $("#multi-tip");
    if (!svg || !wrap) return;
    svg.textContent = "";
    tip.hidden = true;

    const days = state.range;
    const dates = dateList(days);
    const all = Object.keys(PLATFORMS).map((key) => ({ key, values: followersSeries(key, days) }));
    const shown = all.filter((s) => !state.hiddenPlatforms.has(s.key));
    if (!shown.length) return;

    const W = 960;
    const H = 300;
    const padL = 54;
    const padR = 18;
    const padT = 18;
    const padB = 32;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const allValues = shown.flatMap((s) => s.values);
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const span = max - min || Math.max(1, max * 0.03);
    const yMin = Math.max(0, min - span * 0.25);
    const yMax = max + span * 0.18;
    const xAt = (i) => padL + (i / (days - 1)) * plotW;
    const yAt = (v) => padT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

    for (let t = 0; t <= 4; t++) {
      const gy = padT + (plotH * t) / 4;
      const val = yMax - ((yMax - yMin) * t) / 4;
      svg.append(svgEl("line", { class: "grid-line", x1: padL, y1: gy, x2: W - padR, y2: gy }));
      svg.append(svgText(fmtCompact(val), { class: "axis-label", x: padL - 8, y: gy + 4, "text-anchor": "end" }));
    }

    [0, 0.25, 0.5, 0.75, 1].forEach((f, idx) => {
      const i = Math.round((days - 1) * f);
      const anchor = idx === 0 ? "start" : idx === 4 ? "end" : "middle";
      svg.append(svgText(fmtDate(dates[i]), { class: "axis-label", x: xAt(i), y: H - 8, "text-anchor": anchor }));
    });

    shown.forEach((series) => {
      const color = PLATFORMS[series.key].chart;
      const d = series.values.map((v, i) => `${i ? "L" : "M"}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(" ");
      svg.append(
        svgEl("path", { d, fill: "none", stroke: color, "stroke-width": "2.2", "stroke-linecap": "round", "stroke-linejoin": "round" })
      );
    });

    const crosshair = svgEl("line", {
      x1: 0, y1: padT, x2: 0, y2: padT + plotH,
      stroke: "rgba(255,255,255,0.22)", "stroke-width": "1", "stroke-dasharray": "4 4", opacity: "0",
    });
    const dots = shown.map((s) =>
      svgEl("circle", { r: "4", fill: PLATFORMS[s.key].chart, stroke: "#0b0e14", "stroke-width": "2", opacity: "0" })
    );
    const overlay = svgEl("rect", { x: padL, y: padT, width: plotW, height: plotH, fill: "transparent" });
    svg.append(crosshair, ...dots, overlay);

    const rows = $(".tip-rows", tip);
    rows.textContent = "";
    shown.forEach((s) => {
      const row = el("span");
      const dotSwatch = el("i");
      dotSwatch.style.background = PLATFORMS[s.key].chart;
      row.append(dotSwatch, el("em", null, PLATFORMS[s.key].name), el("b", null, ""));
      rows.append(row);
    });
    tip.style.minWidth = "150px";

    overlay.addEventListener("pointermove", (ev) => {
      const rect = svg.getBoundingClientRect();
      const scale = Math.min(rect.width / W, rect.height / H);
      const ox = (rect.width - W * scale) / 2;
      const oy = (rect.height - H * scale) / 2;
      const vx = (ev.clientX - rect.left - ox) / scale;
      const idx = clamp(Math.round(((vx - padL) / plotW) * (days - 1)), 0, days - 1);
      const x = xAt(idx);
      crosshair.setAttribute("x1", x);
      crosshair.setAttribute("x2", x);
      crosshair.setAttribute("opacity", "1");
      let anchorY = padT + plotH;
      shown.forEach((s, i) => {
        const y = yAt(s.values[idx]);
        dots[i].setAttribute("cx", x);
        dots[i].setAttribute("cy", y);
        dots[i].setAttribute("opacity", "1");
        anchorY = Math.min(anchorY, y);
        $("b", rows.children[i]).textContent = fmtInt(s.values[idx]);
      });
      tip.hidden = false;
      $(".tip-date", tip).textContent = fmtDate(dates[idx]);
      const wrapRect = wrap.getBoundingClientRect();
      const left = rect.left - wrapRect.left + ox + x * scale;
      const top = rect.top - wrapRect.top + oy + anchorY * scale;
      const tipH = tip.offsetHeight || 92;
      tip.style.left = `${clamp(left, 90, wrapRect.width - 90)}px`;
      tip.style.top = `${clamp(top, tipH + 20, wrapRect.height - 8)}px`;
    });

    overlay.addEventListener("pointerleave", () => {
      crosshair.setAttribute("opacity", "0");
      dots.forEach((d) => d.setAttribute("opacity", "0"));
      tip.hidden = true;
    });

    svg.setAttribute("aria-label", `Follower growth by platform over the last ${days} days.`);
  }

  /* ================= Overview blocks ================= */
  function renderPlatformMix() {
    const wrap = $("#platform-bars");
    wrap.textContent = "";
    const entries = Object.entries(PLATFORMS).sort((a, b) => b[1].followers - a[1].followers);
    const top = entries[0][1].followers;

    entries.forEach(([key, p], i) => {
      const row = el("div");
      const head = el("div", "pbar-head");
      const badge = el("span", `pbadge ${key}`, p.short);
      const name = el("span", null, p.name);
      const count = el("b", null, fmtInt(p.followers));
      const pct = el("span", "pct", `${((p.followers / TOTAL_FOLLOWERS) * 100).toFixed(1)}%`);
      head.append(badge, name, count, pct);
      const track = el("div", "pbar-track");
      const fill = el("span");
      fill.style.background = p.chart;
      track.append(fill);
      row.append(head, track);
      wrap.append(row);
      const width = `${(p.followers / top) * 100}%`;
      requestAnimationFrame(() => {
        fill.style.width = width;
      });
      row.style.animation = `viewIn 0.3s ease ${i * 40}ms backwards`;
    });

    $("#mix-total").textContent = fmtInt(TOTAL_FOLLOWERS);
  }

  function renderTopPosts() {
    const body = $("#top-posts");
    body.textContent = "";
    const top = posts
      .filter((p) => p.status === "published")
      .sort((a, b) => (Number(b.eng) || 0) - (Number(a.eng) || 0))
      .slice(0, 4);

    if (!top.length) {
      const tr = el("tr");
      const td = el("td", "td-muted", "No published posts yet.");
      td.colSpan = 4;
      tr.append(td);
      body.append(tr);
      return;
    }

    top.forEach((p) => {
      const tr = el("tr");
      const postTd = el("td");
      const cell = el("div", "post-cell");
      const thumb = el("span", `thumb g${p.grad || 1}`, p.thumb || "📝");
      const meta = el("div");
      const title = el("div", "post-title", p.title);
      title.title = p.title;
      const sub = el("div", "post-meta", `${PLATFORMS[p.platform].name} · ${p.format}`);
      meta.append(title, sub);
      cell.append(thumb, meta);
      postTd.append(cell);

      const reach = el("td", "num td-muted hide-sm", fmtCompact(p.reach));
      const eng = el("td", "num");
      eng.append(el("span", "eng-pill", `${Number(p.eng).toFixed(1)}%`));
      const saves = el("td", "num td-muted hide-sm", fmtCompact(p.saves));

      tr.append(postTd, reach, eng, saves);
      body.append(tr);
    });
  }

  function renderUpcoming() {
    const wrap = $("#upcoming-list");
    wrap.textContent = "";
    const scheduled = posts
      .filter((p) => p.status === "scheduled" && p.date && !Number.isNaN(Date.parse(p.date)))
      .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
    $("#upcoming-count").textContent = String(scheduled.length);

    if (!scheduled.length) {
      wrap.append(el("p", "up-empty", "Nothing scheduled yet. Plan your next post to keep the streak alive."));
      return;
    }

    scheduled.slice(0, 4).forEach((p) => {
      const date = new Date(p.date);
      const item = el("div", "up-item");
      const tile = el("div", "date-tile");
      tile.append(el("b", null, String(date.getDate())), el("span", null, date.toLocaleDateString("en-US", { month: "short" })));
      const body = el("div", "up-body");
      const title = el("b", null, p.title);
      title.title = p.title;
      const meta = el("span");
      const badge = el("span", `pbadge ${p.platform}`, PLATFORMS[p.platform].short);
      badge.style.width = "17px";
      badge.style.height = "17px";
      badge.style.fontSize = "0.52rem";
      meta.append(badge, document.createTextNode(`${p.format} · ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`));
      body.append(title, meta);
      item.append(tile, body);
      wrap.append(item);
    });
  }

  function renderGoal() {
    const done = posts.filter(
      (p) => p.status === "published" && p.date && Date.now() - Date.parse(p.date) <= 30 * DAY
    ).length;
    $("#goal-done").textContent = String(done);
    $("#goal-bar").style.width = `${clamp((done / 15) * 100, 0, 100)}%`;
    $("#goal-note").textContent =
      done >= 15 ? "Goal complete — impressive pace." : `${15 - done} more to hit 15 this month.`;
  }

  /* ================= Content ================= */
  function statusLabel(status) {
    return status === "published" ? "Published" : status === "scheduled" ? "Scheduled" : "Draft";
  }

  function contentMeta(p) {
    if (p.status === "published" && p.date) return `Published ${fmtDate(p.date)}`;
    if (p.status === "scheduled" && p.date) return `Scheduled ${fmtDateTime(p.date)}`;
    return "Draft · not scheduled";
  }

  function renderContent() {
    const list = $("#content-list");
    const empty = $("#content-empty");
    list.textContent = "";

    const counts = { all: posts.length, published: 0, scheduled: 0, draft: 0 };
    posts.forEach((p) => {
      counts[p.status] = (counts[p.status] || 0) + 1;
    });
    $("#count-all").textContent = String(counts.all);
    $("#count-published").textContent = String(counts.published);
    $("#count-scheduled").textContent = String(counts.scheduled);
    $("#count-draft").textContent = String(counts.draft);

    const query = state.query.toLowerCase();
    const filtered = posts.filter((p) => {
      if (state.status !== "all" && p.status !== state.status) return false;
      if (!query) return true;
      return `${p.title} ${p.caption || ""} ${PLATFORMS[p.platform].name} ${p.format}`.toLowerCase().includes(query);
    });

    const order = { scheduled: 0, published: 1, draft: 2 };
    filtered.sort((a, b) => {
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      const da = a.date ? Date.parse(a.date) : 0;
      const db = b.date ? Date.parse(b.date) : 0;
      return a.status === "scheduled" ? da - db : db - da;
    });

    empty.hidden = filtered.length > 0;
    if (!filtered.length) {
      $("#content-empty h3").textContent = query ? "No matches" : "Nothing here yet";
      $("#content-empty p").textContent = query
        ? `No content matches “${state.query}”. Try another search.`
        : "Try a different filter or plan something new.";
      return;
    }

    filtered.forEach((p) => {
      const card = el("article", "card content-card");
      const top = el("div", "content-top");
      const badge = el("span", `pbadge ${p.platform}`, PLATFORMS[p.platform].short);
      top.append(badge, el("span", "muted", PLATFORMS[p.platform].name), el("span", `status ${p.status}`, statusLabel(p.status)));

      const title = el("h3", null, p.title);
      card.append(top, title);
      if (p.caption) card.append(el("p", "content-caption", p.caption));

      const meta = el("div", "content-meta");
      meta.append(el("span", null, `${p.format} · ${contentMeta(p)}`));
      card.append(meta);

      if (p.status === "published") {
        const metrics = el("div", "content-metrics");
        [
          ["Reach", fmtCompact(p.reach || 0)],
          ["Likes", fmtCompact(p.likes || 0)],
          ["Eng.", `${(Number(p.eng) || 0).toFixed(1)}%`],
        ].forEach(([label, value]) => {
          const chip = el("span", "metric-chip");
          chip.append(document.createTextNode(`${label} `), el("b", null, value));
          metrics.append(chip);
        });
        card.append(metrics);
      }

      const actions = el("div", "content-actions");
      let hint;
      if (p.status === "scheduled" && p.date) {
        const days = Math.ceil((Date.parse(p.date) - Date.now()) / DAY);
        hint = days <= 0 ? "Goes live today" : days === 1 ? "Goes live tomorrow" : `Goes live in ${days} days`;
      } else if (p.status === "draft") {
        hint = "Not scheduled yet";
      } else {
        hint = p.format;
      }
      const deleteBtn = el("button", "text-btn danger", "Delete");
      deleteBtn.type = "button";
      deleteBtn.dataset.delete = p.id;
      actions.append(el("span", "draft-hint", hint), deleteBtn);
      card.append(actions);
      list.append(card);
    });
  }

  function updateFormatTotal() {
    const count = posts.filter((p) => p.status === "published").length;
    const center = $(".format-donut .donut-center b");
    if (center) center.textContent = String(count);
  }

  function refreshAfterMutation() {
    savePosts();
    renderContent();
    renderTopPosts();
    renderUpcoming();
    renderGoal();
    renderKPIs();
    updateFormatTotal();
  }

  /* ================= Analytics ================= */
  function renderAnalyticsStats() {
    const map = {
      7: [["Profile visits", "4.6k", "+6.2%"], ["Link clicks", "810", "+11.8%"], ["Saves", "2.4k", "+4.1%"]],
      30: [["Profile visits", "18.4k", "+6.2%"], ["Link clicks", "3.1k", "+11.8%"], ["Saves", "9.6k", "+4.1%"]],
      90: [["Profile visits", "51.2k", "+8.9%"], ["Link clicks", "8.9k", "+14.3%"], ["Saves", "27.1k", "+7.6%"]],
    }[state.range];

    const wrap = $("#mini-stats");
    wrap.textContent = "";
    map.forEach(([label, value, delta]) => {
      const card = el("article", "card mini");
      const head = el("div", "mini-label");
      head.append(el("span", null, label), el("span", "delta up", delta));
      card.append(head, el("div", "mini-value", value), el("div", "mini-foot", `vs previous ${state.range} days`));
      wrap.append(card);
    });
  }

  function initAnalyticsLegend() {
    const legend = $("#growth-legend");
    legend.textContent = "";
    Object.entries(PLATFORMS).forEach(([key, p]) => {
      const btn = el("button");
      btn.type = "button";
      btn.dataset.platform = key;
      const swatch = el("i");
      swatch.style.setProperty("--c", p.chart);
      btn.append(swatch, document.createTextNode(p.name));
      legend.append(btn);
    });

    legend.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-platform]");
      if (!btn) return;
      const key = btn.dataset.platform;
      if (state.hiddenPlatforms.has(key)) {
        state.hiddenPlatforms.delete(key);
      } else {
        if (Object.keys(PLATFORMS).length - state.hiddenPlatforms.size <= 1) return;
        state.hiddenPlatforms.add(key);
      }
      btn.classList.toggle("off", state.hiddenPlatforms.has(key));
      drawMultiChart();
    });
  }

  function initFormatBlocks() {
    const legend = $("#format-legend");
    const formats = [
      ["Reels", 42, "#7c6cff"],
      ["Carousels", 28, "#3dd6c8"],
      ["Static", 18, "#ffb454"],
      ["Stories", 12, "#ff6b8a"],
    ];
    formats.forEach(([label, pct, color]) => {
      const li = el("li");
      const swatch = el("span", "swatch");
      swatch.style.setProperty("--c", color);
      li.append(swatch, el("span", "leg-label", label), el("b", null, `${pct}%`));
      legend.append(li);
    });

    const bars = $("#format-bars");
    [
      ["Reels", 8.4, "#7c6cff"],
      ["Carousels", 7.1, "#3dd6c8"],
      ["Threads", 6.3, "#ffb454"],
      ["Static", 5.2, "#ff6b8a"],
    ].forEach(([label, value, color]) => {
      const row = el("div");
      const head = el("div", "hbar-head");
      head.append(el("span", null, label), el("b", null, `${value.toFixed(1)}%`));
      const track = el("div", "hbar-track");
      const fill = el("span");
      fill.style.background = color;
      fill.style.setProperty("--c", color);
      track.append(fill);
      row.append(head, track);
      bars.append(row);
      requestAnimationFrame(() => {
        fill.style.width = `${value * 10}%`;
      });
    });
  }

  /* ================= Audience ================= */
  function renderAudience() {
    const stats = $("#audience-stats");
    stats.textContent = "";
    [
      ["Total followers", fmtInt(TOTAL_FOLLOWERS), "+3,840 this month"],
      ["Average age", "29.4", "Core audience: 18–24"],
      ["Top location", "United States", "34% of your audience"],
    ].forEach(([label, value, foot]) => {
      const card = el("article", "card mini");
      const head = el("div", "mini-label");
      head.append(el("span", null, label));
      const v = el("div", "mini-value", value);
      if (value === "United States") v.style.fontSize = "1.12rem";
      card.append(head, v, el("div", "mini-foot", foot));
      stats.append(card);
    });

    const locs = $("#location-bars");
    locs.textContent = "";
    [
      ["🇺🇸 United States", 34, "#7c6cff"],
      ["🇬🇧 United Kingdom", 17, "#3dd6c8"],
      ["🇮🇳 India", 14, "#ffb454"],
      ["🇩🇪 Germany", 9, "#ff6b8a"],
      ["🇧🇷 Brazil", 7, "#4e9bff"],
    ].forEach(([label, pct, color]) => {
      const row = el("div");
      const head = el("div", "hbar-head");
      head.append(el("span", null, label), el("b", null, `${pct}%`));
      const track = el("div", "hbar-track");
      const fill = el("span");
      fill.style.background = color;
      track.append(fill);
      row.append(head, track);
      locs.append(row);
      requestAnimationFrame(() => {
        fill.style.width = `${(pct / 34) * 100}%`;
      });
    });

    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const hours = ["6a", "8a", "10a", "12p", "2p", "4p", "6p", "8p"];
    const rnd = mulberry32(hash("orbit-heatmap"));
    const grid = $("#heatmap");
    grid.textContent = "";
    grid.append(el("div", "heat-label"));
    hours.forEach((h) => grid.append(el("div", "heat-label", h)));

    days.forEach((day) => {
      grid.append(el("div", "heat-label day", day));
      hours.forEach((hour, hi) => {
        const base = 0.24 + Math.sin(((hi + 1) / 9) * Math.PI) * 0.44;
        let v = base + (rnd() - 0.5) * 0.24;
        if ((day === "Tue" || day === "Thu") && (hour === "6p" || hour === "8p")) v += 0.34;
        if (day === "Sat" || day === "Sun") v -= 0.1;
        v = clamp(v, 0.05, 1);
        const cell = el("div", "heat-cell");
        cell.style.setProperty("--a", (0.06 + v * 0.9).toFixed(2));
        cell.title = `${day} ${hour} · ${Math.round(v * 100)} engagement score`;
        grid.append(cell);
      });
    });
  }

  /* ================= Composer ================= */
  const composer = $("#composer");
  const form = $("#composer-form");
  const formError = $("#form-error");

  function showFormError(message) {
    formError.textContent = message;
    formError.hidden = false;
  }

  function openComposer() {
    form.reset();
    formError.hidden = true;
    $("#caption-count").textContent = "0";
    $("#when-field").hidden = false;
    const tomorrow = new Date(Date.now() + DAY);
    tomorrow.setHours(18, 0, 0, 0);
    $("#post-when").value = toLocalInput(tomorrow);
    composer.hidden = false;
    document.body.style.overflow = "hidden";
    setTimeout(() => $("#post-title").focus(), 40);
  }

  function closeComposer() {
    composer.hidden = true;
    document.body.style.overflow = "";
    $("#new-post-btn").focus();
  }

  $("#new-post-btn").addEventListener("click", openComposer);
  $$("[data-new-post]").forEach((b) => b.addEventListener("click", openComposer));
  $("#close-composer").addEventListener("click", closeComposer);
  $("#cancel-composer").addEventListener("click", closeComposer);
  $$("[data-close-composer]").forEach((n) => n.addEventListener("click", closeComposer));

  $("#post-caption").addEventListener("input", () => {
    $("#caption-count").textContent = String($("#post-caption").value.length);
  });

  $("#post-status").addEventListener("change", () => {
    $("#when-field").hidden = $("#post-status").value === "draft";
  });

  form.addEventListener("input", () => {
    formError.hidden = true;
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const title = $("#post-title").value.trim();
    if (!title) {
      showFormError("Give your post a title so you can find it later.");
      $("#post-title").focus();
      return;
    }

    const status = $("#post-status").value;
    let date = null;
    if (status === "scheduled") {
      const when = $("#post-when").value;
      if (!when) {
        showFormError("Pick a publish date and time.");
        return;
      }
      const parsed = new Date(when);
      if (Number.isNaN(parsed.getTime())) {
        showFormError("That date doesn't look right — try again.");
        return;
      }
      date = parsed.toISOString();
    }

    const platform = $("#post-platform").value;
    const format = $("#post-format").value;
    const id = `c${Date.now()}`;
    posts.unshift({
      id,
      title,
      platform,
      format,
      status,
      date,
      caption: $("#post-caption").value.trim(),
      thumb: FORMAT_ICONS[format] || "📝",
      grad: (hash(id) % 5) + 1,
    });

    refreshAfterMutation();
    closeComposer();
    toast(status === "scheduled" ? "Scheduled — it's on the calendar." : "Draft saved.");
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !composer.hidden) closeComposer();
  });

  /* ================= Interactions ================= */
  function toast(message) {
    const t = $("#toast");
    t.textContent = message;
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => {
      t.hidden = true;
    }, 2400);
  }

  function showView(name) {
    state.view = name;
    $$(".nav-link").forEach((btn) => {
      const active = btn.dataset.view === name;
      btn.classList.toggle("active", active);
      if (active) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    });
    $$(".view").forEach((view) => view.classList.toggle("active", view.dataset.view === name));
    $("#page-title").textContent = VIEW_TITLES[name];
    window.scrollTo(0, 0);
  }

  $$(".nav-link").forEach((btn) => btn.addEventListener("click", () => showView(btn.dataset.view)));
  $$("[data-jump]").forEach((btn) => btn.addEventListener("click", () => showView(btn.dataset.jump)));

  $$(".seg button").forEach((btn) =>
    btn.addEventListener("click", () => {
      state.range = Number(btn.dataset.range);
      $$(".seg button").forEach((b) => b.classList.toggle("active", b === btn));
      renderKPIs();
      drawGrowthChart();
      drawMultiChart();
      renderAnalyticsStats();
    })
  );

  $("#metric-chips").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-metric]");
    if (!btn) return;
    state.metric = btn.dataset.metric;
    $$("#metric-chips .chip").forEach((b) => b.classList.toggle("active", b === btn));
    drawGrowthChart();
  });

  $("#chart-platforms").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-platform]");
    if (!btn) return;
    state.platform = btn.dataset.platform;
    $$("#chart-platforms .pchip").forEach((b) => b.classList.toggle("active", b === btn));
    drawGrowthChart();
  });

  $("#status-tabs").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-status]");
    if (!btn) return;
    state.status = btn.dataset.status;
    $$("#status-tabs .tab").forEach((b) => {
      const active = b === btn;
      b.classList.toggle("active", active);
      b.setAttribute("aria-selected", String(active));
    });
    renderContent();
  });

  $("#content-search").addEventListener("input", (e) => {
    state.query = e.target.value.trim();
    renderContent();
  });

  $("#content-list").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-delete]");
    if (!btn) return;
    const id = btn.dataset.delete;
    const post = posts.find((p) => p.id === id);
    posts = posts.filter((p) => p.id !== id);
    refreshAfterMutation();
    toast(post ? `Deleted “${post.title}”.` : "Post deleted.");
  });

  $("#dismiss-insight").addEventListener("click", () => {
    store.set(TIP_KEY, true);
    $("#insight").hidden = true;
  });

  /* ================= Init ================= */
  $("#today-label").textContent = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  if (store.get(TIP_KEY, false)) $("#insight").hidden = true;

  renderKPIs();
  drawGrowthChart();
  renderPlatformMix();
  renderTopPosts();
  renderUpcoming();
  renderGoal();
  renderContent();
  updateFormatTotal();
  renderAnalyticsStats();
  initAnalyticsLegend();
  initFormatBlocks();
  drawMultiChart();
  renderAudience();
})();
