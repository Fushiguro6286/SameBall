import { en, type Dict } from "./en";
import { hi } from "./hi";

export type Lang = "en" | "hi";
export const DICTS: Record<Lang, Dict> = { en, hi };

/**
 * The current dictionary. A live ES-module binding: setLang() swaps it in the browser, after hydration.
 * The server always renders English. Client components that render text read `t` directly; each client
 * root (a client component placed by a server component) calls useLang() so its subtree re-renders on a switch.
 */
export let t: Dict = en;
export let lang: Lang = "en";

const subs = new Set<() => void>();
export function setLang(l: Lang) {
  if (l === lang) return;
  lang = l;
  t = DICTS[l];
  subs.forEach((f) => f());
}
export function subscribeLang(f: () => void) {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
}

type StrPaths<T> = {
  [K in keyof T & string]: T[K] extends string
    ? K
    : T[K] extends (...a: never[]) => unknown
      ? never
      : T[K] extends readonly (infer E)[]
        ? `${K}.${number}.${StrPaths<E>}`
        : T[K] extends object
          ? `${K}.${StrPaths<T[K]>}`
          : never;
}[keyof T & string];

/** Dotted path to a plain string in the dictionary, e.g. "landing.heroTitle" or "landing.steps.0.title". */
export type TextKey = StrPaths<Dict>;

export const textAt = (d: Dict, k: TextKey): string => k.split(".").reduce<unknown>((o, p) => (o as Record<string, unknown>)?.[p], d) as string;
