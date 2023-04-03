export const isValidDate = (date) =>
  new Date(date) !== "Invalid Date" && !isNaN(new Date(date));
