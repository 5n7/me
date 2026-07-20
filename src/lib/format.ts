// Detects any Japanese kana or CJK ideograph so titles can carry lang="ja".
export const isJapanese = (s: string): boolean => /[　-ヿ一-鿿]/.test(s);

const MONTHS: Record<string, number> = {
	Jan: 0,
	Feb: 1,
	Mar: 2,
	Apr: 3,
	May: 4,
	Jun: 5,
	Jul: 6,
	Aug: 7,
	Sep: 8,
	Oct: 9,
	Nov: 10,
	Dec: 11,
};

// Returns the whole months from the start month to the end month of a
// "MMM YYYY — MMM YYYY|Present" range (end-exclusive: "Jan — Mar 2025" = 2).
// "Present" resolves to `now` (the build date, read in UTC so the width is
// independent of the build machine's timezone) so tenure bars grow with time.
export const parseRangeMonths = (range: string, now: Date = new Date()): number => {
	const point = (raw: string): { y: number; m: number } | null => {
		const s = raw.trim();
		if (/present/i.test(s)) return { y: now.getUTCFullYear(), m: now.getUTCMonth() };
		const my = s.match(/([A-Za-z]{3})\s+(\d{4})/);
		// `?? 0` silently maps unknown month tokens to January (self-authored
		// data, acceptable).
		if (my) return { y: Number(my[2]), m: MONTHS[my[1]] ?? 0 };
		const yearOnly = s.match(/(\d{4})/);
		if (yearOnly) return { y: Number(yearOnly[1]), m: 0 };
		return null;
	};

	const [startRaw, endRaw] = range.split("—");
	if (startRaw === undefined || endRaw === undefined) return 0;
	const start = point(startRaw);
	const end = point(endRaw);
	if (!start || !end) return 0;
	return Math.max(0, (end.y - start.y) * 12 + (end.m - start.m));
};
