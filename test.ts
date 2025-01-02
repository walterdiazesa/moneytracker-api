import { BANK_LIST } from "@/constants";
import bairesfargo from "@/mock/bairesfargo.json";
import cignacusca from "@/mock/cignacusca.json";
import linodebac from "@/mock/linodebac.json";
import transfer365agricola from "@/mock/transfer365agricola_send.json";
import transfer365bac from "@/mock/transfer365bac_send.json";
import { parseHTMLMail } from "@/utils/";

[linodebac, cignacusca, bairesfargo, transfer365agricola, transfer365bac].map(({ subject: title, html, from, output }) => {
  const query = BANK_LIST[from.value[0].address].find(({ subject }) => subject === title);
  const parsed = parseHTMLMail(atob(html), query);
  console.log(`🧪 Testing "${title}"`);
  console.time(title);
  new Set([...Object.keys(parsed), ...Object.keys(output)]).forEach((key) => {
    if (parsed[key] !== output[key]) {
      if (key !== "date") throw new Error(`❌ Testing "${title}" failed on "${key}", expected: "${output[key]}", obtained: "${parsed[key]}"`);
    }
  });
  console.timeEnd(title);
});
