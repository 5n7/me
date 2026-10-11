import { portfolio } from "../data/portfolio.ts";

type CourseItemKind = "Talk" | "Writing" | "Research" | "Award";
export type CourseIcon = "mic" | "article" | "book" | "trophy" | "medal";

export interface CourseItem {
  id: string;
  kind: CourseItemKind;
  icon: CourseIcon;
  title: string;
  meta: string[];
  date: string;
  month: string;
  href?: string;
}

export interface CourseRole {
  role: string;
  org: string;
  start: string;
  end?: string;
  tag?: "Current" | "Side";
  track: "education" | "main" | "side";
}

export interface Course {
  items: CourseItem[];
  roles: CourseRole[];
}

type RunList = "talk" | "writing" | "paper" | "award";

export const runId = (list: RunList, index: number): string => `${list}-${index}`;

const ACADEMIC_YEAR_START = "Apr";
const MID_YEAR = "Jul";

const awardMonth = (date: string): string => {
  const years = date.match(/\d{4}/g) ?? [];
  return `${years.length > 1 ? ACADEMIC_YEAR_START : MID_YEAR} ${years[0]}`;
};

const mainOrg = portfolio.experience.find((entry) => entry.tag === "Current")?.org;

export const course: Course = {
  items: [
    ...portfolio.talks.map((talk, i): CourseItem => ({
      id: runId("talk", i),
      kind: "Talk",
      icon: "mic",
      title: talk.title,
      meta: [talk.venue, talk.highlight].filter((value) => value !== undefined),
      date: talk.date,
      month: talk.date,
      href: talk.href,
    })),
    ...portfolio.publications.map((article, i): CourseItem => ({
      id: runId("writing", i),
      kind: "Writing",
      icon: "article",
      title: article.title,
      meta: [article.venue],
      date: article.date,
      month: article.date,
      href: article.href,
    })),
    ...portfolio.academic.map((paper, i): CourseItem => ({
      id: runId("paper", i),
      kind: "Research",
      icon: "book",
      title: paper.title,
      meta: [paper.venue],
      date: paper.date,
      month: paper.date,
    })),
    ...portfolio.awards.map((award, i): CourseItem => ({
      id: runId("award", i),
      kind: "Award",
      icon: /scholarship/i.test(award.title) ? "medal" : "trophy",
      title: award.title,
      meta: [award.org],
      date: award.date,
      month: awardMonth(award.date),
    })),
  ],
  roles: [
    ...portfolio.education.map((entry): CourseRole => ({
      role: entry.degree,
      org: entry.org,
      start: entry.start,
      end: entry.end,
      track: "education",
    })),
    ...portfolio.experience.map((entry): CourseRole => ({
      role: entry.role,
      org: entry.org,
      start: entry.start,
      end: entry.end,
      tag: entry.tag,
      track: entry.org === mainOrg ? "main" : "side",
    })),
  ],
};
