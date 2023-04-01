import { CATEGORIES, PLACE_TO_CAT } from "../../../constants.js";

export const getCategoryFromPlace = (sanitizedPlace) => {
  if (sanitizedPlace.toLowerCase().includes("airbnb"))
    return CATEGORIES["🏠 Hospedaje"];
  return PLACE_TO_CAT[sanitizedPlace] || CATEGORIES["🃏 Miscelánea"];
};
