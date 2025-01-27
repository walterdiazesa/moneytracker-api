import { BANK_LIST } from "@/constants";
import { parseInverseStrip, parseStrip, parseTransfer365, sections, segments } from "./parsers";

const PARSER_PARSER = {
  parseStrip,
  segments,
  sections,
  parseInverseStrip,
};
/**
 * @returns {{ cc: string, currency: string, amount: string, date: Date, place: string, type?: 'plus' | 'minus' }}
 */
export const parseHTMLMail = (html: string, query: (typeof BANK_LIST)[keyof typeof BANK_LIST][number]) => {
  if (query.parser === "transfer365-send") return parseTransfer365(html);
  if (query.parser === "transfer365-receive") return parseTransfer365(html, true);
  return PARSER_PARSER[query.parser](html, query);
};

export * from "./currency";
export * from "./date";
export * from "./parsers";
