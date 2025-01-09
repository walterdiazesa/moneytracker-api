import { BANK_LIST, CURRENCY_PARSER } from "@/constants";
import { getDateWithOffset } from "@/utils";

type Query<T extends keyof typeof BANK_LIST> = (typeof BANK_LIST)[T][number];

export const parseTransfer365 = (html: string, receive = false) => {
  const isAgricola = html.includes("Institución destino");
  const i = isAgricola ? html.indexOf("Institución destino") : html.indexOf(receive ? "Banco Origen" : "Banco Destino"); // =B3n destino
  const v = html.slice(i).split(/<\/b>|<br \/>/gm);
  const to = v[0].replace("<b>", "").split(" ").pop()!.replace("Ã\x81", "Á");
  const from = isAgricola ? "AGRICOLA" : "BAC";
  return { from: !receive ? from : to, to: !receive ? to : from, amount: v[1].split("$")[1].trim(), currency: CURRENCY_PARSER["$"], type: receive ? "plus" : "minus" };
};

export const parseStrip = (html: string, { parseStart, parseEnd, offset }: Query<"notificaciones@bancocuscatlan.com">) => {
  const slice = html.slice(html.indexOf(parseStart) + parseStart.length, html.indexOf(parseEnd));
  const [cc, , currency, amount, , ...placeAndDate] = slice.split(" ");
  const parsedPlaceAndDate = placeAndDate.join(" ").replace("el día ", "").split(" ");
  const [date, time, ...place] = [parsedPlaceAndDate.pop(), parsedPlaceAndDate.pop(), ...parsedPlaceAndDate];

  return {
    cc,
    currency: CURRENCY_PARSER[currency] || currency,
    amount: amount.replace(",", ""),
    date: getDateWithOffset(new Date(`${date} ${time}`), offset),
    place: place.join(" "),
  };
};

export const parseInverseStrip = (html: string, { parseStart, parseEnd, offset }: Query<"canalesdigitales@notificacionesbancoagricola.com">) => {
  const slice = html.slice(html.indexOf(parseStart) + parseStart.length, html.indexOf(parseEnd));
  const [cc, , , , , , currency, amount, , ...placeAndDate] = slice.replace(/\s{2,}/g, " ").split(" ");
  const parsedPlaceAndDate = placeAndDate.join(" ").replace(".<p>Fecha/Hora:", "").split(" ");
  const [time, date, ...place] = [parsedPlaceAndDate.pop(), parsedPlaceAndDate.pop(), ...parsedPlaceAndDate];

  return {
    cc,
    currency: CURRENCY_PARSER[currency] || currency,
    amount: amount.replace(",", ""),
    date: getDateWithOffset(new Date(`${date.split("/").slice(0, 2).reverse().join("/")}/${date.split("/").pop()} ${time}`), offset),
    place: place.join(" ").replace(" = ", " "),
  };
};

export const sections = (html: string, { parseStart, parseEnd, stripCard, segmentRow, segmentRowAlt, offset }: Query<"info@baccredomatic.com">) => {
  const [, cc] = html.slice(html.indexOf(stripCard[0]), html.indexOf(stripCard[1], html.indexOf(stripCard[0]))).split("terminada en <strong>");
  const slice = html.slice(html.indexOf(parseStart), html.indexOf(parseEnd));
  const [, placeAndAmount, dateAndTime] = slice.split(segmentRow).length > 1 ? slice.split(segmentRow) : slice.split(segmentRowAlt);
  let [, place, amount] = placeAndAmount.split(';margin: 0em">\n');
  place = place.split("\n")[0].trim();
  amount = amount.split("\n")[0].trim().replace(",", "");
  const [date, time] = dateAndTime.split(';margin: 0em">\n')[1].split("\n")[0].trim().split("-");
  return {
    cc,
    date: getDateWithOffset(new Date(`${date} ${time}`), offset),
    place,
    amount,
    currency: "USD",
  };
};

const segmentValue = (html: string, slice: string | string[]) => {
  return !Array.isArray(slice) ? slice : html.slice(html.indexOf(slice[0]), html.indexOf(slice[1], html.indexOf(slice[0]))).slice(slice[0].length);
};

export const segments = (html: string, { stripCard, dateSlice, placeSlice, amountSlice, type, offset }: Query<"ofsrep.ceosmuigw@wellsfargo.com">) => {
  const cc = segmentValue(html, stripCard).replace(/[^0-9.]/g, "");

  const date = getDateWithOffset(new Date(segmentValue(html, dateSlice)), offset);

  const place = segmentValue(html, placeSlice).trim();

  const amount = segmentValue(html, amountSlice).replace(",", "");

  return { cc, date, place, amount, currency: "USD", type };
};

export * from "./category";
