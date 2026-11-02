import { DataSet, RegExpMatcher, englishDataset, englishRecommendedTransformers, pattern } from "obscenity";

// Curse words and slurs aren't allowed in anything students write on HamEats: posts, comments, reviews and usernames.
// The obscenity library catches disguised spellings too (f*ck, sh1t, fuuuck, letters swapped for look-alikes) while
// leaving innocent words alone ("class", "Scunthorpe"). Its English list covers strong curse words and slurs; the few
// milder curse words it leaves out are added below, and food words it would otherwise catch are allowed.

const dataset = new DataSet<{ originalWord: string }>()
  .addAll(englishDataset)
  // Milder curse words and insults the English list leaves out. "|" marks a word edge, so "damnit" counts but
  // "crappie" doesn't. Text has doubled letters squeezed to one before matching, so these are written that way too
  // ("godamn" catches "goddamn", "crapy" catches "crappy").
  .addPhrase((p) => p.setMetadata({ originalWord: "damn" }).addPattern(pattern`|damn`).addPattern(pattern`godamn`).addPattern(pattern`|damit`))
  .addPhrase((p) => p.setMetadata({ originalWord: "crap" }).addPattern(pattern`|crap|`).addPattern(pattern`|crapy|`))
  .addPhrase((p) =>
    p.setMetadata({ originalWord: "ass" }).addPattern(pattern`dumbas`).addPattern(pattern`jackas`).addPattern(pattern`smartas`),
  );

const built = dataset.build();
const matcher = new RegExpMatcher({
  ...built,
  ...englishRecommendedTransformers,
  // Food and dining words that contain a listed word but are fine on a menu app.
  whitelistedTerms: [
    ...(built.whitelistedTerms ?? []),
    "cumin",
    "cucumber",
    "cumberland",
    "shiitake",
    "cocktail",
    "peacock",
    "cockles",
    "hancock",
    "scattered",
    "scatter",
    "assorted",
    "assortment",
  ],
});

/** Whether the text has a curse word or slur in it. */
export function hasBadWords(text: string): boolean {
  // Underscores (as in usernames) count as spaces, so "big_fuck" is caught like "big fuck".
  const spaced = text.replace(/_/g, " ");
  // Words spelled out one letter at a time ("f u c k", "s.h.i.t") are joined back up and checked too.
  const joined = spaced.replace(/\b(?:\w[\s.*-]+){2,}\w\b/g, (letters) => letters.replace(/[\s.*-]+/g, ""));
  return matcher.hasMatch(spaced) || (joined !== spaced && matcher.hasMatch(joined));
}

/** The message shown when something is turned away for its wording. */
export const BAD_WORDS_MESSAGE = "That has a word HamEats doesn't allow. Please reword it.";
