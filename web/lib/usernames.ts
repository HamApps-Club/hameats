/**
 * Usernames: what other students see instead of a real name. The rules here are shared by the browser (the live check
 * while someone types) and the server (the check that counts). The database's unique index on lower(username) is what
 * finally guarantees no two people share one, whatever the capitals.
 */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
const PATTERN = /^[A-Za-z0-9_]+$/;

/** Names nobody can take, so no one can pass for the site, its staff or a dining hall. Compared without capitals. */
const RESERVED = new Set([
  "admin",
  "administrator",
  "root",
  "system",
  "staff",
  "support",
  "help",
  "mod",
  "moderator",
  "official",
  "hamilton",
  "hamiltoncollege",
  "dining",
  "bonappetit",
  "commons",
  "sopercommons",
  "soper",
  "mcewen",
  "diner",
  "howarddiner",
  "pub",
  "littlepub",
  "me",
  "you",
  "null",
  "undefined",
  "anonymous",
  "student",
  "deleted",
]);
/** Words that make a name look official wherever they appear in it. */
const RESERVED_PARTS = ["hameats", "admin", "moderator", "official"];

/** Why a name can't be used, in words someone can act on, or null when it follows the rules. Doesn't check whether it's taken. */
export function usernameProblem(name: string): string | null {
  if (name.length < USERNAME_MIN || name.length > USERNAME_MAX) return `Use ${USERNAME_MIN} to ${USERNAME_MAX} characters.`;
  if (!PATTERN.test(name)) return "Letters, numbers and underscores only.";
  const lower = name.toLowerCase();
  if (RESERVED.has(lower) || RESERVED_PARTS.some((part) => lower.includes(part))) return "That username is taken.";
  return null;
}

const ADJECTIVES = [
  "crispy",
  "saucy",
  "golden",
  "toasty",
  "zesty",
  "spicy",
  "savory",
  "cheesy",
  "crunchy",
  "smoky",
  "tangy",
  "buttery",
  "peppery",
  "herby",
  "hearty",
  "fluffy",
  "juicy",
  "minty",
  "sweet",
  "salty",
];
const NOUNS = [
  "haddock",
  "tater",
  "riggies",
  "waffle",
  "bagel",
  "pancake",
  "noodle",
  "dumpling",
  "taco",
  "burrito",
  "pretzel",
  "muffin",
  "biscuit",
  "nacho",
  "falafel",
  "pierogi",
  "ravioli",
  "risotto",
  "pickle",
  "crouton",
  "meatball",
  "omelet",
  "scone",
  "sundae",
];

/**
 * A random name for someone's first login, like "crispy_haddock_482". It's made from food words and a number, never
 * from the person's name or email, so it gives nothing away about who they are. `random` is there for tests.
 */
export function randomUsername(random: () => number = Math.random): string {
  const pick = <T,>(list: T[]) => list[Math.floor(random() * list.length)];
  for (;;) {
    const name = `${pick(ADJECTIVES)}_${pick(NOUNS)}_${100 + Math.floor(random() * 900)}`;
    if (name.length <= USERNAME_MAX && !usernameProblem(name)) return name;
  }
}
