# moneytracker-api

BK daily transactions

(/Users/walterdiaz)

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
30 16 \* \* \* /Users/walterdiaz/moneytracker-bk-cron.sh > /Users/walterdiaz/moneytracker-cron.log > /Users/walterdiaz/moneytracker-cron-err.log
```
