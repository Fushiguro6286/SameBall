import { useSyncExternalStore } from "react";
import { en, type Dict } from "./en";
import { DICTS, lang, subscribeLang, type Lang } from "./index";

// Both hooks return English while hydrating (the server always renders English), then the chosen language.
// Components must render text from useT(), not the module-level `t`: a late-streamed boundary can hydrate
// after the switch, and reading `t` there would mismatch the server HTML.
export const useLang = (): Lang => useSyncExternalStore(subscribeLang, () => lang, () => "en");
export const useT = (): Dict => useSyncExternalStore(subscribeLang, () => DICTS[lang], () => en);
