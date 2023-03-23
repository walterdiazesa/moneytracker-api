import { parseStrip, segments, sections } from "./parsers/index.js";

const PARSER_PARSER = {
  parseStrip,
  segments,
  sections,
};
/**
 * @returns {{ cc: string, currency: string, amount: string, date: Date, place: string, type?: 'plus' | 'minus' }}
 */
export const parseHTMLMail = (html, query) => {
  return PARSER_PARSER[query.parser](html, query);
};
