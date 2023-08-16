import { parseHTMLMail, getDateWithOffset } from "@/utils/";
import cignacusca from "@/mock/cignacusca.json";
import bairesfargo from "@/mock/bairesfargo.json";
import linodebac from "@/mock/linodebac.json";
import { BANK_LIST } from "@/constants";

[linodebac, cignacusca, bairesfargo].map(({ subject: title, html, from, output }) => {
  const query = BANK_LIST[from.value[0].address].find(({ subject }) => subject === title);
  const parsed = parseHTMLMail(atob(html), query);
  console.log(`🧪 Testing "${title}"`);
  console.time(title);
  new Set([...Object.keys(parsed), ...Object.keys(output)]).forEach((key) => {
    if (parsed[key] !== output[key]) {
      if (key !== "date" || new Date(parsed[key]).toJSON() !== getDateWithOffset(new Date(output[key]), query.offset).toJSON()) throw new Error(`❌ Testing "${title}" failed on "${key}", expected: ${output[key]}, obtained: ${parsed[key]}`);
    }
  });
  console.timeEnd(title);
});
