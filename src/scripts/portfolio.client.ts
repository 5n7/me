import { pad2 } from "../lib/format.ts";

type TokyoParts = {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
};

const tokyoPartsFormatter = new Intl.DateTimeFormat("en-US", {
	timeZone: "Asia/Tokyo",
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
	hourCycle: "h23",
});

function tokyoParts(d: Date): TokyoParts {
	const parts: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {};
	for (const p of tokyoPartsFormatter.formatToParts(d)) {
		parts[p.type] = p.value;
	}
	return {
		year: Number(parts.year),
		month: Number(parts.month),
		day: Number(parts.day),
		hour: Number(parts.hour),
		minute: Number(parts.minute),
	};
}

function init(): void {
	initProgress();
	initReveal();
	initClock();
}

function initProgress(): void {
	const fill = document.querySelector<HTMLElement>(".progress-fill");
	if (!fill) return;
	let pending = false;
	let lastRatio = -1;
	const update = (): void => {
		pending = false;
		const h = document.documentElement;
		const max = h.scrollHeight - h.clientHeight;
		const ratio = max > 0 ? Math.min(1, Math.max(0, h.scrollTop / max)) : 0;
		if (ratio === lastRatio) return;
		lastRatio = ratio;
		fill.style.transform = `scaleX(${ratio})`;
	};
	const onScroll = (): void => {
		if (pending) return;
		pending = true;
		requestAnimationFrame(update);
	};
	update();
	window.addEventListener("scroll", onScroll, { passive: true });
}

function initReveal(): void {
	const els = document.querySelectorAll<HTMLElement>(".vB-reveal");
	if (!els.length) return;
	const reduceMotionMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
	if (reduceMotionMQ.matches) {
		els.forEach((el) => el.classList.add("is-in"));
		return;
	}
	els.forEach((el) => el.classList.add("vB-reveal--ready"));
	const io = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					entry.target.classList.add("is-in");
					io.unobserve(entry.target);
				}
			});
		},
		{ rootMargin: "-40px 0px" },
	);
	els.forEach((el) => io.observe(el));
	reduceMotionMQ.addEventListener("change", (e) => {
		if (!e.matches) return;
		io.disconnect();
		els.forEach((el) => el.classList.add("is-in"));
	});
}

function initClock(): void {
	const dayEl = document.querySelector<HTMLElement>("[data-mast-day]");
	const timeEl = document.querySelector<HTMLElement>("[data-mast-time]");
	if (!dayEl && !timeEl) return;
	let lastYear = -1;
	let lastDay = -1;
	let lastHour = -1;
	let lastMinute = -1;
	let cachedDays = 365;
	const tick = (): void => {
		const { year, month, day, hour, minute } = tokyoParts(new Date());
		if (dayEl) {
			if (year !== lastYear) {
				const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
				cachedDays = leap ? 366 : 365;
			}
			if (year !== lastYear || day !== lastDay) {
				const startOfYear = Date.UTC(year, 0, 1);
				const dayUtc = Date.UTC(year, month - 1, day);
				const doy = Math.floor((dayUtc - startOfYear) / 86400000) + 1;
				dayEl.textContent = `Day ${doy}/${cachedDays}`;
			}
		}
		if (timeEl && (hour !== lastHour || minute !== lastMinute)) {
			timeEl.textContent = `${pad2(hour)}:${pad2(minute)} JST`;
		}
		lastYear = year;
		lastDay = day;
		lastHour = hour;
		lastMinute = minute;
	};
	tick();
	setInterval(tick, 60000);
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
	init();
}
