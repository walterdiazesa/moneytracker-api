import Imap from "imap";
import { simpleParser } from "mailparser";
import {
  BANK_LIST,
  CATEGORIES,
  CURRENCY_PARSER,
  PLACE_TO_CAT,
} from "./constants.js";
import { parseHTMLMail } from "./utils/index.js";
import { PrismaClient } from "@prisma/client";
import { getCurrencyExchangeRates } from "./utils/currency/index.js";
import express from "express";
import { v4 as uuid } from "uuid";
import xss from "xss";

const prisma = new PrismaClient();
const app = express();

const imapConfig = {
  user: process.env.IMAP_MAIL,
  password: process.env.IMAP_PASSWORD,
  host: "imap.gmail.com",
  port: 993,
  tls: true,
  tlsOptions: { rejectUnauthorized: false },
};

let startDate = new Date();
let firstFetchDone = false;
let boxCount = undefined;

const sanitizeString = (string) => {
  return xss(string, {
    whiteList: {},
    stripIgnoreTag: true,
    stripIgnoreTagBody: true,
  });
};

export const FROM = (from) => {
  let nestedFromOr;

  (Array.isArray(from) ? from : [from]).forEach((value, index) => {
    nestedFromOr = index
      ? ["OR", ["FROM", value], nestedFromOr]
      : ["FROM", value];
  });

  return nestedFromOr;
};

const onEndFetch = () => {
  console.log(`Done fetching messages!`);
  startDate = new Date();
  prisma.startTime
    .update({ where: { id: 1 }, data: { value: startDate } })
    .then(() => {});
  // imap.end()
};

const attachFetchHandlers = (fetcher) => {
  fetcher.on("message", (msg) => {
    attachMsgParser(msg);
  });
  fetcher.once("error", (ex) => {
    return Promise.reject(ex);
  });
  fetcher.once("end", onEndFetch);
};

/**
 * @param  {Imap.ImapMessage} msg
 */
const attachMsgParser = (msg) => {
  msg.on("body", (stream) => {
    simpleParser(
      stream,
      async (err, { from, subject: title, html, messageId }) => {
        if (err)
          return console.error("attachMsgParser > simpleParser", { err });

        const query =
          BANK_LIST[from.value[0].address]?.find(
            ({ subject }) => subject === title
          ) || undefined;

        // Founded transaction mail
        if (query) {
          const { currency, amount, cc, date, place, ...parsedMail } =
            parseHTMLMail(html, query);
          const exchanges = { currency, amount };
          if (currency !== CURRENCY_PARSER.$) {
            const exchangedAmount =
              amount / +(await getCurrencyExchangeRates())[currency];
            exchanges["orCurrency"] = currency;
            exchanges["orAmount"] = +amount;
            exchanges["currency"] = CURRENCY_PARSER.$;
            exchanges["amount"] = exchangedAmount;
          }
          const sanitizedPlace = sanitizeString(place);
          const { id } = await prisma.transaction.upsert({
            where: { id: messageId },
            create: {
              ...parsedMail,
              ...exchanges,
              title: sanitizedPlace,
              from: cc,
              purchaseDate: date,
              categoryId:
                PLACE_TO_CAT[sanitizedPlace] || CATEGORIES["🃏 Miscelánea"],
              owner: imapConfig.user,
              id: messageId,
            },
            update: {},
            select: { id: true },
          });
          if (sanitizedPlace !== place)
            console.log(
              `Sanitized place name: ${sanitizedPlace}, original: ${place}`
            );
          console.log(
            `💳 New transaction "${id} - ${sanitizedPlace} : ${exchanges.currency}${exchanges.amount}" created!`
          );
        }
      }
    );
  });
};

const getEmails = () => {
  try {
    const imap = new Imap(imapConfig);
    imap.on("mail", (count) => {
      if (!firstFetchDone) {
        firstFetchDone = true;
        return;
      }
      boxCount += count;
      const fetcherNewMails = imap.seq.fetch(`${boxCount}:*`, { bodies: "" });
      attachFetchHandlers(fetcherNewMails);
    });
    imap.once("ready", () => {
      imap.openBox("INBOX", false, (err, box) => {
        if (err)
          return console.error("getEmails > imapOnceReady > imapOpenBoxInbox", {
            err,
          });
        boxCount = box.messages.total;
        imap.search(
          ["ALL", ["SINCE", startDate], FROM(Object.keys(BANK_LIST))],
          (err, results) => {
            if (err || !results || !results.length) return onEndFetch();
            const fetcherInitialMails = imap.fetch(results, { bodies: "" });
            attachFetchHandlers(fetcherInitialMails);
          }
        );
      });
    });

    imap.once("error", (err) => {
      console.error("imapOnce > error", { err });
    });

    imap.once("end", () => {
      console.log("Connection ended");
      imap.connect();
    });

    imap.connect();
  } catch (ex) {
    console.error("getMails > catch", { ex });
  }
};

const fillDefaultDbs = () => {
  /* const categories = await prisma.category.createMany({
    data: [
      { name: "🃏 Miscelánea", color: "EEE0DD" },
      { name: "🥖 Alimentos", color: "F9CE58" },
      { name: "🍣 Restaurante", color: "F99558" },
      { name: "🏋️‍♂️ Gimnasio", color: "F958A6" },
      { name: "🧼 Belleza", color: "C8F958" },
      { name: "🍾 Salidas", color: "58F9EC" },
      { name: "🏂 Experiencias", color: "4169e1" },
      { name: "🚈 Transporte", color: "060a16" },
      { name: "🛍 Ropa", color: "E1415B" },
      { name: "🏠 Hospedaje", color: "E1A641" },
      { name: "💸 Income", color: "157811" },
    ],
  }); */
  /* const startDateDB = await prisma.startTime.create({
    data: { value: new Date() },
  }); */
};

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "OPTIONS, GET, POST, PATCH, DELETE"
  );
  res.setHeader("Access-Control-Max-Age", 2592000); // 30 days
  return next();
});

app.get("/", function (req, res) {
  res.send("✅ Health check");
});
app.options("/", function (req, res) {
  res.send({
    "GET /transaction": "All",
    "GET /transaction/:id": "Get transaction",
    "GET /transaction/title/:title":
      "Get transaction by title, append '?strict=true' for only displaying exact title",
    "PATCH /transaction/:id": "Update transaction",
    "DELETE /transaction/:id": "Delete transaction",
    "POST /transaction": "New transaction",
    "GET /transaction/:from/:to": "Get transactions between two dates",
    "GET /category": "All",
    "PATCH /category/:id": "Update category",
    "POST /category": "New category",
  });
});

/**
 * @type {import('@prisma/client').Prisma.TransactionFindManyArgs}
 */
const transactionOptions = {
  include: { category: true },
  orderBy: { purchaseDate: "desc" },
};
app.get("/transaction", async function (req, res) {
  res.send(await prisma.transaction.findMany(transactionOptions));
});
app.get("/transaction/:id", async function (req, res) {
  res.send(
    await prisma.transaction.findUnique({
      where: { id: req.params.id },
      include: { category: true },
    })
  );
});
app.get("/transaction/title/:title", async function (req, res) {
  res.send(
    await (req.query.strict
      ? prisma.transaction.findMany({
          where: { title: req.params.title },
          ...transactionOptions,
        })
      : prisma.transaction.findMany({
          where: { title: { contains: req.params.title } },
          ...transactionOptions,
        }))
  );
});
app.patch("/transaction/:id", async function (req, res) {
  res.send(
    await prisma.transaction.update({
      where: { id: req.params.id },
      data: req.body,
      include: { category: true },
    })
  );
});
app.delete("/transaction/:id", async function (req, res) {
  res.send(
    await prisma.transaction.delete({
      where: { id: req.params.id },
    })
  );
});
app.post("/transaction", async function (req, res) {
  res.send(
    await prisma.transaction.create({
      data: { ...req.body, id: uuid() },
      include: { category: true },
    })
  );
});
app.get("/transaction/:from/:to", async function (req, res) {
  res.send(
    await prisma.transaction.findMany({
      where: {
        purchaseDate: {
          gte: new Date(req.params.from),
          lte: new Date(req.params.to),
        },
      },
      ...transactionOptions,
    })
  );
});
app.get("/category", async function (req, res) {
  res.send(await prisma.category.findMany());
});
app.patch("/category/:id", async function (req, res) {
  res.send(
    await prisma.category.update({
      where: { id: req.params.id },
      data: req.body,
    })
  );
});
app.post("/category", async function (req, res) {
  res.send(
    await prisma.category.create({
      data: req.body,
    })
  );
});

(async () => {
  startDate = (await prisma.startTime.findUnique({ where: { id: 1 } })).value;
  getEmails();
})();
app.listen(process.env.PORT || 3000, () =>
  console.log(`🚀 Server ready on ${process.env.PORT || 3000}`)
);
