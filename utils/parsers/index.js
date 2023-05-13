import { CURRENCY_PARSER } from "../../constants.js";
import { getDateWithOffset } from "../date/index.js";

export const parseStrip = (html, { parseStart, parseEnd, offset }) => {
  const slice = html.slice(
    html.indexOf(parseStart) + parseStart.length,
    html.indexOf(parseEnd)
  );
  const [cc, , currency, amount, , ...placeAndDate] = slice.split(" ");
  const parsedPlaceAndDate = placeAndDate
    .join(" ")
    .replace("el día ", "")
    .split(" ");
  const [date, time, ...place] = [
    parsedPlaceAndDate.pop(),
    parsedPlaceAndDate.pop(),
    ...parsedPlaceAndDate,
  ];

  return {
    cc,
    currency: CURRENCY_PARSER[currency] || currency,
    amount: amount.replace(",", ""),
    date: getDateWithOffset(new Date(`${date} ${time}`), offset),
    place: place.join(" "),
  };
};

export const sections = (
  html,
  { parseStart, parseEnd, stripCard, segmentRow, segmentRowAlt, offset }
) => {
  const [, cc] = html
    .slice(
      html.indexOf(stripCard[0]),
      html.indexOf(stripCard[1], html.indexOf(stripCard[0]))
    )
    .split("terminada en <strong>");
  const slice = html.slice(html.indexOf(parseStart), html.indexOf(parseEnd));
  const [, placeAndAmount, dateAndTime] =
    slice.split(segmentRow).length > 1
      ? slice.split(segmentRow)
      : slice.split(segmentRowAlt);
  let [, place, amount] = placeAndAmount.split(';margin: 0em">\n');
  place = place.split("\n")[0].trim();
  amount = amount.split("\n")[0].trim().replace(",", "");
  const [date, time] = dateAndTime
    .split(';margin: 0em">\n')[1]
    .split("\n")[0]
    .trim()
    .split("-");
  return {
    cc,
    date: getDateWithOffset(new Date(`${date} ${time}`), offset),
    place,
    amount,
    currency: "USD",
  };
};

const segmentValue = (html, slice) => {
  return !Array.isArray(slice)
    ? slice
    : html
        .slice(
          html.indexOf(slice[0]),
          html.indexOf(slice[1], html.indexOf(slice[0]))
        )
        .slice(slice[0].length);
};

export const segments = (
  html,
  { stripCard, dateSlice, placeSlice, amountSlice, type, offset }
) => {
  const cc = segmentValue(html, stripCard).replace(/[^0-9.]/g, "");

  const date = getDateWithOffset(
    new Date(segmentValue(html, dateSlice)),
    offset
  );

  const place = segmentValue(html, placeSlice).trim();

  const amount = segmentValue(html, amountSlice).replace(",", "");

  return { cc, date, place, amount, currency: "USD", type };
};
