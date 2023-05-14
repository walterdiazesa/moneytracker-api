import {
  CATEGORIES,
  PLACE_TO_CAT,
  PLACE_REGEX_TO_CAT,
} from "../../../constants";

export const getCategoryFromPlace = (sanitizedPlace) => {
  for (const catRegex in PLACE_REGEX_TO_CAT)
    if (sanitizedPlace.toLowerCase().includes(catRegex))
      return PLACE_REGEX_TO_CAT[catRegex];
  return PLACE_TO_CAT[sanitizedPlace] || CATEGORIES["🃏 Miscelánea"];
};
