import Imap from "imap";
import { simpleParser } from "mailparser";
import { Prisma, PrismaClient } from "@prisma/client";
import express from "express";
import xss from "xss";
import { BANK_LIST, CURRENCY_PARSER } from "@/constants";
import { getCategoryFromPlace, getAbsMonth, getDateRange, isValidDate, getCurrencyExchangeRates, parseHTMLMail } from "@/utils";
import { trail } from "express-insider";
import { ulid } from "ulid";

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

const sanitizeString = (string: string) => {
  return xss(string, {
    whiteList: {},
    stripIgnoreTag: true,
    stripIgnoreTagBody: true,
  });
};

export const FROM = (from: string | string[]) => {
  let nestedFromOr;

  (Array.isArray(from) ? from : [from]).forEach((value, index) => {
    nestedFromOr = index ? ["OR", ["FROM", value], nestedFromOr] : ["FROM", value];
  });

  return nestedFromOr;
};

const onEndFetch = () => {
  console.log(`Done fetching messages!`);
  startDate = new Date();
  prisma.startTime.update({ where: { id: 1 }, data: { value: startDate } }).then(() => {});
};

const attachFetchHandlers = (fetcher: Imap.ImapFetch) => {
  fetcher.on("message", (msg) => {
    attachMsgParser(msg);
  });
  fetcher.once("error", (ex) => {
    return Promise.reject(ex);
  });
  fetcher.once("end", onEndFetch);
};

const attachMsgParser = (msg: Imap.ImapMessage) => {
  msg.on("body", (stream) => {
    simpleParser(stream, async (err, { from, subject: title, html, messageId }) => {
      if (err || !html) return console.error("attachMsgParser > simpleParser", { err });

      const query = BANK_LIST[from.value[0].address]?.find(({ subject }) => subject === title) || undefined;

      // Founded transaction mail
      if (query) {
        const { currency, amount, cc, date, place, ...parsedMail } = parseHTMLMail(html, query);
        const exchanges = { currency, amount };
        if (currency !== CURRENCY_PARSER.$) {
          const exchangedAmount = amount / +(await getCurrencyExchangeRates())[currency];
          exchanges["orCurrency"] = currency;
          exchanges["orAmount"] = +amount;
          exchanges["currency"] = CURRENCY_PARSER.$;
          exchanges["amount"] = exchangedAmount;
        }
        const sanitizedPlace = sanitizeString(place);
        
        const messageIdBlock = messageId.replace('<', '').replace('>', '').split('@') as [string, string];
        const sanitizedId = `${messageIdBlock[1]}@${messageIdBlock[0]}`;

        const { id } = await prisma.transaction.upsert({
          where: { id: sanitizedId },
          create: {
            ...parsedMail,
            ...exchanges,
            title: sanitizedPlace,
            from: cc,
            purchaseDate: date,
            categoryId: getCategoryFromPlace(sanitizedPlace),
            owner: imapConfig.user,
            id: sanitizedId,
          },
          update: {},
          select: { id: true },
        });
        if (sanitizedPlace !== place) console.log(`Sanitized place name: ${sanitizedPlace}, original: ${place}`);
        console.log(`💳 New transaction "${id} - ${sanitizedPlace} : ${exchanges.currency}${exchanges.amount}" created!`);
      }
    });
  });
};

let imap: Imap;

const getEmails = () => {
  try {
    imap = new Imap(imapConfig);
    imap.on("mail", (count: number) => {
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
        imap.search(["ALL", ["SINCE", startDate], FROM(Object.keys(BANK_LIST))], (err, results) => {
          if (err || !results || !results.length) return onEndFetch();
          const fetcherInitialMails = imap.fetch(results, { bodies: "" });
          attachFetchHandlers(fetcherInitialMails);
        });
      });
    });

    imap.once("error", (err) => {
      if (err.code === "EPIPE" && err.source === "socket") console.log("⚡️ Socket restarting...");
      else console.error("❌ imapOnce > error", { err });
      gracefullyRestartImap();
    });

    imap.once("end", () => {
      console.log("❌ Connection ended");
      gracefullyRestartImap();
      // imap.connect();
    });

    imap.connect();
  } catch (ex) {
    console.error("❌ getMails > catch", { ex }); // ex.code EPIPE, ex.source socket
  }
};

const gracefullyRestartImap = () => {
  setTimeout(() => {
    console.log("⚙️ Restarting...");
    firstFetchDone = false;
    getEmails();
  }, 1000 * 10); // Restart after 10 seconds
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
    data: { value: new Date('06/06/2022') },
  }); */
};

// =*=*=*=*=*=*= C O R S =*=*=*=*=*=*=
app.use(function cors(req, res, next) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "OPTIONS, GET, POST, PATCH, DELETE");
  res.setHeader("Access-Control-Max-Age", 2592000); // 30 days
  res.setHeader("Access-Control-Allow-Headers", "Access-Control-Allow-Headers, Origin,Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers");
  return next();
});

// =*=*=*=*=*=*= UTILS =*=*=*=*=*=*=
app.use(express.json());

// =*=*=*=*=*=*= R O U T E S =*=*=*=*=*=*=
app.get("/", async function (req, res) {
  if (!startDate || !prisma) res.status(500);
  res.send({
    status: res.statusCode < 500 ? "✅ Health check" : { startDate: typeof startDate, prisma: typeof prisma },
  });
});
app.get("/imap", function (req, res) {
  res.send({
    imap: imap.state,
  });
});
app.options("/", function (req, res) {
  res.send({
    "GET /imap": "Get imap status (disconnected, connected, authenticated)",
    "GET /": "Get server (startDate, prisma) status",
    "GET /transaction": "All",
    "GET /starttime": "All",
    "GET /transaction/:id": "Get transaction",
    "GET /transaction/title/:title": "Get transaction by title, append '?strict=true' for only displaying exact title",
    "PATCH /transaction/:id": "Update transaction",
    "DELETE /transaction/:id": "Delete transaction",
    "POST /transaction": "New transaction",
    "GET /transaction/:from/:to": "Get transactions between two dates",
    "GET /transaction/expenses/:from/:to": "Get sum of transactions grouped by category for each month between two dates",
    "GET /category": "All",
    "PATCH /category/:id": "Update category",
    "POST /category": "New category",
  });
});

const transactionOptions: Prisma.TransactionFindManyArgs = {
  include: { category: true },
  orderBy: { purchaseDate: "desc" },
};
app.get("/transaction", async function (req, res) {
  const transactions = await prisma.transaction.findMany(transactionOptions);
  res.send(transactions);
});
app.get("/starttime", async function (req, res) {
  const starttime = await prisma.startTime.findMany();
  res.send(starttime);
});
app.get("/transaction/:id", async function (req, res) {
  const transaction = await prisma.transaction.findUnique({
    where: { id: req.params.id },
    include: { category: true },
  });
  res.send(transaction);
});
app.get("/transaction/title/:title", async function (req, res) {
  const transactions = await prisma.transaction.findMany({
    where: {
      title: req.query.strict ? req.params.title : { contains: req.params.title },
      ...((req.query.from || req.query.to) && {
        purchaseDate: {
          ...(req.query.from && {
            gte: isValidDate(req.query.from) ? new Date(req.query.from) : new Date(),
          }),
          ...(req.query.to && {
            lte: isValidDate(req.query.to) ? new Date(req.query.to) : new Date(),
          }),
        },
      }),
    },
    ...transactionOptions,
  });
  res.send(transactions);
});
app.patch("/transaction/:id", async function (req, res) {
  const transaction = await prisma.transaction.update({
    where: { id: req.params.id },
    data: req.body,
    include: { category: true },
  });
  res.send(transaction);
});
app.delete("/transaction/:id", async function (req, res) {
  const transaction = await prisma.transaction.delete({
    where: { id: req.params.id },
  });
  res.send(transaction);
});
app.post("/transaction", async function (req, res) {
  const purchaseDate = isValidDate(req.body.purchaseDate) ? new Date(req.body.purchaseDate) : new Date()
  const transaction = await prisma.transaction.create({
    data: {
      ...req.body,
      purchaseDate,
      id: ulid(purchaseDate.getTime()),
    },
    include: { category: true },
  });
  res.send(transaction);
});
app.get("/transaction/:from/:to", async function (req, res) {
  const transactions = await prisma.transaction.findMany({
    where: {
      purchaseDate: {
        gte: isValidDate(req.params.from) ? new Date(req.params.from) : new Date(),
        lte: isValidDate(req.params.to) ? new Date(req.params.to) : new Date(),
      },
      ...(req.query.title && {
        title: req.query.strict ? (req.query.title as string) : { contains: req.query.title as string },
      }),
    },
    ...transactionOptions,
  });
  res.send(transactions);
});
app.get("/transaction/expenses/:from/:to", async function (req, res) {
  if (!isValidDate(req.params.from) || !isValidDate(req.params.to) || new Date(req.params.from) > new Date(req.params.to)) return res.send([]);

  const dateRange = getDateRange(new Date(req.params.from), new Date(req.params.to));

  const expensesByMonth = await prisma.$transaction(
    dateRange.map((date) =>
      prisma.transaction.groupBy({
        by: ["categoryId"],
        where: {
          purchaseDate: {
            gte: getAbsMonth(date, "begin"),
            lte: getAbsMonth(date, "end"),
          },
          type: "minus",
        },
        _sum: {
          amount: true,
        },
      })
    )
  );

  const transactions = expensesByMonth.reduce((acc, cVal, idx) => {
    acc[getAbsMonth(dateRange[idx], "begin").toJSON()] = cVal;
    return acc;
  }, {});

  res.send(transactions);
});
app.get("/category", async function (req, res) {
  const category = await prisma.category.findMany();
  res.send(category);
});
app.patch("/category/:id", async function (req, res) {
  const category = await prisma.category.update({
    where: { id: Number(req.params.id) },
    data: req.body,
  });
  res.send(category);
});
app.post("/category", async function (req, res) {
  const categories = await prisma.category.create({
    data: req.body,
  });
  res.send(categories);
});

(async () => {
  startDate = (await prisma.startTime.findUnique({ where: { id: 1 } })).value;
  getEmails();
})();

trail(app, {
  ignoreMiddlewares: ['query', 'expressInit', 'cors', 'jsonParser'],
  ignoreRoutes: [{ route: '/', method: 'get' }],
  trailAdditaments: {
    condition: (req) => req.rawHeaders,
    print: "next-line-multiline"
  }
});
app.listen(process.env.PORT || 3000, () => console.log(`🚀 Server ready on ${process.env.PORT || 3000}`));
