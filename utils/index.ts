import { BANK_LIST } from "@/constants";
import { parseStrip, segments, sections } from "./parsers";

const PARSER_PARSER = {
  parseStrip,
  segments,
  sections,
};
/**
 * @returns {{ cc: string, currency: string, amount: string, date: Date, place: string, type?: 'plus' | 'minus' }}
 */
export const parseHTMLMail = (
  html: string,
  query: (typeof BANK_LIST)[keyof typeof BANK_LIST][number]
) => {
  return PARSER_PARSER[query.parser](html, query);
};

export * from "./currency";
export * from "./date";
export * from "./parsers";
