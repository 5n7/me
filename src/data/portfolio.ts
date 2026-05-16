export interface PortfolioLink {
	label: string;
	href: string;
	short: string;
}

export interface PortfolioExperience {
	role: string;
	org: string;
	range: string;
	tag?: "Current" | "Side";
	body: string;
}

export interface PortfolioEducation {
	degree: string;
	org: string;
	range: string;
	body: string;
}

export interface PortfolioTalk {
	title: string;
	venue: string;
	date: string;
	href: string;
}

export interface PortfolioAcademic {
	title: string;
	venue: string;
	date: string;
}

export interface PortfolioPublication {
	title: string;
	venue: string;
	date: string;
	href: string;
}

export interface PortfolioAward {
	title: string;
	org: string;
	date: string;
}

export interface HeroHighlight {
	label: string;
	value: string;
	valueAux?: string;
	foot: string;
}

export interface SiteMetadata {
	title: string;
	description: string;
	ogDescription: string;
	siteUrl: string;
	ogImage: string;
	profileImage: string;
}

export interface Portfolio {
	name: string;
	handleJa: string;
	role: string;
	tagline: string;
	location: string;
	birthplace: string;
	languages: string[];
	interests: string[];
	links: PortfolioLink[];
	experience: PortfolioExperience[];
	education: PortfolioEducation[];
	talks: PortfolioTalk[];
	academic: PortfolioAcademic[];
	publications: PortfolioPublication[];
	awards: PortfolioAward[];
}

export const portfolio: Portfolio = {
	name: "Shunta Komatsu",
	handleJa: "小松 俊太",
	role: "Engineering Manager, Software Engineer, Photographer, Corgi Lover",
	tagline: "Payment platform. AI-native teams. Small businesses",
	location: "Tokyo, Japan",
	birthplace: "Kanagawa, Japan",
	languages: ["Japanese — native", "English — fluent"],
	interests: ["Go", "Observability", "FinTech", "Payment Systems", "Real Estate", "Stocks"],
	links: [
		{ label: "Email", href: "mailto:hi@5n7.me", short: "hi@5n7.me" },
		{
			label: "GitHub",
			href: "https://github.com/5n7",
			short: "github.com/5n7",
		},
		{
			label: "LinkedIn",
			href: "https://www.linkedin.com/in/shuntak",
			short: "linkedin.com/in/shuntak",
		},
		{
			label: "Speaker Deck",
			href: "https://speakerdeck.com/iamshunta",
			short: "speakerdeck.com/iamshunta",
		},
	],
	experience: [
		{
			role: "Engineering Manager",
			org: "Mercari, Inc.",
			range: "Mar 2025 — Present",
			tag: "Current",
			body: "Engineering Manager for two teams in Merpay — Payment Core (since Mar 2025) and Payment Solution (since Jan 2026) — leading 10 engineers in total. Also contributing as an individual contributor on the PCP Foundation team since Mar 2026.",
		},
		{
			role: "Senior Software Engineer",
			org: "RINGBELL, Inc.",
			range: "Jan 2026 — Present",
			tag: "Side",
			body: "Main developer and architect of a marriage agency service in Japan.",
		},
		{
			role: "Chief Technology Officer",
			org: "Yomoyama, Inc.",
			range: "May 2025 — Present",
			tag: "Side",
			body: "Leading full-stack development of a real estate price estimation service.",
		},
		{
			role: "Senior Software Engineer",
			org: "Yomoyama, Inc.",
			range: "Jul 2024 — May 2025",
			body: "Developed a real estate price estimation service.",
		},
		{
			role: "Technical Lead",
			org: "Mercari, Inc.",
			range: "Jul 2024 — Mar 2025",
			body: "Led technical development of Payment Platform in the Payment Core team.",
		},
		{
			role: "Software Engineer",
			org: "Mercari, Inc.",
			range: "Apr 2022 — Jun 2024",
			body: "Joined as a new graduate and worked on developing Payment Platform used company-wide.",
		},
	],
	education: [
		{
			degree: "Master of Science in Computer Science",
			org: "Tokyo University of Science",
			range: "Apr 2020 — Mar 2022",
			body: "Focused on artificial intelligence and machine learning. Conducted research on image processing under Professor Yukinobu Taniguchi.",
		},
		{
			degree: "Bachelor of Science in Computer Science",
			org: "Tokyo University of Science",
			range: "Apr 2016 — Mar 2020",
			body: "Coursework in information engineering and statistics. Conducted research on image processing under Professor Yukinobu Taniguchi.",
		},
	],
	talks: [
		{
			title: "The Journey to AI-Native: Driving Company-Wide Adoption Through Data and Practice",
			venue: "mercari Gears 2025",
			date: "Nov 2025",
			href: "https://speakerdeck.com/mercari/mercari-gears-2025-the-journey-to-ai-native-driving-company-wide-adoption-through-data-and-practice",
		},
		{
			title: "Cursor Meetup Tokyo",
			venue: "Cursor Meetup Tokyo · 6000+ attendees",
			date: "Jun 2025",
			href: "https://speakerdeck.com/iamshunta/cursor-meetup-tokyo",
		},
		{
			title: "The Future of encoding/json",
			venue: "Go Conference mini 2023 Winter in Kyoto",
			date: "Dec 2023",
			href: "https://speakerdeck.com/iamshunta/the-future-of-encoding-json",
		},
		{
			title: "Recap: Automatically Instrument Your Go Source Code with Orchestrion",
			venue: "mercari.go #24 — GopherCon 2023 Recap",
			date: "Sep 2023",
			href: "https://speakerdeck.com/iamshunta/recap-automatically-instrument-your-go-source-code-with-orchestrion",
		},
		{
			title: "Recap: The Future of JSON in Go",
			venue: "Go 1.21.1 Release Party & GopherCon 2023 Recap",
			date: "Sep 2023",
			href: "https://speakerdeck.com/iamshunta/recap-the-future-of-json-in-go",
		},
	],
	academic: [
		{
			title: "Passenger Flow Estimation with Bipartite Matching on Bus Surveillance Cameras",
			venue: "IEEE MIPR 2021",
			date: "Apr 2021",
		},
	],
	publications: [
		{
			title: "Payment Platform の 2025 年: メルカリグループを支える決済基盤のこれまでとこれから",
			venue: "Mercari Engineering Blog",
			date: "Dec 2025",
			href: "https://engineering.mercari.com/blog/entry/20251219-payment-platform-2025/",
		},
		{
			title: "PCP LLM Week: How We Become AI-Native",
			venue: "Mercari Engineering Blog",
			date: "Jun 2025",
			href: "https://engineering.mercari.com/blog/entry/20250604-pcp-llm-week/",
		},
		{
			title: "事業者請求払い: 多様な決済を支える決済基盤の仕組み",
			venue: "Mercari Engineering Blog",
			date: "Dec 2024",
			href: "https://engineering.mercari.com/blog/entry/20241221-invoice-payment/",
		},
		{
			title: "決済基盤の Observability を向上するための Datadog Dashboard の進化",
			venue: "Mercari Engineering Blog",
			date: "Dec 2023",
			href: "https://engineering.mercari.com/blog/entry/20231220-datadog-dashboard-for-observability/",
		},
		{
			title: "メルペイ決済基盤における Source Payment による決済手段の抽象化",
			venue: "Mercari Engineering Blog",
			date: "Jun 2023",
			href: "https://engineering.mercari.com/blog/entry/20230613-source-payment/",
		},
	],
	awards: [
		{
			title: "First Place, Yogen Kaigi #4",
			org: "Mercari, Inc. — Internal business contest",
			date: "2025",
		},
		{
			title: "FT Tech PR Award 2025",
			org: "Awarded by Shunya Kimura, CTO of Mercari, Inc.",
			date: "2025",
		},
		{
			title: "Best Presentation Award",
			org: "Art Science Forum",
			date: "2022",
		},
		{
			title: "Full Exemption Scholarship",
			org: "Japan Student Services Organization (JASSO)",
			date: "2020 — 2022",
		},
	],
};

export const heroHighlights: HeroHighlight[] = [
	{
		label: "Now",
		value: "Merpay",
		valueAux: "/ EM + IC",
		foot: "2 teams · 10 engineers",
	},
	{
		label: "Side",
		value: "Yomoyama",
		valueAux: "/ CTO",
		foot: "Real estate pricing",
	},
	{
		label: "Side",
		value: "RINGBELL",
		valueAux: "/ Sr. SWE",
		foot: "Marriage agency platform",
	},
	{
		label: "Based",
		value: "Tokyo, JP",
		foot: "UTC+09:00 · ja/en",
	},
];

export const siteMetadata: SiteMetadata = {
	title: "Shunta Komatsu — 5n7.me",
	description:
		"Shunta Komatsu — Engineering Manager at Merpay, CTO at Yomoyama, Sr. SWE at RINGBELL. Payment platform, AI-native teams, and small businesses. Based in Tokyo.",
	ogDescription: "EM at Merpay. CTO at Yomoyama. Sr. SWE at RINGBELL. Based in Tokyo.",
	siteUrl: "https://5n7.me",
	ogImage: "https://5n7.me/og.png",
	profileImage: "https://5n7.me/profile.webp",
};
