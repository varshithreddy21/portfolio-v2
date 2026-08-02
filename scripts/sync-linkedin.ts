/**
 * sync-linkedin.ts
 *
 * Scrapes a public LinkedIn profile and merges it into src/data/profile.json.
 *
 * Usage:
 *   npm run sync:linkedin https://www.linkedin.com/in/username/
 *   npm run sync:linkedin ./saved-profile.html
 *
 * How it works:
 *   1. If given a URL: opens it in your default browser, waits for you to
 *      save the page as HTML, then parses the saved file.
 *   2. If given a file path: parses the HTML file directly.
 *
 * This approach bypasses LinkedIn's HTTP 999 bot detection because the page
 * is loaded by your real browser with real cookies and fingerprint.
 *
 * What gets overwritten (from LinkedIn):
 *   name, headline, location, about, avatar, experience, education, skills, socials
 *
 * What gets preserved (not on public LinkedIn):
 *   email, phone, resumeUrl, stats, experience.highlights, experience.tech,
 *   skills[].items[].level, projects[].tags, projects[].featured, projects[].image, projects[].repo
 */

import { scrapeProfileFromHtml, type LinkedInProfile } from "linkedin-scraper";
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { downloadFile } from "./utils/download";
import { execSync } from "node:child_process";
import * as readline from "node:readline/promises";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProfileData {
  name: string;
  firstName: string;
  headline: string;
  location?: string;
  email: string;
  phone?: string;
  avatar?: string;
  resumeUrl?: string;
  about: string;
  stats?: Array<{ label: string; value: string }>;
  experience: Array<{
    title: string;
    company: string;
    companyUrl?: string;
    location?: string;
    startDate: string;
    endDate: string;
    current: boolean;
    description: string;
    highlights: string[];
    tech?: string[];
  }>;
  projects: Array<{
    name: string;
    description: string;
    longDescription?: string;
    url?: string;
    repo?: string;
    tags: string[];
    featured: boolean;
    image?: string;
  }>;
  skills: Array<{
    category: string;
    icon?: string;
    items: Array<{ name: string; level?: number }>;
  }>;
  education: Array<{
    institution: string;
    degree: string;
    field?: string;
    startDate: string;
    endDate: string;
    description?: string;
  }>;
  socials: Array<{ label: string; url: string; icon: string }>;
}

// ─── Skill Categorization ────────────────────────────────────────────────────

const SKILL_CATEGORIES: Record<string, { category: string; icon: string }> = {
  // Languages
  typescript: { category: "Languages", icon: "code" },
  javascript: { category: "Languages", icon: "code" },
  python: { category: "Languages", icon: "code" },
  java: { category: "Languages", icon: "code" },
  go: { category: "Languages", icon: "code" },
  golang: { category: "Languages", icon: "code" },
  rust: { category: "Languages", icon: "code" },
  c: { category: "Languages", icon: "code" },
  "c++": { category: "Languages", icon: "code" },
  "c#": { category: "Languages", icon: "code" },
  php: { category: "Languages", icon: "code" },
  ruby: { category: "Languages", icon: "code" },
  swift: { category: "Languages", icon: "code" },
  kotlin: { category: "Languages", icon: "code" },
  scala: { category: "Languages", icon: "code" },
  sql: { category: "Languages", icon: "code" },
  bash: { category: "Languages", icon: "code" },
  shell: { category: "Languages", icon: "code" },

  // Frontend
  react: { category: "Frontend", icon: "layout" },
  "react.js": { category: "Frontend", icon: "layout" },
  "reactjs": { category: "Frontend", icon: "layout" },
  vue: { category: "Frontend", icon: "layout" },
  "vue.js": { category: "Frontend", icon: "layout" },
  "vuejs": { category: "Frontend", icon: "layout" },
  angular: { category: "Frontend", icon: "layout" },
  svelte: { category: "Frontend", icon: "layout" },
  astro: { category: "Frontend", icon: "layout" },
  nextjs: { category: "Frontend", icon: "layout" },
  "next.js": { category: "Frontend", icon: "layout" },
  "nuxt": { category: "Frontend", icon: "layout" },
  html: { category: "Frontend", icon: "layout" },
  css: { category: "Frontend", icon: "layout" },
  "tailwind": { category: "Frontend", icon: "layout" },
  "tailwindcss": { category: "Frontend", icon: "layout" },
  "tailwind css": { category: "Frontend", icon: "layout" },
  sass: { category: "Frontend", icon: "layout" },
  scss: { category: "Frontend", icon: "layout" },
  "redux": { category: "Frontend", icon: "layout" },
  "webpack": { category: "Frontend", icon: "layout" },
  "vite": { category: "Frontend", icon: "layout" },
  "jquery": { category: "Frontend", icon: "layout" },

  // Backend
  "node.js": { category: "Backend", icon: "server" },
  nodejs: { category: "Backend", icon: "server" },
  node: { category: "Backend", icon: "server" },
  express: { category: "Backend", icon: "server" },
  "express.js": { category: "Backend", icon: "server" },
  graphql: { category: "Backend", icon: "server" },
  "rest api": { category: "Backend", icon: "server" },
  rest: { category: "Backend", icon: "server" },
  api: { category: "Backend", icon: "server" },
  django: { category: "Backend", icon: "server" },
  flask: { category: "Backend", icon: "server" },
  "fastapi": { category: "Backend", icon: "server" },
  spring: { category: "Backend", icon: "server" },
  "spring boot": { category: "Backend", icon: "server" },
  rails: { category: "Backend", icon: "server" },
  "ruby on rails": { category: "Backend", icon: "server" },
  postgresql: { category: "Backend", icon: "server" },
  postgres: { category: "Backend", icon: "server" },
  mysql: { category: "Backend", icon: "server" },
  mongodb: { category: "Backend", icon: "server" },
  mongo: { category: "Backend", icon: "server" },
  redis: { category: "Backend", icon: "server" },
  elasticsearch: { category: "Backend", icon: "server" },
  kafka: { category: "Backend", icon: "server" },
  rabbitmq: { category: "Backend", icon: "server" },
  grpc: { category: "Backend", icon: "server" },
  microservices: { category: "Backend", icon: "server" },

  // DevOps & Cloud
  aws: { category: "DevOps & Cloud", icon: "cloud" },
  gcp: { category: "DevOps & Cloud", icon: "cloud" },
  azure: { category: "DevOps & Cloud", icon: "cloud" },
  docker: { category: "DevOps & Cloud", icon: "cloud" },
  kubernetes: { category: "DevOps & Cloud", icon: "cloud" },
  k8s: { category: "DevOps & Cloud", icon: "cloud" },
  terraform: { category: "DevOps & Cloud", icon: "cloud" },
  ansible: { category: "DevOps & Cloud", icon: "cloud" },
  jenkins: { category: "DevOps & Cloud", icon: "cloud" },
  "ci/cd": { category: "DevOps & Cloud", icon: "cloud" },
  cicd: { category: "DevOps & Cloud", icon: "cloud" },
  "github actions": { category: "DevOps & Cloud", icon: "cloud" },
  gitlab: { category: "DevOps & Cloud", icon: "cloud" },
  linux: { category: "DevOps & Cloud", icon: "cloud" },
  nginx: { category: "DevOps & Cloud", icon: "cloud" },
  helm: { category: "DevOps & Cloud", icon: "cloud" },
  prometheus: { category: "DevOps & Cloud", icon: "cloud" },
  grafana: { category: "DevOps & Cloud", icon: "cloud" },
  serverless: { category: "DevOps & Cloud", icon: "cloud" },
  lambda: { category: "DevOps & Cloud", icon: "cloud" },
};

function categorizeSkills(rawSkills: string[]): ProfileData["skills"] {
  const buckets: Record<string, Array<{ name: string; level?: number }>> = {};
  const categoryMeta: Record<string, { icon: string }> = {};

  for (const skill of rawSkills) {
    const key = skill.toLowerCase().trim();
    const cat = SKILL_CATEGORIES[key];
    const categoryName = cat?.category ?? "Other";
    const icon = cat?.icon ?? "sparkles";

    if (!buckets[categoryName]) {
      buckets[categoryName] = [];
      categoryMeta[categoryName] = { icon };
    }
    buckets[categoryName].push({ name: skill.trim() });
  }

  const order = ["Languages", "Frontend", "Backend", "DevOps & Cloud", "Other"];
  return order
    .filter((cat) => buckets[cat])
    .map((cat) => ({
      category: cat,
      icon: categoryMeta[cat]?.icon ?? "sparkles",
      items: buckets[cat],
    }));
}

// ─── Date Parsing ────────────────────────────────────────────────────────────

const MONTH_MAP: Record<string, string> = {
  jan: "01", january: "01",
  feb: "02", february: "02",
  mar: "03", march: "03",
  apr: "04", april: "04",
  may: "05",
  jun: "06", june: "06",
  jul: "07", july: "07",
  aug: "08", august: "08",
  sep: "09", september: "09",
  oct: "10", october: "10",
  nov: "11", november: "11",
  dec: "12", december: "12",
};

function parseLinkedInDate(raw?: string): string {
  if (!raw) return "";
  const lower = raw.toLowerCase().trim();

  // "Present" or "Current"
  if (lower.includes("present") || lower.includes("current")) return "";

  // Patterns: "Jan 2023", "January 2023", "2023", "Jan 2023 - Present"
  const match = lower.match(/(\d{4})/);
  if (!match) return raw;

  const year = match[1];
  const monthMatch = lower.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/);
  const month = monthMatch ? MONTH_MAP[monthMatch[1]] : "01";

  return `${year}-${month}`;
}

function parseDateRange(dates?: { start?: string; end?: string; current?: boolean; raw?: string }): {
  startDate: string;
  endDate: string;
  current: boolean;
} {
  if (!dates) return { startDate: "", endDate: "", current: false };

  const startDate = parseLinkedInDate(dates.start) || parseLinkedInDate(dates.raw?.split("-")[0]);
  const endDate = dates.current ? "" : parseLinkedInDate(dates.end) || parseLinkedInDate(dates.raw?.split("-")[1]);
  const current = dates.current || (!dates.end && !dates.raw?.includes("-"));

  return { startDate, endDate, current };
}

// ─── Social Detection ────────────────────────────────────────────────────────

function detectSocials(
  websites: string[],
  linkedinUrl: string
): ProfileData["socials"] {
  const socials: ProfileData["socials"] = [];
  const seen = new Set<string>();

  function addIfNew(label: string, url: string, icon: string) {
    const key = icon;
    if (!seen.has(key)) {
      socials.push({ label, url, icon });
      seen.add(key);
    }
  }

  for (const url of websites) {
    const lower = url.toLowerCase();
    if (lower.includes("github.com")) {
      addIfNew("GitHub", url, "github");
    } else if (lower.includes("twitter.com") || lower.includes("x.com")) {
      addIfNew("Twitter", url, "twitter");
    } else if (lower.includes("linkedin.com")) {
      addIfNew("LinkedIn", url, "linkedin");
    } else if (lower.includes("mailto:") || lower.includes("@")) {
      addIfNew("Email", url, "mail");
    }
  }

  // Always ensure LinkedIn is present
  addIfNew("LinkedIn", linkedinUrl, "linkedin");

  return socials;
}

// ─── Avatar Download ─────────────────────────────────────────────────────────

async function downloadAvatar(
  pictureUrl: string | undefined,
  projectRoot: string
): Promise<string | undefined> {
  if (!pictureUrl) return undefined;

  const avatarDir = join(projectRoot, "public", "images");
  const avatarPath = join(avatarDir, "avatar-linkedin.jpg");

  try {
    mkdirSync(avatarDir, { recursive: true });
    await downloadFile(pictureUrl, avatarPath);
    return "/images/avatar-linkedin.jpg";
  } catch (err) {
    console.warn(`  ⚠ Could not download avatar: ${(err as Error).message}`);
    return undefined;
  }
}

// ─── Merge Logic ─────────────────────────────────────────────────────────────

function mergeProfile(
  existing: ProfileData,
  linkedin: LinkedInProfile,
  avatarPath: string | undefined
): { merged: ProfileData; updated: string[]; preserved: string[] } {
  const updated: string[] = [];
  const preserved: string[] = [];
  const merged: ProfileData = { ...existing };

  // Name + firstName
  if (linkedin.name) {
    merged.name = linkedin.name;
    merged.firstName = linkedin.name.split(" ")[0];
    updated.push("name", "firstName");
  }

  // Headline
  if (linkedin.headline) {
    merged.headline = linkedin.headline;
    updated.push("headline");
  }

  // Location
  if (linkedin.location) {
    merged.location = linkedin.location;
    updated.push("location");
  }

  // About / summary
  if (linkedin.summary) {
    merged.about = linkedin.summary;
    updated.push("about");
  }

  // Avatar
  if (avatarPath) {
    merged.avatar = avatarPath;
    updated.push("avatar");
  }

  // Experience
  if (linkedin.positions.length > 0) {
    merged.experience = linkedin.positions.map((pos) => {
      const { startDate, endDate, current } = parseDateRange(pos.dates);
      return {
        title: pos.title || "",
        company: pos.companyName || "",
        companyUrl: pos.companyUrl,
        location: pos.locality,
        startDate,
        endDate,
        current,
        description: pos.description || "",
        highlights: [],
        tech: [],
      };
    });
    updated.push("experience");
  } else {
    preserved.push("experience (LinkedIn returned none)");
  }

  // Education
  if (linkedin.educations.length > 0) {
    merged.education = linkedin.educations.map((edu) => {
      const { startDate, endDate } = parseDateRange(edu.dates);
      return {
        institution: edu.school || "",
        degree: edu.degree || "",
        field: edu.fieldOfStudy,
        startDate,
        endDate,
        description: edu.description,
      };
    });
    updated.push("education");
  } else {
    preserved.push("education (LinkedIn returned none)");
  }

  // Skills
  if (linkedin.skills.length > 0) {
    merged.skills = categorizeSkills(linkedin.skills);
    updated.push("skills (auto-categorized)");
  } else {
    preserved.push("skills (LinkedIn returned none)");
  }

  // Projects — only overwrite if LinkedIn returned some
  if (linkedin.projects.length > 0) {
    merged.projects = linkedin.projects.map((proj) => ({
      name: proj.name || "",
      description: proj.description || "",
      url: proj.url,
      tags: [],
      featured: false,
    }));
    updated.push("projects");
  } else {
    preserved.push("projects (LinkedIn returned none)");
  }

  // Socials
  merged.socials = detectSocials(linkedin.websites, linkedin.publicProfileUrl);
  updated.push("socials");

  // Fields that are never on public LinkedIn
  preserved.push(
    "email, phone, resumeUrl",
    "stats (Years Experience, Projects Shipped, etc.)",
    "experience[].highlights (bullet point achievements)",
    "experience[].tech (tech stack per job)",
    "skills[].items[].level (proficiency percentages)",
    "projects[].tags, projects[].featured, projects[].image, projects[].repo"
  );

  return { merged, updated, preserved };
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

const COLORS = {
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
  reset: "\x1b[0m",
  bold: "\x1b[1m",
};

async function main() {
  const url = process.argv[2];

  if (!url) {
    console.error(`${COLORS.red}Error: LinkedIn URL or HTML file path required${COLORS.reset}`);
    console.error(`Usage:`);
    console.error(`  npm run sync:linkedin https://www.linkedin.com/in/username/`);
    console.error(`  npm run sync:linkedin ./saved-profile.html`);
    process.exit(1);
  }

  const isUrl = url.startsWith("http");
  const isFile = existsSync(resolve(url));

  if (!isUrl && !isFile) {
    console.error(`${COLORS.red}Error: Not a valid LinkedIn URL or HTML file${COLORS.reset}`);
    console.error(`Provide either a LinkedIn URL or a path to a saved HTML file.`);
    process.exit(1);
  }

  const projectRoot = resolve(dirname(new URL(import.meta.url).pathname), "..");
  const profilePath = join(projectRoot, "src", "data", "profile.json");

  console.log(`${COLORS.bold}${COLORS.cyan}LinkedIn → profile.json Sync${COLORS.reset}\n`);
  console.log(`${COLORS.dim}URL: ${url}${COLORS.reset}`);
  console.log(`${COLORS.dim}Target: src/data/profile.json${COLORS.reset}\n`);

  // Load existing profile
  let existingRaw: { profile: ProfileData };
  try {
    existingRaw = JSON.parse(readFileSync(profilePath, "utf-8"));
  } catch {
    console.error(`${COLORS.red}Error: Could not read src/data/profile.json${COLORS.reset}`);
    process.exit(1);
  }

  const existing = existingRaw.profile;

  let linkedin: LinkedInProfile;
  let htmlPath: string;

  // Determine if input is a URL or a file path
  if (url.startsWith("http")) {
    // URL mode: open in browser, let user save the HTML
    const tempPath = join(projectRoot, "linkedin-profile.html");

    console.log(`${COLORS.bold}${COLORS.cyan}Opening LinkedIn profile in your browser...${COLORS.reset}`);
    console.log(`${COLORS.dim}URL: ${url}${COLORS.reset}\n`);

    // Open the URL in the default browser
    try {
      execSync(`open "${url}"`);
    } catch {
      console.error(`${COLORS.red}Could not open browser. Please open this URL manually:${COLORS.reset}`);
      console.error(`  ${url}`);
    }

    console.log(`${COLORS.bold}${COLORS.yellow}ACTION REQUIRED:${COLORS.reset}`);
    console.log(`  1. Wait for the LinkedIn profile to fully load`);
    console.log(`  2. Scroll down to load all sections (experience, education, skills, etc.)`);
    console.log(`  3. Save the page: ${COLORS.bold}Cmd+S${COLORS.reset} → save as "${COLORS.bold}Web Page, HTML Only${COLORS.reset}"`);
    console.log(`  4. Save it to the project root as: ${COLORS.bold}linkedin-profile.html${COLORS.reset}`);
    console.log(`\n  ${COLORS.dim}Waiting for you to save the file...${COLORS.reset}`);

    // Wait for the file to appear
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    while (!existsSync(tempPath)) {
      await new Promise((r) => setTimeout(r, 1000));
    }

    // Give it a moment to finish writing
    await new Promise((r) => setTimeout(r, 500));

    rl.close();
    htmlPath = tempPath;

    console.log(`\n${COLORS.green}  ✓ Found saved HTML file${COLORS.reset}`);
  } else {
    // File mode: parse directly
    htmlPath = resolve(url);
    if (!existsSync(htmlPath)) {
      console.error(`${COLORS.red}Error: HTML file not found: ${htmlPath}${COLORS.reset}`);
      process.exit(1);
    }
    console.log(`${COLORS.dim}Reading HTML from: ${htmlPath}${COLORS.reset}`);
  }

  // Parse the HTML
  const html = readFileSync(htmlPath, "utf-8");
  console.log(`${COLORS.dim}  HTML size: ${(html.length / 1024).toFixed(1)}KB${COLORS.reset}`);
  console.log(`${COLORS.dim}Parsing profile data...${COLORS.reset}`);

  try {
    linkedin = scrapeProfileFromHtml(html, url.startsWith("http") ? url : "https://www.linkedin.com/in/profile");
  } catch (err: any) {
    console.error(`${COLORS.red}Failed to parse HTML: ${err.message}${COLORS.reset}`);
    console.error(`${COLORS.dim}Make sure you saved the page as "HTML Only" (not "Web Page, Complete")${COLORS.reset}`);
    process.exit(1);
  }

  // Clean up temp file
  if (url.startsWith("http") && existsSync(htmlPath)) {
    unlinkSync(htmlPath);
    console.log(`${COLORS.dim}  Cleaned up temp HTML file${COLORS.reset}`);
  }

  // Validate we got something
  if (!linkedin.name && linkedin.positions.length === 0 && linkedin.skills.length === 0) {
    console.error(`\n${COLORS.red}Parsed profile is empty.${COLORS.reset}`);
    console.error(`${COLORS.yellow}Possible causes:${COLORS.reset}`);
    console.error(`  - You saved an auth wall / login page instead of the profile`);
    console.error(`  - You saved as "Web Page, Complete" instead of "HTML Only"`);
    console.error(`  - The profile is private and requires login to view`);
    console.error(`\n${COLORS.yellow}Try:${COLORS.reset} Open the URL in an incognito window first to verify it's public.`);
    process.exit(1);
  }

  console.log(`${COLORS.green}  ✓ Scraped successfully${COLORS.reset}`);
  console.log(`${COLORS.dim}  Sections found: ${linkedin.sectionsPresent.join(", ") || "none"}${COLORS.reset}`);
  console.log(`${COLORS.dim}  Name: ${linkedin.name || "N/A"}${COLORS.reset}`);
  console.log(`${COLORS.dim}  Positions: ${linkedin.positions.length}${COLORS.reset}`);
  console.log(`${COLORS.dim}  Educations: ${linkedin.educations.length}${COLORS.reset}`);
  console.log(`${COLORS.dim}  Skills: ${linkedin.skills.length}${COLORS.reset}`);
  console.log(`${COLORS.dim}  Projects: ${linkedin.projects.length}${COLORS.reset}\n`);

  // Download avatar (with delay to avoid back-to-back requests)
  let avatarPath: string | undefined;
  if (linkedin.pictureUrl) {
    console.log(`${COLORS.dim}  Waiting 3s before avatar download...${COLORS.reset}`);
    await new Promise((r) => setTimeout(r, 3_000));
    console.log(`${COLORS.dim}Downloading avatar...${COLORS.reset}`);
    avatarPath = await downloadAvatar(linkedin.pictureUrl, projectRoot);
    if (avatarPath) {
      console.log(`${COLORS.green}  ✓ Avatar saved to ${avatarPath}${COLORS.reset}\n`);
    }
  }

  // Merge
  const { merged, updated, preserved } = mergeProfile(existing, linkedin, avatarPath);

  // Write
  const output = { profile: merged };
  writeFileSync(profilePath, JSON.stringify(output, null, 2) + "\n", "utf-8");

  // Summary
  console.log(`${COLORS.bold}${COLORS.green}✓ Updated from LinkedIn:${COLORS.reset}`);
  for (const field of updated) {
    console.log(`  ${COLORS.green}→${COLORS.reset} ${field}`);
  }

  console.log(`\n${COLORS.bold}${COLORS.yellow}⚠ Preserved (not available on public LinkedIn):${COLORS.reset}`);
  for (const field of preserved) {
    console.log(`  ${COLORS.yellow}→${COLORS.reset} ${field}`);
  }

  console.log(`\n${COLORS.bold}Done!${COLORS.reset}`);
  console.log(`${COLORS.dim}Review src/data/profile.json and fill in the preserved fields manually.${COLORS.reset}`);
  console.log(`${COLORS.dim}Then run: npm run build${COLORS.reset}`);
}

main().catch((err) => {
  console.error(`${COLORS.red}Unexpected error: ${err.message}${COLORS.reset}`);
  process.exit(1);
});
