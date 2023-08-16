<p align="center">
  <a href="https://moneytracker-app.vercel.app/" target="blank"><img src="https://moneytracker-app.vercel.app/images/icon-512.png" width="120" alt="MoneyTracker Logo" /></a>
</p>
  
<p align="center">
A Progressive Web App (PWA) designed to monitor my personal expenses by consolidating expenditures from various accounts and banks into one unified platform.
</p>

# MoneyTracker-API

🛠: [Prisma](https://www.prisma.io/), [NextAuth](https://next-auth.js.org/), [Express](https://expressjs.com/), [Express-Insider](https://www.npmjs.com/package/express-insider)

📚: [PlanetScale (Frankfurt)](https://planetscale.com/), [Render (Frankfurt)](https://render.com/) (alternative: [Railway](https://railway.app/))

📱: https://github.com/walterdiazesa/moneytracker-app

# Description

Backend for [MoneyTracker](https://github.com/walterdiazesa/moneytracker-app), I travel a lot, I have different bank accounts in different countries, different currencies, each of them have their own app to track the expenses of the card you have with them, with a poorly categorization system, so if I want to know **How much I had spend?**, **How much I had saved?**, and **How much am I able to spend before getting broke?** I would need to check all the different bank accounts, manually exchange currency rates for each of them and filter.

Other apps in the market solve this issue, the problem of them are:

- You can add your bank account(s), but almost all of them are only for 🇺🇸🦅 folks.
- If you're not from USA, you need to manually introduce all your expenses, even if they come from a credit/debit card.
- You need to manually exchange the currency to match values with your other expenses

I needed to centralize all my expenses from different sources, and they all shared one thing in common, they send mails as soon as you purchase something

```mermaid
flowchart TB
    bankA("🏦") --> Mail("📪")
    bankB("🏦") --> Mail("📪")
    bankC("🏦") --> Mail("📪")
    Mail("📪") --> MoneyTracker("📱")
```

So this app is basically

- **listening for those mails**
- **parse them**
- **exchange currency**
- **have the possibility to manually add cash expenses**
- **provide insights and charts about my expenses**

[MoneyTracker-Demo-Desktop-PWA.webm](https://github.com/walterdiazesa/moneytracker-api/assets/58494087/b225ace7-19bc-42e2-9ecd-fe213f41e6f1)

[MoneyTracker-Demo-IPhone-PWA.webm](https://github.com/walterdiazesa/moneytracker-api/assets/58494087/e328d2ce-474a-42ea-bcbf-fd5160d581c8)

# Data Backup

I run a cronjob daily to save a backup of my transactions, Planetscale also do this for me but it's just in case

```bash
echo "curl '<API URL>/transaction/' -o moneytracker-transaction-bk.json && curl '<API URL>/category/' -o moneytracker-category-bk.json && curl '<API URL>/starttime/' -o moneytracker-starttime-bk.json" > moneytracker-bk-cron.sh
```

(Give execute permission)

```bash
chmod +x moneytracker-bk-cron.sh
```

(Run cronjob every day at 4:30 pm)

```bash
crontab -e
```

(Remove asterisks backslash)

```bash
30 16 \* \* \* /Users/<user>/moneytracker-bk-cron.sh > /Users/<user>/moneytracker-cron.log > /Users/<user>/moneytracker-cron-err.log
```
