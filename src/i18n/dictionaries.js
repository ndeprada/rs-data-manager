import { buildDictionaries, makeTranslate } from "./translate.js";
import common from "./rows/common.js";
import player from "./rows/player.js";
import catalog from "./rows/catalog.js";
import staff from "./rows/staff.js";
import screens from "./rows/screens.js";

export const ALL_ROWS = [...common, ...player, ...staff, ...catalog, ...screens];
export const DICTIONARIES = buildDictionaries(ALL_ROWS);
export const translate = makeTranslate(DICTIONARIES);
