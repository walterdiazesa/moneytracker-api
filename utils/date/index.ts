export const isValidDate = (date: any): date is Date =>
  // @ts-ignore
  new Date(date) !== "Invalid Date" && !isNaN(new Date(date));

export const getDateWithOffset = (date: Date, offset = 0) =>
  new Date(date.setHours(date.getHours() + offset));

export const getDateRange = (fromDate: Date, toDate: Date) => {
  const fromYear = fromDate.getFullYear();
  const fromMonth = fromDate.getMonth();
  const toYear = toDate.getFullYear();
  const toMonth = toDate.getMonth();
  const months: Date[] = [];

  for (let year = fromYear; year <= toYear; year++) {
    let monthNum = year === fromYear ? fromMonth : 0;
    const monthLimit = year === toYear ? toMonth : 11;

    for (; monthNum <= monthLimit; monthNum++) {
      let month = monthNum + 1;
      months.push(new Date(year, month - 1, 1));
    }
  }
  return months;
};

export const getAbsMonth = (date: Date, type: "begin" | "end") => {
  if (!type) return date;
  switch (type) {
    case "begin":
      return new Date(
        Date.UTC(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0)
      );
    case "end":
      return new Date(
        Date.UTC(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
      );
  }
};

export const getAbsDate = (date: Date) => {
  const initDate = new Date(date);
  let dateHelper = new Date(
    initDate.getFullYear(),
    initDate.getMonth(),
    initDate.getDate(),
    0,
    0,
    0,
    0
  );
  return new Date(
    dateHelper.getTime() - dateHelper.getTimezoneOffset() * 60000
  );
};

export const getDaysDiff = (dateA: Date, dateB: Date) => {
  const diffTime = Math.abs(dateB.getTime() - dateA.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};
