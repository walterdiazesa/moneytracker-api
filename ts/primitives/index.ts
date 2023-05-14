/**
 * Refers to value which can create a Date object from it, if no *T* is specificied this value can be use with
 * new Date(value), although if we know the correct type of the value, not all forms of instancing a Date can be
 * interchangable by strings or number
 * @param  {string|number} No_T_Provided e.g: "2022-09-21T10:29:31-04:00", 1663931180596
 * @param  {string} T_Type_String e.g: "2022-09-21T10:29:31-04:00"
 * @param  {number} T_Type_Number e.g: 1663931180596
 */
export type DateCaster<T extends string | number | undefined = undefined> =
  T extends undefined
    ? StringDate | number
    : T extends string
    ? StringDate
    : number;

type StringDate = `${number}-${number}-${number}T${number}:${number}:${number}${
  | ""
  | `${"+" | "-"}${number}:${number}`}`;
