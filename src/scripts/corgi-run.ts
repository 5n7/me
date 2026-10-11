import type { Course, CourseIcon, CourseItem, CourseRole } from "../lib/course.ts";
import { langOf } from "../lib/lang.ts";
import { isExternal } from "../lib/link.ts";

type RunState = "title" | "play" | "paused" | "goal";
type Pose = "stand" | "run" | "air" | "sit";
type Point = [number, number];

interface PlacedItem extends CourseItem {
  m: number;
  x: number;
  y: number;
}
interface Stage extends CourseRole {
  m: number;
  x: number;
}
interface Lane extends CourseRole {
  lane: number;
  y: number;
  x1: number;
  x2: number;
  segments: [number, number][];
}
interface Obstacle {
  x: number;
  type: "bug" | "cone";
  phase: number;
}
type SkyKind = "house" | "tree" | "tower" | "antenna" | "tokyo-tower" | "skytree";
interface SkyShape {
  kind: SkyKind;
  x: number;
  w: number;
  h: number;
  windows?: boolean;
}
interface Float {
  x: number;
  y: number;
  text: string;
  t: number;
  tone: "link" | "muted";
}
interface Ring {
  x: number;
  y: number;
  t: number;
}
interface Dust {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  life: number;
  r: number;
}
interface RunRecord {
  best?: number;
  last?: string[];
}

const TOKENS = [
  "background",
  "text",
  "muted",
  "line",
  "link",
  "selection",
  "font",
  "corgi-ink",
  "corgi-coat",
  "corgi-shade",
  "corgi-cream",
  "corgi-tongue",
] as const;
type Tokens = Record<(typeof TOKENS)[number], string>;

const STORAGE_KEY = "corgi-run";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const H = 200;
const GROUND = 158;
const START = 200;
const PX_SCHOOL = 20;
const PX_WORK = 46;
const CORGI_START = 64;
const LANE_Y = [GROUND - 42, GROUND - 80];
const LANE_SOLID = 300;
const LANE_GAP = 64;

const PF_FAR = 0.3;
const PF_MID = 0.62;
const POLE_GAP = 172;

const GRAVITY = 1700;
const JUMP_VY = -560;
const SHORT_HOP_VY = -230;
const JUMP_KEYS = ["Space", "ArrowUp", "KeyW"];

const byId = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Corgi Run: missing #${id}`);
  return el as T;
};
const context2d = (canvas: HTMLCanvasElement): CanvasRenderingContext2D => {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Corgi Run: canvas 2D is unavailable");
  return ctx;
};
const monthIndex = (s: string): number => {
  const [mon = "", yr = ""] = s.split(" ");
  return (Number(yr) - 2016) * 12 + MONTHS.indexOf(mon) - 3;
};
const formatMonth = (m: number): string => {
  const mm = Math.floor(m) + 3;
  return `${MONTHS[mm % 12]} ${2016 + Math.floor(mm / 12)}`;
};
const formatTime = (t: number): string =>
  `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;
const shortOrg = (org: string): string => org.replace(/, Inc\.$/, "");
const rotAbout = (px: number, py: number, ox: number, oy: number, a: number): Point => {
  const s = Math.sin(a);
  const c = Math.cos(a);
  return [ox + (px - ox) * c - (py - oy) * s, oy + (px - ox) * s + (py - oy) * c];
};
const overlap = (
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const loadRecord = (): RunRecord => {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    if (typeof value !== "object" || value === null) return {};
    const { best, last } = value as Record<string, unknown>;
    return {
      best: typeof best === "number" ? best : undefined,
      last: Array.isArray(last) ? last.filter((id) => typeof id === "string") : undefined,
    };
  } catch {
    return {};
  }
};
const saveRecordIfStorageAllows = (record: RunRecord): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // The game also works when storage is unavailable; progress is just not kept.
  }
};

export function startCorgiRun(): void {
  byId("run").hidden = false;
  const course = JSON.parse(byId("run-course").textContent ?? "") as Course;
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const today = new Date();
  const latest = Math.max(
    ...course.items.map((item) => monthIndex(item.month)),
    ...course.roles.map((role) => monthIndex(role.start)),
  );
  const NOW_M = Math.max(latest, monthIndex(`${MONTHS[today.getMonth()]} ${today.getFullYear()}`));
  const YEARS = Array.from({ length: Math.floor((NOW_M + 3) / 12) }, (_, i) => 2017 + i);
  const WORK_M = Math.min(
    ...course.roles
      .filter((role) => role.track !== "education")
      .map((role) => monthIndex(role.start)),
  );
  const xAt = (m: number): number =>
    START + (m < WORK_M ? m * PX_SCHOOL : WORK_M * PX_SCHOOL + (m - WORK_M) * PX_WORK);
  const mAt = (x: number): number => {
    const r = x - START;
    return r < WORK_M * PX_SCHOOL ? r / PX_SCHOOL : WORK_M + (r - WORK_M * PX_SCHOOL) / PX_WORK;
  };
  const clampM = (m: number): number => Math.max(0, Math.min(NOW_M, m));
  const GOAL_X = xAt(NOW_M) + 90;
  const END_X = GOAL_X + 150;

  const perMonth = new Map<number, number>();
  const items: PlacedItem[] = course.items
    .map((item) => ({ ...item, m: monthIndex(item.month) }))
    .sort((a, b) => a.m - b.m)
    .map((item, i) => {
      const k = (perMonth.get(item.m) ?? 0) + 1;
      perMonth.set(item.m, k);
      return {
        ...item,
        x: xAt(item.m) + 12 + (k - 1) * 30,
        y: i % 3 === 1 ? GROUND - 60 : GROUND - 14,
      };
    });
  const itemById = new Map(items.map((item) => [item.id, item]));
  const TOTAL = items.length;

  const stages: Stage[] = course.roles
    .filter((role) => role.track !== "side")
    .map((role) => ({ ...role, m: monthIndex(role.start), x: xAt(monthIndex(role.start)) }))
    .sort((a, b) => a.m - b.m);
  const sideRoles = course.roles.filter((role) => role.track === "side");
  const sideOrgs = [
    ...new Set(
      [...sideRoles]
        .sort((a, b) => monthIndex(a.start) - monthIndex(b.start))
        .map((role) => role.org),
    ),
  ];
  const lanes: Lane[] = sideRoles.map((role) => {
    const m = monthIndex(role.start);
    const lane = sideOrgs.indexOf(role.org) % 2;
    const nextStarts = sideRoles
      .filter((other) => other.org === role.org && monthIndex(other.start) > m)
      .map((other) => xAt(monthIndex(other.start)));
    const x2 = role.end ? Math.min(xAt(monthIndex(role.end) + 1), ...nextStarts) - 3 : GOAL_X - 20;
    const x1 = xAt(m) + 3;
    // Gaps drop the corgi back to the road, so pickups under a lane stay reachable.
    const segments: [number, number][] = [];
    for (let from = x1; from < x2; from += LANE_SOLID + LANE_GAP) {
      segments.push([from, Math.min(x2, from + LANE_SOLID)]);
    }
    return { ...role, lane, y: LANE_Y[lane] ?? GROUND, x1, x2, segments };
  });

  const obstacles: Obstacle[] = [];
  {
    const rng = mulberry32(57);
    for (let x = xAt(6); x < GOAL_X - 150; x += 250 + Math.floor(rng() * 220)) {
      if (items.some((item) => Math.abs(item.x - x) < 60)) continue;
      if (stages.some((stage) => Math.abs(stage.x - x) < 34)) continue;
      obstacles.push({
        x,
        type: mAt(x) >= WORK_M && rng() < 0.4 ? "cone" : "bug",
        phase: rng() * 6.28,
      });
    }
  }

  const farX = (worldX: number): number => worldX * PF_FAR + 220 * (1 - PF_FAR);
  const sky: SkyShape[] = [];
  {
    const rng = mulberry32(11);
    const towerX = farX(xAt(monthIndex("Oct 2023")));
    const skytreeX = farX(xAt(monthIndex("Apr 2026")));
    for (let lx = -60; lx < END_X * PF_FAR + 1400;) {
      if (Math.abs(lx - towerX) < 34 || Math.abs(lx - skytreeX) < 22) {
        lx += 8;
        continue;
      }
      const world = (lx - 220 * (1 - PF_FAR)) / PF_FAR;
      const city = world > xAt(WORK_M) - 260;
      let shape: SkyShape;
      if (city) {
        const grow = Math.max(0, Math.min(1, (world - xAt(WORK_M)) / 2200));
        shape = {
          kind: rng() < 0.22 ? "antenna" : "tower",
          x: lx,
          w: 14 + rng() * 20,
          h: 26 + rng() * (24 + 36 * grow),
          windows: rng() < 0.55,
        };
      } else {
        shape =
          rng() < 0.35
            ? { kind: "tree", x: lx, w: 12, h: 18 + rng() * 6 }
            : { kind: "house", x: lx, w: 16 + rng() * 10, h: 11 + rng() * 8 };
      }
      sky.push(shape);
      lx += shape.w + 3 + rng() * (city ? 6 : 14);
    }
    sky.push(
      { kind: "tokyo-tower", x: towerX, w: 34, h: 104 },
      { kind: "skytree", x: skytreeX, w: 18, h: 128 },
    );
  }

  const T = {} as Tokens;
  const readTokens = (): void => {
    const cs = getComputedStyle(root);
    for (const key of TOKENS) T[key] = cs.getPropertyValue(`--${key}`).trim();
  };
  readTokens();
  const refreshTheme = (): void => {
    readTokens();
    wake();
  };
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", refreshTheme);
  new MutationObserver(refreshTheme).observe(root, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  const font = (size: number, weight = 400): string => `${weight} ${size}px ${T.font}`;

  const stageEl = byId<HTMLDivElement>("run-stage");
  const gameCanvas = byId<HTMLCanvasElement>("run-game");
  const trackCanvas = byId<HTMLCanvasElement>("run-track");
  const g = context2d(gameCanvas);
  const tg = context2d(trackCanvas);
  const mainButton = byId<HTMLButtonElement>("run-main");
  const resetButton = byId<HTMLButtonElement>("run-reset");
  const pickupEl = byId("run-pickup");
  const countEl = byId("run-count");
  const dateEl = byId("run-date");
  const roleEl = byId("run-role");
  const timeEl = byId("run-time");
  const announceEl = byId("run-announce");
  const cards = {
    title: byId("run-card-title"),
    pause: byId("run-card-pause"),
    end: byId("run-card-end"),
  };
  const avatarImage = document.querySelector<HTMLElement>(".avatar .corgi-image");

  const entries = new Map<string, HTMLElement>();
  document.querySelectorAll<HTMLElement>("[data-run-id]").forEach((el) => {
    if (el.dataset.runId) entries.set(el.dataset.runId, el);
  });
  const markEntry = (id: string, on: boolean, flash = false): void => {
    const el = entries.get(id);
    if (!el) return;
    let mark = el.querySelector<HTMLElement>(".run-mark");
    if (!mark && on) {
      mark = document.createElement("span");
      mark.className = "run-mark";
      mark.textContent = "Collected";
      (el.querySelector(".entry-details") ?? el).append(mark);
    }
    if (mark) mark.hidden = !on;
    if (on && flash && !reduceMotion) {
      el.classList.add("run-flash");
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove("run-flash")));
    }
  };

  let record = loadRecord();
  let state: RunState = "title";
  let collected = new Set<string>();
  let bumps = 0;
  let runT = 0;
  let skipped = false;
  const REST = {
    x: CORGI_START,
    y: GROUND,
    vy: 0,
    onGround: true,
    slow: 0,
    inv: 0,
    coyote: 0,
    buffer: 0,
    holding: false,
    squash: 0,
  };
  const c = { ...REST, phase: 0, dustT: 0 };
  let freeze = 0;
  let goalT = 0;
  let clock = 0;
  let blinkT = 2.5;
  let cam = 0;
  let camTarget = 0;
  let follow = true;
  let hoverId: string | null = null;
  let seekId: string | null = null;
  let drag: { id: number; x: number; cam0: number; moved: boolean } | null = null;
  let trackDrag: number | null = null;
  const floats: Float[] = [];
  const rings: Ring[] = [];
  const dust: Dust[] = [];
  let viewW = 600;
  let trackW = 600;

  const clampCam = (x: number): number => Math.max(0, Math.min(Math.max(0, END_X - viewW), x));
  const show = (el: HTMLElement, on: boolean): void => {
    el.hidden = !on;
  };
  const setCount = (n: number): void => {
    countEl.textContent = `${n} / ${TOTAL}`;
    countEl.classList.toggle("done", n === TOTAL);
  };
  const showRecord = (): void => {
    byId("run-best").textContent = record.best ? `Best ${formatTime(record.best)}` : "";
    resetButton.hidden = !(record.best || record.last?.length);
  };

  const setText = (el: HTMLElement, text: string): void => {
    if (el.textContent !== text) el.textContent = text;
  };
  const updateHud = (): void => {
    const m = clampM(mAt(c.x + 26));
    setText(dateEl, c.x >= GOAL_X - 50 ? "Now" : formatMonth(m));
    let current = stages[0];
    for (const stage of stages) if (m >= stage.m) current = stage;
    const sides = lanes
      .filter((l) => c.x + 26 >= l.x1 && c.x + 26 <= l.x2)
      .map((l) => shortOrg(l.org));
    const label = current
      ? `${current.role} · ${shortOrg(current.org)}${sides.length ? `  +  ${sides.join(", ")}` : ""}`
      : "";
    setText(roleEl, label);
    setText(timeEl, formatTime(runT));
  };

  const pickupLine = (prefix: string, item: PlacedItem): void => {
    const kind = document.createElement("span");
    kind.className = "run-pickup-kind";
    kind.textContent = `${prefix}${item.kind} · ${item.date} `;
    const title = document.createElement(item.href ? "a" : "span");
    title.className = "run-pickup-title";
    title.textContent = item.title;
    title.lang = langOf(item.title) ?? "en";
    if (title instanceof HTMLAnchorElement && item.href) {
      title.href = item.href;
      if (isExternal(item.href)) {
        title.target = "_blank";
        title.rel = "noopener";
      }
    }
    const meta = document.createElement("span");
    meta.textContent = ` ${item.meta.join(" · ")}`;
    const metaLang = langOf(meta.textContent);
    if (metaLang) meta.lang = metaLang;
    pickupEl.replaceChildren(kind, title, meta);
  };

  const MAIN_LABEL: Record<RunState, string> = {
    title: "Start",
    play: "Pause",
    paused: "Resume",
    goal: "Run again",
  };
  function enter(next: RunState): void {
    state = next;
    stageEl.classList.toggle("in-run", next !== "title");
    mainButton.textContent = MAIN_LABEL[next];
    show(cards.pause, next === "paused");
  }
  function resetCollected(): void {
    collected = new Set();
    for (const item of items) markEntry(item.id, false);
    setCount(0);
  }
  function start(): void {
    if (state !== "title") return;
    resetCollected();
    bumps = 0;
    runT = 0;
    skipped = false;
    enter("play");
    follow = true;
    setHover(null);
    seekId = null;
    show(cards.title, false);
    c.vy = reduceMotion ? 0 : -260;
    c.onGround = reduceMotion;
    if (!reduceMotion) {
      avatarImage?.animate([{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }], {
        duration: 800,
        easing: "ease-in-out",
      });
    }
    stageEl.focus({ preventScroll: true });
    wake();
  }
  function jump(): void {
    if (c.onGround || c.coyote > 0) {
      Object.assign(c, {
        vy: JUMP_VY,
        onGround: false,
        coyote: 0,
        holding: true,
        buffer: 0,
        squash: -0.1,
      });
    } else {
      c.buffer = 0.12;
    }
  }
  function press(): void {
    if (state === "title") start();
    else if (state === "paused") setPaused(false);
    else if (state === "play" && freeze > 0) c.buffer = 0.12;
    else if (state === "play") jump();
  }
  function release(): void {
    c.buffer = 0;
    if (!c.holding) return;
    c.holding = false;
    if (c.vy < SHORT_HOP_VY) c.vy = SHORT_HOP_VY;
  }
  function setPaused(paused: boolean): void {
    if (paused && state === "play") {
      enter("paused");
    } else if (!paused && state === "paused") {
      enter("play");
      follow = true;
      stageEl.focus({ preventScroll: true });
      wake();
    }
  }
  function reachGoal(): void {
    enter("goal");
    goalT = 0;
    follow = true;
    Object.assign(c, { vy: 0, y: GROUND, onGround: true, holding: false });
    const complete = !skipped && collected.size === TOTAL;
    const newBest = complete && (!record.best || runT < record.best);
    record = { ...record, last: [...collected], ...(newBest ? { best: runT } : {}) };
    saveRecordIfStorageAllows(record);
    showRecord();
    const score = byId("run-end-score");
    if (skipped) {
      score.textContent = "Skipped ahead. Everything is checked off above.";
    } else {
      const strong = document.createElement("strong");
      strong.textContent = `${collected.size} / ${TOTAL}`;
      score.replaceChildren(
        strong,
        ` picked up · ${bumps} ${bumps === 1 ? "bump" : "bumps"} · ${formatTime(runT)}${newBest ? " · new best" : ""}`,
      );
    }
    byId("run-end-head").textContent = `${formatMonth(NOW_M)} · Now`;
  }
  function skipAll(): void {
    if (state === "goal") return;
    skipped = true;
    for (const item of items) {
      if (collected.has(item.id)) continue;
      collected.add(item.id);
      markEntry(item.id, true);
    }
    setCount(TOTAL);
    show(cards.title, false);
    c.x = GOAL_X - 50;
    updateHud();
    reachGoal();
    show(cards.end, true);
    wake();
  }
  function toTitle(): void {
    Object.assign(c, REST);
    freeze = 0;
    floats.length = 0;
    rings.length = 0;
    dust.length = 0;
    show(cards.end, false);
    enter("title");
    follow = true;
    updateHud();
  }
  function clearProgress(): void {
    record = {};
    saveRecordIfStorageAllows(record);
    resetCollected();
    showRecord();
    if (state === "goal") {
      toTitle();
      show(cards.title, true);
    }
    const note = document.createElement("span");
    note.className = "run-pickup-kind";
    note.textContent = "Progress cleared.";
    pickupEl.replaceChildren(note);
  }

  const spaceBelongsToControl = (target: EventTarget | null): boolean =>
    target instanceof Element &&
    target.closest("button, input, textarea, select, [contenteditable]") !== null;
  const stripInView = (): boolean => {
    const r = stageEl.getBoundingClientRect();
    return r.bottom > 60 && r.top < window.innerHeight - 60;
  };
  window.addEventListener("keydown", (e) => {
    if (spaceBelongsToControl(e.target)) return;
    const focused = document.activeElement === stageEl;
    const modified = e.shiftKey || e.metaKey || e.ctrlKey || e.altKey;
    const startsFromPage = e.code === "Space" && state !== "goal" && stripInView();
    if (
      JUMP_KEYS.includes(e.code) &&
      !modified &&
      (focused || state === "play" || startsFromPage)
    ) {
      e.preventDefault();
      if (!e.repeat) press();
    } else if (
      (e.code === "KeyP" || e.code === "Escape") &&
      (state === "play" || state === "paused")
    ) {
      setPaused(state === "play");
    } else if (focused && state !== "play" && (e.code === "ArrowLeft" || e.code === "ArrowRight")) {
      e.preventDefault();
      follow = false;
      camTarget = clampCam(camTarget + (e.code === "ArrowLeft" ? -180 : 180));
      wake();
    }
  });
  window.addEventListener("keyup", (e) => {
    if (JUMP_KEYS.includes(e.code)) release();
  });

  const localPoint = (e: PointerEvent, el: HTMLElement): { x: number; y: number } => {
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const itemAt = (p: { x: number; y: number }): PlacedItem | undefined =>
    items.find(
      (item) =>
        !collected.has(item.id) && Math.abs(p.x + cam - item.x) < 12 && Math.abs(p.y - item.y) < 12,
    );
  const setHover = (id: string | null): void => {
    if (id === hoverId) return;
    if (hoverId) entries.get(hoverId)?.classList.remove("run-seek");
    hoverId = id;
    if (id) entries.get(id)?.classList.add("run-seek");
    wake();
  };

  stageEl.addEventListener("pointerdown", (e) => {
    if (!(e.target instanceof Element)) return;
    if (e.target.closest("a, button, #run-card-end")) return;
    if (state === "play") {
      e.preventDefault();
      press();
      return;
    }
    drag = { id: e.pointerId, x: e.clientX, cam0: cam, moved: false };
    stageEl.setPointerCapture(e.pointerId);
  });
  stageEl.addEventListener("pointermove", (e) => {
    if (drag && e.pointerId === drag.id) {
      const dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) > 6) {
        drag.moved = true;
        stageEl.classList.add("grab");
      }
      if (drag.moved) {
        follow = false;
        cam = camTarget = clampCam(drag.cam0 - dx);
        wake();
      }
      return;
    }
    if (state !== "play") setHover(itemAt(localPoint(e, stageEl))?.id ?? null);
  });
  stageEl.addEventListener("pointerleave", () => setHover(null));
  const endDrag = (e: PointerEvent): void => {
    if (!drag || e.pointerId !== drag.id) return;
    const tap = !drag.moved;
    drag = null;
    stageEl.classList.remove("grab");
    if (!tap || e.type === "pointercancel") return;
    const item = itemAt(localPoint(e, stageEl));
    if (item && state !== "play") revealEntry(item);
    else if (state === "title" || state === "paused") press();
  };
  stageEl.addEventListener("pointerup", endDrag);
  stageEl.addEventListener("pointercancel", endDrag);
  window.addEventListener("pointerup", release);
  window.addEventListener("pointercancel", release);
  stageEl.addEventListener(
    "wheel",
    (e) => {
      if (state === "play" || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      follow = false;
      cam = camTarget = clampCam(camTarget + e.deltaX);
      wake();
    },
    { passive: false },
  );

  function revealEntry(item: PlacedItem): void {
    pickupLine("On the road · ", item);
    const el = entries.get(item.id);
    if (!el) return;
    el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    el.classList.add("run-flash");
    setTimeout(() => el.classList.remove("run-flash"), 700);
  }

  for (const [id, el] of entries) {
    const item = itemById.get(id);
    if (!item) continue;
    const seek = (): void => {
      if (state === "play") return;
      seekId = id;
      follow = false;
      camTarget = clampCam(item.x - viewW / 2);
      pickupLine(collected.has(id) ? "Picked up · " : "On the road · ", item);
      wake();
    };
    const leave = (): void => {
      if (seekId === id) seekId = null;
    };
    el.addEventListener("mouseenter", seek);
    el.addEventListener("focusin", seek);
    el.addEventListener("mouseleave", leave);
    el.addEventListener("focusout", leave);
  }

  mainButton.addEventListener("click", () => {
    if (state === "goal") {
      toTitle();
      start();
    } else if (state === "play") {
      setPaused(true);
    } else {
      press();
    }
  });
  byId("run-skip").addEventListener("click", skipAll);
  resetButton.addEventListener("click", clearProgress);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) setPaused(true);
    else wake();
  });

  const fit = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): number => {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return r.width;
  };
  new ResizeObserver(() => {
    viewW = fit(gameCanvas, g);
    trackW = fit(trackCanvas, tg);
    cam = clampCam(cam);
    camTarget = clampCam(camTarget);
    wake();
  }).observe(gameCanvas);

  const trackScale = (): number => (trackW - 4) / END_X;
  const trackSeek = (e: PointerEvent): void => {
    follow = false;
    camTarget = clampCam((localPoint(e, trackCanvas).x - 2) / trackScale() - viewW / 2);
    wake();
  };
  trackCanvas.addEventListener("pointerdown", (e) => {
    if (state === "play") return;
    trackDrag = e.pointerId;
    trackCanvas.setPointerCapture(e.pointerId);
    trackSeek(e);
  });
  trackCanvas.addEventListener("pointermove", (e) => {
    if (trackDrag === e.pointerId) trackSeek(e);
  });
  const endTrackDrag = (): void => {
    trackDrag = null;
  };
  trackCanvas.addEventListener("pointerup", endTrackDrag);
  trackCanvas.addEventListener("pointercancel", endTrackDrag);

  const overSegment = (lane: Lane): boolean =>
    lane.segments.some(([from, to]) => c.x + 40 > from && c.x + 8 < to);
  const bugX = (o: Obstacle): number =>
    o.type === "bug" && !reduceMotion ? o.x + Math.sin(clock * 1.6 + o.phase) * 6 : o.x;
  const puff = (x: number, y: number, n: number, spread: number): void => {
    if (reduceMotion) return;
    for (let i = 0; i < n; i++) {
      dust.push({
        x: x + (Math.random() - 0.5) * spread,
        y,
        vx: -20 - Math.random() * 40,
        vy: -10 - Math.random() * 25,
        t: 0,
        life: 0.35 + Math.random() * 0.2,
        r: 1 + Math.random() * 1.4,
      });
    }
  };

  function update(dt: number): void {
    clock += dt;
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i]!;
      f.t += dt;
      f.y -= 16 * dt;
      if (f.t > 1.1) floats.splice(i, 1);
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]!;
      r.t += dt;
      if (r.t > 0.5) rings.splice(i, 1);
    }
    for (let i = dust.length - 1; i >= 0; i--) {
      const d = dust[i]!;
      d.t += dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vy += 60 * dt;
      if (d.t > d.life) dust.splice(i, 1);
    }
    c.squash *= Math.exp(-dt * 14);
    blinkT -= dt;
    if (blinkT < -0.12) blinkT = 2 + Math.random() * 3;

    if (state === "goal") {
      goalT += dt;
      c.y = GROUND;
    } else if (state === "play") {
      if (freeze > 0) freeze -= dt;
      else step(dt);
    } else if (!c.onGround) {
      c.vy += GRAVITY * dt;
      c.y += c.vy * dt;
      if (c.y >= GROUND) Object.assign(c, { y: GROUND, vy: 0, onGround: true });
    }

    if (follow) camTarget = clampCam(c.x - viewW * 0.28);
    if (!drag)
      cam += (camTarget - cam) * (1 - Math.exp(-dt * (follow && state === "play" ? 12 : 7)));
    if (Math.abs(camTarget - cam) < 0.05) cam = camTarget;
  }

  function step(dt: number): void {
    runT += dt;
    c.slow -= dt;
    c.inv -= dt;
    c.coyote -= dt;
    c.buffer -= dt;
    const speed = c.slow > 0 ? 72 : 168;
    c.x += speed * dt;
    c.phase += dt * speed * 0.11;

    const prevY = c.y;
    c.vy += GRAVITY * dt;
    c.y += c.vy * dt;
    const wasGround = c.onGround;
    c.onGround = false;
    if (c.vy >= 0) {
      for (const lane of lanes) {
        if (prevY <= lane.y + 0.5 && c.y >= lane.y && overSegment(lane)) {
          c.y = lane.y;
          c.onGround = true;
          break;
        }
      }
      if (!c.onGround && c.y >= GROUND) {
        c.y = GROUND;
        c.onGround = true;
      }
      if (c.onGround) {
        if (!wasGround && c.vy > 300) {
          c.squash = Math.min(0.16, c.vy / 5000);
          puff(c.x + 12, c.y, 4, 16);
        }
        c.vy = 0;
      }
    }
    if (c.onGround) {
      c.holding = false;
      if (c.buffer > 0) jump();
      c.dustT -= dt;
      if (c.dustT <= 0 && c.slow <= 0) {
        puff(c.x + 8, c.y, 1, 4);
        c.dustT = 0.16;
      }
    }
    if (wasGround && !c.onGround && c.vy >= 0) c.coyote = 0.09;

    const bx = c.x + 4;
    const by = c.y - 36;
    const bw = 48;
    const bh = 36;
    for (const item of items) {
      if (collected.has(item.id) || !overlap(bx, by, bw, bh, item.x - 8, item.y - 8, 16, 16))
        continue;
      collected.add(item.id);
      markEntry(item.id, true, true);
      setCount(collected.size);
      pickupLine("Picked up · ", item);
      announceEl.textContent = `Picked up ${item.kind}: ${item.title}`;
      freeze = 0.16;
      c.squash = -0.06;
      floats.push({ x: item.x, y: item.y - 14, text: `+ ${item.kind}`, t: 0, tone: "link" });
      if (!reduceMotion) rings.push({ x: item.x, y: item.y, t: 0 });
    }
    if (c.inv <= 0) {
      for (const o of obstacles) {
        const ox = bugX(o);
        if (!overlap(bx + 8, by + 10, bw - 16, bh - 10, ox - 5, GROUND - 10, 10, 10)) continue;
        bumps++;
        c.slow = 1.1;
        c.inv = 1.5;
        if (c.onGround) {
          c.vy = -260;
          c.onGround = false;
        }
        floats.push({
          x: ox,
          y: GROUND - 30,
          text: o.type === "bug" ? "bug" : "incident",
          t: 0,
          tone: "muted",
        });
        break;
      }
    }
    if (c.x >= GOAL_X - 50) {
      c.x = GOAL_X - 50;
      reachGoal();
      setTimeout(
        () => {
          if (state === "goal") show(cards.end, true);
        },
        reduceMotion ? 0 : 700,
      );
    }
    updateHud();
  }

  const CORGI_SCALE = 0.88;
  const NECK: Point = [41, -30];
  const NEAR_EAR_BASE: Point = [46, -40.5];
  const FAR_EAR_BASE: Point = [41, -39];
  const corgiBody = new Path2D(
    "M9 -23.5 C17 -26.5 28 -26.5 34 -25.5 C37 -27 39 -31 41 -33 L47 -27 C47 -19 46 -13 42.5 -9 C37 -6.5 15 -6.5 9.5 -8 C2.5 -9 1.5 -20 9 -23.5 Z",
  );
  const corgiHead = new Path2D(
    "M37.5 -31 C36.5 -39 42 -43 47 -42.5 C50.5 -42 52.5 -39.5 53.2 -37 C55 -36 58 -35 59.5 -33.6 C61 -32.2 60.5 -29.4 58.2 -29.2 C55.5 -28 52 -26 48.5 -25.8 C43 -25.5 38.6 -27 37.5 -31 Z",
  );
  const nearEar = new Path2D(
    "M42 -39.5 C41 -45 41.8 -50 43.6 -52.8 C44.2 -53.4 44.9 -53.3 45.4 -52.7 C47.6 -49.6 49.4 -45.6 50 -41",
  );
  const farEar = new Path2D(
    "M38.4 -37.6 C37.4 -43 37.6 -47.6 38.8 -50.6 C39.2 -51.1 39.7 -51 40 -50.5 C41.8 -47.8 43 -44.8 43.6 -40.6",
  );
  const LEGS: { hipX: number; phaseOffset: number; far: boolean }[] = [
    { hipX: 11, phaseOffset: 0.9, far: true },
    { hipX: 34, phaseOffset: Math.PI + 0.9, far: true },
    { hipX: 15.5, phaseOffset: 0, far: false },
    { hipX: 38.5, phaseOffset: Math.PI, far: false },
  ];

  function drawCorgi(
    ctx: CanvasRenderingContext2D,
    rearFootX: number,
    feetY: number,
    o: { pose: Pose; phase: number; squash: number; blink: boolean; happy: boolean },
  ): void {
    const { pose, phase, squash, blink, happy } = o;
    const run = pose === "run";
    const air = pose === "air";
    const sit = pose === "sit";
    const still = reduceMotion;
    const pleased = sit || happy;
    const bob = run && !still ? -Math.abs(Math.sin(phase)) * 2 : 0;
    const tilt = sit
      ? -0.26
      : air
        ? Math.max(-0.12, Math.min(0.12, c.vy / 4000))
        : run && !still
          ? Math.sin(phase * 2) * 0.03
          : 0;
    const wag = still ? 0 : Math.sin(clock * (pleased ? 18 : run ? 11 : 5)) * (pleased ? 0.6 : 0.3);
    const earBack =
      Math.max(0, squash) * 2.4 +
      (air && c.vy < 0 ? 0.14 : 0) +
      (run && !still ? Math.max(0, Math.sin(phase * 2 + 1)) * 0.07 : 0);
    const pivot: Point = sit ? [8, -5] : [24, -12];

    ctx.save();
    ctx.translate(rearFootX, feetY);
    ctx.translate(26, 0);
    ctx.scale(1 + squash * 0.7, 1 - squash);
    ctx.translate(-26, 0);
    ctx.scale(CORGI_SCALE, CORGI_SCALE);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = T["corgi-ink"];

    const toBody = (): void => {
      ctx.translate(0, bob);
      ctx.translate(pivot[0], pivot[1]);
      ctx.rotate(tilt);
      ctx.translate(-pivot[0], -pivot[1]);
    };
    const bodyPoint = (px: number, py: number): Point => {
      const [rx, ry] = rotAbout(px, py, pivot[0], pivot[1], tilt);
      return [rx, ry + bob];
    };
    const leg = (hx: number, hy: number, a: number, len: number, far: boolean): void => {
      const coat = far ? T["corgi-shade"] : T["corgi-coat"];
      const sock = far ? T["corgi-shade"] : T["corgi-cream"];
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.roundRect(-2.7, -2, 5.4, len + 2, 2.7);
      ctx.fillStyle = coat;
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = sock;
      ctx.fillRect(-3, len * 0.5, 6, len);
      ctx.restore();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0.9, len - 0.3, 3.2, 1.7, 0, 0, Math.PI * 2);
      ctx.fillStyle = sock;
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };
    const legAngle = (hx: number, off: number, far: boolean): number => {
      if (air) return (hx < 24 ? 0.6 : -0.6) * (far ? 0.75 : 1);
      if (run && !still) return Math.sin(phase + off) * 0.6;
      return 0;
    };

    if (sit) {
      const [px, py] = bodyPoint(34, -10);
      leg(px, py, 0, -py - 0.3, true);
    } else {
      ctx.save();
      toBody();
      for (const { hipX, phaseOffset, far } of LEGS)
        if (far) leg(hipX, -10, legAngle(hipX, phaseOffset, true), 8.5, true);
      ctx.restore();
    }

    ctx.save();
    toBody();
    ctx.save();
    ctx.translate(8, -21.5);
    ctx.rotate(-0.75 + wag);
    ctx.beginPath();
    ctx.ellipse(-2.6, -1.4, 4.6, 2.9, 0, 0, Math.PI * 2);
    ctx.fillStyle = T["corgi-coat"];
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-5.6, -1.8);
    ctx.lineTo(-3.8, -1.2);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = T["corgi-coat"];
    ctx.fill(corgiBody);
    ctx.save();
    ctx.clip(corgiBody);
    ctx.fillStyle = T["corgi-cream"];
    ctx.beginPath();
    ctx.moveTo(50, -32);
    ctx.bezierCurveTo(43, -27, 40, -16, 30, -11.6);
    ctx.bezierCurveTo(22, -10.4, 14, -10.4, 6, -10);
    ctx.lineTo(6, 0);
    ctx.lineTo(50, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.stroke(corgiBody);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(4.4, -12.8);
    ctx.quadraticCurveTo(6, -11.8, 5.4, -10.2);
    ctx.moveTo(3.6, -17);
    ctx.quadraticCurveTo(5.2, -16, 4.6, -14.4);
    ctx.moveTo(45.4, -17.5);
    ctx.lineTo(43.2, -16.2);
    ctx.lineTo(45, -14.4);
    ctx.moveTo(44.2, -12.8);
    ctx.lineTo(42.2, -11.6);
    ctx.moveTo(31.5, -23.5);
    ctx.quadraticCurveTo(33.6, -20.5, 33, -17.5);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    if (sit) {
      ctx.beginPath();
      ctx.ellipse(13, -10, 8.4, 6.6, -0.2, 0, Math.PI * 2);
      ctx.fillStyle = T["corgi-coat"];
      ctx.fill();
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(8.4, -7.4);
      ctx.quadraticCurveTo(10.6, -6, 13.2, -6.4);
      ctx.stroke();
      ctx.lineWidth = 1.5;
    } else {
      for (const { hipX, phaseOffset, far } of LEGS)
        if (!far) leg(hipX, -10, legAngle(hipX, phaseOffset, false), 8.5, false);
    }
    ctx.restore();

    if (sit) {
      const [px, py] = bodyPoint(38.5, -10);
      leg(px, py, 0, -py - 0.3, false);
      ctx.beginPath();
      ctx.ellipse(18, -1.8, 4, 1.9, 0, 0, Math.PI * 2);
      ctx.fillStyle = T["corgi-cream"];
      ctx.fill();
      ctx.stroke();
    }

    ctx.save();
    if (sit) {
      const [nx, ny] = bodyPoint(NECK[0], NECK[1]);
      ctx.translate(nx - NECK[0], ny - NECK[1]);
      ctx.translate(NECK[0], NECK[1]);
      ctx.rotate(-0.06);
      ctx.translate(-NECK[0], -NECK[1]);
    } else {
      toBody();
      ctx.translate(0, run && !still ? Math.sin(phase * 2 + 0.6) * 0.8 : 0);
      ctx.translate(NECK[0], NECK[1]);
      ctx.rotate(-tilt * 0.6);
      ctx.translate(-NECK[0], -NECK[1]);
    }
    const ear = (path: Path2D, base: Point, fill: string, inner: boolean): void => {
      ctx.save();
      ctx.translate(base[0], base[1]);
      ctx.rotate(-earBack);
      ctx.translate(-base[0], -base[1]);
      ctx.fillStyle = fill;
      ctx.fill(path);
      ctx.stroke(path);
      if (inner) {
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(44.4, -43);
        ctx.quadraticCurveTo(44.2, -47.5, 44.6, -50.2);
        ctx.moveTo(46.4, -43.4);
        ctx.quadraticCurveTo(46.2, -46.4, 45.6, -48.6);
        ctx.stroke();
      }
      ctx.restore();
    };
    ear(farEar, FAR_EAR_BASE, T["corgi-shade"], false);
    ctx.fillStyle = T["corgi-coat"];
    ctx.fill(corgiHead);
    ctx.save();
    ctx.clip(corgiHead);
    ctx.fillStyle = T["corgi-cream"];
    ctx.beginPath();
    ctx.moveTo(46, -44);
    ctx.quadraticCurveTo(49.5, -41, 51, -38.2);
    ctx.quadraticCurveTo(52.5, -35.6, 55.5, -35);
    ctx.lineTo(63, -34);
    ctx.lineTo(63, -24);
    ctx.lineTo(40, -24);
    ctx.quadraticCurveTo(43.5, -29.5, 49.6, -30.6);
    ctx.quadraticCurveTo(48.4, -33.4, 48.8, -36.2);
    ctx.quadraticCurveTo(48.2, -40, 46, -44);
    ctx.fill();
    ctx.restore();
    ctx.stroke(corgiHead);
    ear(nearEar, NEAR_EAR_BASE, T["corgi-coat"], true);
    ctx.fillStyle = T["corgi-tongue"];
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.ellipse(52.6, -29.8, 2.2, 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = T["corgi-ink"];
    ctx.beginPath();
    ctx.ellipse(59.4, -31.7, 2.1, 1.7, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = T["corgi-cream"];
    ctx.beginPath();
    ctx.arc(59.9, -32.3, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.2;
    if (pleased) {
      ctx.beginPath();
      ctx.moveTo(58.2, -28.8);
      ctx.quadraticCurveTo(57.8, -25.2, 55.6, -25.9);
      ctx.quadraticCurveTo(55, -27.2, 55.8, -28.4);
      ctx.fillStyle = T["corgi-tongue"];
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(59, -29.6);
    ctx.quadraticCurveTo(57.2, -27.8, 55.2, -28.8);
    ctx.quadraticCurveTo(54.5, -29.2, 54.5, -30);
    ctx.stroke();
    ctx.lineWidth = 1.4;
    if (pleased) {
      ctx.beginPath();
      ctx.arc(51.2, -33.4, 2, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    } else if (blink) {
      ctx.beginPath();
      ctx.moveTo(49.4, -34);
      ctx.quadraticCurveTo(51.2, -33.1, 53, -34);
      ctx.stroke();
    } else {
      ctx.fillStyle = T["corgi-ink"];
      ctx.beginPath();
      ctx.ellipse(51.2, -34.2, 1.9, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = T["corgi-cream"];
      ctx.beginPath();
      ctx.arc(51.9, -35.1, 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(49.6, -37.6);
    ctx.quadraticCurveTo(51, -38.3, 52.4, -37.6);
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  const ICONS: Record<CourseIcon, (ctx: CanvasRenderingContext2D) => void> = {
    mic: (ctx) => {
      ctx.roundRect(-3, -7, 6, 8.5, 3);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -2, 5, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.moveTo(0, 3);
      ctx.lineTo(0, 6);
      ctx.moveTo(-3, 6);
      ctx.lineTo(3, 6);
    },
    article: (ctx) => {
      ctx.moveTo(-4.5, -6);
      ctx.lineTo(2, -6);
      ctx.lineTo(4.5, -3.5);
      ctx.lineTo(4.5, 6);
      ctx.lineTo(-4.5, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-2, -2);
      ctx.lineTo(2, -2);
      ctx.moveTo(-2, 0.75);
      ctx.lineTo(2, 0.75);
      ctx.moveTo(-2, 3.5);
      ctx.lineTo(1, 3.5);
    },
    book: (ctx) => {
      ctx.moveTo(0, -3.5);
      ctx.quadraticCurveTo(-3, -6, -6, -5);
      ctx.lineTo(-6, 4);
      ctx.quadraticCurveTo(-3, 3, 0, 5.5);
      ctx.quadraticCurveTo(3, 3, 6, 4);
      ctx.lineTo(6, -5);
      ctx.quadraticCurveTo(3, -6, 0, -3.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -3.5);
      ctx.lineTo(0, 5.5);
    },
    trophy: (ctx) => {
      ctx.moveTo(-4, -6);
      ctx.lineTo(4, -6);
      ctx.lineTo(3, -1);
      ctx.quadraticCurveTo(0, 1.5, -3, -1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-4, -5);
      ctx.quadraticCurveTo(-6.5, -4, -3.5, -2);
      ctx.moveTo(4, -5);
      ctx.quadraticCurveTo(6.5, -4, 3.5, -2);
      ctx.moveTo(0, 0.5);
      ctx.lineTo(0, 4);
      ctx.moveTo(-3, 4.5);
      ctx.lineTo(3, 4.5);
    },
    medal: (ctx) => {
      ctx.moveTo(-3.5, -7);
      ctx.lineTo(0, -2);
      ctx.lineTo(3.5, -7);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 1.5, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 1.5, 1.6, 0, Math.PI * 2);
    },
  };
  const drawIcon = (
    ctx: CanvasRenderingContext2D,
    icon: CourseIcon,
    x: number,
    y: number,
    color: string,
  ): void => {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = color;
    ctx.fillStyle = T.background;
    ctx.lineWidth = 1.25;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ICONS[icon](ctx);
    ctx.stroke();
    ctx.restore();
  };

  const drawObstacle = (ctx: CanvasRenderingContext2D, o: Obstacle, x: number): void => {
    ctx.save();
    ctx.strokeStyle = T.muted;
    ctx.fillStyle = T.background;
    ctx.lineWidth = 1.25;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (o.type === "bug") {
      const k = reduceMotion ? 0 : Math.sin(clock * 18 + o.phase) * 1.2;
      ctx.beginPath();
      for (let i = -1; i <= 1; i++) {
        ctx.moveTo(x + i * 2.5, GROUND - 4);
        ctx.lineTo(x + i * 3.5 + (i === 0 ? k : -k), GROUND);
      }
      ctx.moveTo(x + 4, GROUND - 6);
      ctx.lineTo(x + 7, GROUND - 9.5);
      ctx.moveTo(x + 3, GROUND - 7);
      ctx.lineTo(x + 4.5, GROUND - 10.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(x, GROUND - 4.5, 5, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 1, GROUND - 8);
      ctx.lineTo(x - 1, GROUND - 1);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(x - 7, GROUND);
      ctx.lineTo(x + 7, GROUND);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 5, GROUND - 0.5);
      ctx.lineTo(x - 1, GROUND - 13);
      ctx.lineTo(x + 1, GROUND - 13);
      ctx.lineTo(x + 5, GROUND - 0.5);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 3.2, GROUND - 6);
      ctx.lineTo(x + 3.2, GROUND - 6);
      ctx.stroke();
    }
    ctx.restore();
  };

  const haloText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void => {
    ctx.save();
    ctx.strokeStyle = T.background;
    ctx.lineWidth = 4;
    ctx.lineJoin = "round";
    ctx.strokeText(text, x, y);
    ctx.restore();
    ctx.fillText(text, x, y);
  };

  const drawSkyShape = (ctx: CanvasRenderingContext2D, b: SkyShape): void => {
    const x = Math.round(b.x) + 0.5;
    const top = GROUND - b.h;
    ctx.beginPath();
    switch (b.kind) {
      case "house":
        ctx.moveTo(x, GROUND);
        ctx.lineTo(x, top + 5);
        ctx.lineTo(x + b.w / 2, top - 2);
        ctx.lineTo(x + b.w, top + 5);
        ctx.lineTo(x + b.w, GROUND);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.rect(x + b.w / 2 - 2, GROUND - 6, 4, 6);
        ctx.stroke();
        break;
      case "tree":
        ctx.moveTo(x + 6, GROUND);
        ctx.lineTo(x + 6, top + 9);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x + 6, top + 5, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      case "tower":
      case "antenna":
        ctx.rect(x, top, Math.round(b.w), b.h);
        ctx.fill();
        ctx.stroke();
        if (b.kind === "antenna") {
          ctx.beginPath();
          ctx.moveTo(x + b.w / 2, top);
          ctx.lineTo(x + b.w / 2, top - 9);
          ctx.stroke();
        }
        if (b.windows) {
          ctx.beginPath();
          for (let wy = top + 5; wy < GROUND - 6; wy += 7) {
            for (let wx = x + 3.5; wx < x + b.w - 3; wx += 5) ctx.rect(wx, wy, 1.5, 2);
          }
          ctx.fillStyle = T.line;
          ctx.fill();
          ctx.fillStyle = T.background;
        }
        break;
      case "tokyo-tower": {
        const half = (yy: number): number =>
          2 + 15 * ((yy - (top + 22)) / (GROUND - (top + 22))) ** 1.6;
        ctx.moveTo(x - 17, GROUND);
        ctx.quadraticCurveTo(x - 6, GROUND - 40, x - 2, top + 22);
        ctx.lineTo(x - 1, top + 8);
        ctx.lineTo(x, top);
        ctx.lineTo(x + 1, top + 8);
        ctx.lineTo(x + 2, top + 22);
        ctx.quadraticCurveTo(x + 6, GROUND - 40, x + 17, GROUND);
        ctx.stroke();
        ctx.beginPath();
        ctx.rect(x - 8, GROUND - 46, 16, 5);
        ctx.rect(x - 4, top + 22, 8, 3);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        for (const [y1, y2] of [
          [GROUND - 2, GROUND - 22],
          [GROUND - 22, GROUND - 41],
          [GROUND - 41, GROUND - 62],
          [GROUND - 62, top + 25],
        ] as const) {
          ctx.moveTo(x - half(y1), y1);
          ctx.lineTo(x + half(y2), y2);
          ctx.moveTo(x + half(y1), y1);
          ctx.lineTo(x - half(y2), y2);
        }
        ctx.stroke();
        break;
      }
      case "skytree":
        ctx.moveTo(x - 9, GROUND);
        ctx.lineTo(x - 3, top + 34);
        ctx.lineTo(x - 1.5, top + 14);
        ctx.lineTo(x, top);
        ctx.lineTo(x + 1.5, top + 14);
        ctx.lineTo(x + 3, top + 34);
        ctx.lineTo(x + 9, GROUND);
        ctx.stroke();
        ctx.beginPath();
        ctx.roundRect(x - 6, top + 48, 12, 6, 2);
        ctx.roundRect(x - 4.5, top + 30, 9, 4, 2);
        ctx.fill();
        ctx.stroke();
        break;
    }
  };

  const drawBackdrop = (ctx: CanvasRenderingContext2D, w: number): void => {
    const off = cam * PF_FAR;
    ctx.save();
    ctx.translate(-off, 0);
    ctx.strokeStyle = T.line;
    ctx.fillStyle = T.background;
    ctx.lineWidth = 1;
    ctx.lineJoin = "round";
    for (const b of sky) if (b.x + b.w >= off - 20 && b.x <= off + w + 20) drawSkyShape(ctx, b);
    ctx.restore();

    const moff = cam * PF_MID;
    const first = Math.floor((moff - 40) / POLE_GAP);
    const last = Math.ceil((moff + w + 40) / POLE_GAP);
    ctx.save();
    ctx.translate(-moff, 0);
    ctx.strokeStyle = T.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = first; k <= last; k++) {
      const px = k * POLE_GAP + 0.5;
      const top = GROUND - 90;
      const nx = px + POLE_GAP;
      ctx.moveTo(px, GROUND);
      ctx.lineTo(px, top);
      ctx.moveTo(px - 9, top + 8);
      ctx.lineTo(px + 9, top + 8);
      ctx.moveTo(px - 5, top + 15);
      ctx.lineTo(px + 5, top + 15);
      ctx.moveTo(px - 9, top + 8);
      ctx.quadraticCurveTo(px + POLE_GAP / 2 - 9, top + 20, nx - 9, top + 8);
      ctx.moveTo(px + 9, top + 8);
      ctx.quadraticCurveTo(px + POLE_GAP / 2 + 9, top + 19, nx + 9, top + 8);
      ctx.moveTo(px, top + 15);
      ctx.quadraticCurveTo(px + POLE_GAP / 2, top + 26, nx, top + 15);
    }
    ctx.stroke();
    ctx.fillStyle = T.background;
    for (let k = first; k <= last; k++) {
      if (((k % 3) + 3) % 3 !== 1) continue;
      const px = k * POLE_GAP + 0.5;
      ctx.beginPath();
      ctx.roundRect(px - 3.5, GROUND - 66, 7, 9, 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  };

  function draw(): void {
    const w = viewW;
    const vis = (x: number, pad = 40): boolean => x > cam - pad && x < cam + w + pad;
    g.clearRect(0, 0, w, H);
    g.fillStyle = T.background;
    g.fillRect(0, 0, w, H);
    drawBackdrop(g, w);

    g.save();
    g.translate(-Math.round(cam), 0);
    g.textBaseline = "alphabetic";

    g.fillStyle = T.background;
    g.fillRect(cam - 10, GROUND, w + 20, H - GROUND);
    g.strokeStyle = T.text;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(cam - 10, GROUND + 0.5);
    g.lineTo(cam + w + 10, GROUND + 0.5);
    g.stroke();
    g.strokeStyle = T.muted;
    g.fillStyle = T.muted;
    g.font = font(11);
    g.textAlign = "left";
    g.beginPath();
    for (let m = 0; m <= NOW_M; m++) {
      const x = Math.round(xAt(m)) + 0.5;
      if (!vis(x)) continue;
      g.moveTo(x, GROUND + 1);
      g.lineTo(x, GROUND + ((m + 3) % 12 === 0 ? 8 : 3.5));
    }
    g.globalAlpha = 0.6;
    g.stroke();
    g.globalAlpha = 1;
    for (const year of YEARS) {
      const x = xAt(monthIndex(`Jan ${year}`));
      if (vis(x, 60)) g.fillText(String(year), x + 3, GROUND + 21);
    }
    if (vis(START, 80)) g.fillText("Apr 2016", START + 3, GROUND + 21);

    for (const stage of stages) {
      if (!vis(stage.x, 280)) continue;
      const reached = state !== "title" && c.x + 26 >= stage.x;
      g.strokeStyle = reached ? T.muted : T.line;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(Math.round(stage.x) + 0.5, 52);
      g.lineTo(Math.round(stage.x) + 0.5, GROUND);
      g.stroke();
      g.textAlign = "left";
      g.fillStyle = T.muted;
      g.font = font(11);
      haloText(g, stage.start, stage.x + 6, 16);
      g.fillStyle = T.text;
      g.font = font(12, 600);
      haloText(g, stage.role, stage.x + 6, 31);
      g.fillStyle = T.muted;
      g.font = font(11);
      haloText(g, stage.org, stage.x + 6, 45);
    }

    for (const lane of lanes) {
      if (lane.x2 < cam - 40 || lane.x1 > cam + w + 40) continue;
      g.strokeStyle = T.muted;
      g.lineWidth = 1;
      g.setLineDash([4, 3]);
      g.beginPath();
      for (const [from, to] of lane.segments) {
        g.moveTo(from, lane.y + 0.5);
        g.lineTo(to, lane.y + 0.5);
      }
      g.stroke();
      g.setLineDash([]);
      g.beginPath();
      for (const [from, to] of lane.segments) {
        g.moveTo(from, lane.y - 3);
        g.lineTo(from, lane.y + 4);
        g.moveTo(to, lane.y - 3);
        g.lineTo(to, lane.y + 4);
      }
      g.stroke();
      g.fillStyle = T.muted;
      g.font = font(11);
      g.textAlign = "left";
      const label = `${lane.role}, ${shortOrg(lane.org)}${lane.tag === "Side" ? " · Side" : ""}`;
      const lowerLane = lane.lane === 0;
      const labelY = lowerLane ? lane.y + 14 : lane.y - 6;
      haloText(g, label, lane.x1 + 4, labelY);
    }

    if (vis(GOAL_X, 220)) {
      const gx = GOAL_X;
      const wave = reduceMotion ? 0 : Math.sin(clock * 5) * 2.5;
      g.strokeStyle = T.text;
      g.lineWidth = 1.5;
      g.lineJoin = "round";
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(gx, GROUND);
      g.lineTo(gx, GROUND - 76);
      g.stroke();
      g.beginPath();
      g.moveTo(gx, GROUND - 76);
      g.quadraticCurveTo(gx + 11, GROUND - 76 + wave, gx + 23, GROUND - 69);
      g.quadraticCurveTo(gx + 11, GROUND - 62 - wave, gx, GROUND - 62);
      g.fillStyle = state === "goal" ? T.link : T.background;
      g.fill();
      g.stroke();
      g.fillStyle = T.background;
      g.beginPath();
      g.moveTo(gx + 36, GROUND);
      g.lineTo(gx + 36, GROUND - 22);
      g.lineTo(gx + 54, GROUND - 37);
      g.lineTo(gx + 72, GROUND - 22);
      g.lineTo(gx + 72, GROUND);
      g.fill();
      g.stroke();
      g.beginPath();
      g.moveTo(gx + 32, GROUND - 19);
      g.lineTo(gx + 54, GROUND - 40);
      g.lineTo(gx + 76, GROUND - 19);
      g.stroke();
      g.beginPath();
      g.moveTo(gx + 47, GROUND);
      g.lineTo(gx + 47, GROUND - 10);
      g.arc(gx + 54, GROUND - 10, 7, Math.PI, 0);
      g.lineTo(gx + 61, GROUND);
      g.stroke();
      g.fillStyle = T.muted;
      g.font = font(11);
      g.textAlign = "left";
      haloText(g, formatMonth(NOW_M), gx + 6, 16);
      g.fillStyle = T.text;
      g.font = font(12, 600);
      haloText(g, "Now", gx + 6, 31);
    }

    const focusId = seekId ?? hoverId;
    for (const item of items) {
      if (collected.has(item.id) || !vis(item.x)) continue;
      const y = item.y + (reduceMotion ? 0 : Math.sin(clock * 2.2 + item.x * 0.05) * 1.5);
      if (item.id === focusId) {
        const pulse = reduceMotion ? 0 : (clock * 1.4) % 1;
        g.strokeStyle = T.link;
        g.lineWidth = 1;
        g.beginPath();
        g.arc(item.x, y, 11, 0, Math.PI * 2);
        g.stroke();
        if (pulse) {
          g.globalAlpha = 1 - pulse;
          g.beginPath();
          g.arc(item.x, y, 11 + pulse * 10, 0, Math.PI * 2);
          g.stroke();
          g.globalAlpha = 1;
        }
      }
      drawIcon(g, item.icon, item.x, y, item.id === focusId ? T.link : T.text);
    }
    for (const r of rings) {
      g.strokeStyle = T.link;
      g.lineWidth = 1;
      g.globalAlpha = 1 - r.t / 0.5;
      g.beginPath();
      g.arc(r.x, r.y, 8 + r.t * 30, 0, Math.PI * 2);
      g.stroke();
      g.globalAlpha = 1;
    }

    for (const o of obstacles) if (vis(o.x)) drawObstacle(g, o, bugX(o));

    g.strokeStyle = T.muted;
    g.lineWidth = 1;
    for (const d of dust) {
      g.globalAlpha = Math.max(0, 1 - d.t / d.life) * 0.8;
      g.beginPath();
      g.arc(d.x, d.y - 1, d.r, 0, Math.PI * 2);
      g.stroke();
    }
    g.globalAlpha = 1;

    const recovering = c.inv > 0 && state === "play";
    if (!(recovering && !reduceMotion && Math.floor(clock * 12) % 2 === 0)) {
      let pose: Pose = "stand";
      if (state === "goal" && goalT > 0.35) pose = "sit";
      else if (!c.onGround) pose = "air";
      else if (state === "play" && freeze <= 0) pose = "run";
      g.save();
      const lift = GROUND - c.y;
      const overLane = lanes.some((l) => c.y <= l.y && overSegment(l));
      if (lift > 0 && !overLane) {
        const sw = Math.max(6, 18 - lift / 6);
        g.strokeStyle = T.muted;
        g.globalAlpha = Math.max(0.15, 0.6 - lift / 150);
        g.beginPath();
        g.moveTo(c.x + 24 - sw, GROUND - 1);
        g.lineTo(c.x + 24 + sw, GROUND - 1);
        g.stroke();
        g.globalAlpha = 1;
      }
      if (recovering) g.globalAlpha = 0.85;
      drawCorgi(g, c.x, c.y, {
        pose,
        phase: c.phase,
        squash: c.squash,
        blink: blinkT < 0 && state !== "play",
        happy: freeze > 0,
      });
      g.restore();
    }

    g.textAlign = "center";
    g.font = font(11, 500);
    for (const f of floats) {
      g.globalAlpha = Math.max(0, 1 - f.t / 1.1);
      g.fillStyle = f.tone === "link" ? T.link : T.muted;
      haloText(g, f.text, f.x, f.y);
    }
    g.globalAlpha = 1;

    const tip = hoverId && state !== "play" ? itemById.get(hoverId) : undefined;
    if (tip) {
      g.font = font(12, 500);
      const maxW = Math.min(260, w - 24);
      let title = tip.title;
      while (g.measureText(title).width > maxW && title.length > 4) title = title.slice(0, -2);
      if (title !== tip.title) title = `${title.trimEnd()}…`;
      const tw = Math.max(g.measureText(title).width, 60) + 16;
      const bx = Math.max(cam + 6, Math.min(cam + w - tw - 6, tip.x - tw / 2));
      const by = Math.max(4, tip.y - 58);
      g.fillStyle = T.background;
      g.strokeStyle = T.line;
      g.lineWidth = 1;
      g.beginPath();
      g.roundRect(Math.round(bx) + 0.5, by + 0.5, Math.round(tw), 40, 2);
      g.fill();
      g.stroke();
      g.textAlign = "left";
      g.fillStyle = T.muted;
      g.font = font(11);
      g.fillText(`${tip.kind} · ${tip.date}`, bx + 8, by + 15);
      g.fillStyle = T.text;
      g.font = font(12, 500);
      g.fillText(title, bx + 8, by + 32);
    }
    g.restore();
  }

  function drawTrack(): void {
    const w = trackW;
    const s = trackScale();
    const base = 12.5;
    const X = (x: number): number => 2 + x * s;
    tg.clearRect(0, 0, w, 30);
    tg.fillStyle = T.selection;
    tg.beginPath();
    tg.roundRect(X(cam), 1, Math.max(8, viewW * s), 21, 2);
    tg.fill();
    tg.strokeStyle = T.line;
    tg.lineWidth = 1;
    tg.beginPath();
    tg.moveTo(0, base);
    tg.lineTo(w, base);
    tg.stroke();
    tg.strokeStyle = T.muted;
    tg.beginPath();
    for (const stage of stages) {
      const x = Math.round(X(stage.x)) + 0.5;
      tg.moveTo(x, base - 7);
      tg.lineTo(x, base);
    }
    tg.stroke();
    tg.setLineDash([2, 2]);
    tg.beginPath();
    for (const lane of lanes) {
      const y = base - 4 - lane.lane * 3 + 0.5;
      tg.moveTo(X(lane.x1), y);
      tg.lineTo(X(lane.x2), y);
    }
    tg.stroke();
    tg.setLineDash([]);
    const focusId = seekId ?? hoverId;
    for (const item of items) {
      const got = collected.has(item.id);
      tg.fillStyle = got ? T.link : item.id === focusId ? T.text : T.muted;
      tg.beginPath();
      tg.arc(X(item.x), base + 4, got ? 2 : 1.6, 0, Math.PI * 2);
      tg.fill();
    }
    tg.fillStyle = T.muted;
    tg.strokeStyle = T.muted;
    tg.font = font(10);
    tg.textAlign = "left";
    const yearX = (year: number): number => X(xAt(monthIndex(`Jan ${year}`)));
    for (const year of YEARS) {
      const x = Math.round(yearX(year)) + 0.5;
      tg.beginPath();
      tg.moveTo(x, base);
      tg.lineTo(x, base + 3);
      tg.stroke();
      const gap = yearX(year + 1) - yearX(year);
      if (gap >= 30 || (gap >= 15 && year % 2 === 0)) {
        tg.fillText(gap < 34 ? `’${String(year).slice(2)}` : String(year), x + 2, 28);
      }
    }
    const gx = Math.round(X(GOAL_X)) + 0.5;
    tg.strokeStyle = T.text;
    tg.lineWidth = 1.25;
    tg.beginPath();
    tg.moveTo(gx, base);
    tg.lineTo(gx, base - 9);
    tg.lineTo(gx + 5, base - 7);
    tg.lineTo(gx, base - 5);
    tg.stroke();
    tg.fillStyle = T["corgi-coat"];
    tg.strokeStyle = T["corgi-ink"];
    tg.lineWidth = 1;
    tg.beginPath();
    tg.arc(X(c.x + 26), base, 3.2, 0, Math.PI * 2);
    tg.fill();
    tg.stroke();
  }

  let onScreen = false;
  let running = false;
  let last = 0;
  let quietT = 0;
  const IDLE_SECONDS = reduceMotion ? 0 : 4;
  const busy = (): boolean =>
    state === "play" ||
    drag !== null ||
    trackDrag !== null ||
    !c.onGround ||
    camTarget !== cam ||
    floats.length + rings.length + dust.length > 0 ||
    (state === "goal" && goalT < 1);
  function frame(t: number): void {
    if (!onScreen || document.hidden) {
      running = false;
      return;
    }
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    update(dt);
    draw();
    drawTrack();
    quietT = busy() ? 0 : quietT + dt;
    if (quietT > IDLE_SECONDS) {
      running = false;
      return;
    }
    requestAnimationFrame(frame);
  }
  function wake(): void {
    quietT = 0;
    if (running || !onScreen || document.hidden) return;
    running = true;
    requestAnimationFrame((t) => {
      last = t;
      frame(t);
    });
  }
  new IntersectionObserver(([entry]) => {
    onScreen = entry?.isIntersecting ?? false;
    if (onScreen) wake();
    else setPaused(true);
  }).observe(stageEl);

  for (const id of record.last ?? []) {
    if (!itemById.has(id)) continue;
    collected.add(id);
    markEntry(id, true);
  }
  setCount(collected.size);
  showRecord();
  updateHud();
}
