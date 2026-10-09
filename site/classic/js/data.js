// Loads generated content from data/ (index.json + one file per set) and offers lookups.

import { tagSlug } from "./util.js";

let cache = null;

export async function loadAll() {
  if (cache) return cache;
  const idx = await fetch("data/index.json").then((r) => {
    if (!r.ok) throw new Error("data/index.json not found — run: npm run import");
    return r.json();
  });
  const sets = await Promise.all(idx.sets.map((s) => fetch(`data/${s.id}.json`).then((r) => r.json())));
  const problems = [];
  for (const set of sets) for (const p of set.problems)
    problems.push({ ...p, set: set.id, key: `${set.id}/${p.id}`, group: groupLabel(set, p.tier, p.tier_title) });
  const tags = new Map();
  for (const p of problems) for (const t of p.tags) {
    const k = tagSlug(t);
    if (!tags.has(k)) tags.set(k, { slug: k, name: t, problems: [] });
    tags.get(k).problems.push(p);
  }
  cache = {
    sets,
    problems,
    tags: [...tags.values()].sort((a, b) => b.problems.length - a.problems.length || a.name.localeCompare(b.name)),
    setById: (id) => sets.find((s) => s.id === id),
    problem: (setId, slug) => problems.find((p) => p.set === setId && (p.slug === slug || p.id === slug)),
    byKey: (key) => problems.find((p) => p.key === key),
  };
  return cache;
}

// Sets are split into difficulty tiers ("Tier A") or interview patterns ("Topic 3 — Joins").
export const groupLabel = (set, id, title) => (set.group_kind === "Topic" ? title : `Tier ${id}`);
export const groupNoun = (set) => (set.group_kind === "Topic" ? "Topic" : "Tier");

export const problemHref = (p, tab = "") => `#/p/${p.set}/${p.slug}${tab ? "/" + tab : ""}`;
export const setHref = (s) => `#/set/${s.id ?? s}`;
export const tierHref = (setId, tier) => `#/category/tier/${setId}-${tier.toLowerCase()}`;
export const tagHref = (t) => `#/category/tag/${tagSlug(t)}`;
