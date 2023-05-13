export const isValidDate = (date) =>
  new Date(date) !== "Invalid Date" && !isNaN(new Date(date));

export const getDateWithOffset = (date, offset = 0) =>
  new Date(date.setHours(date.getHours() + offset));
