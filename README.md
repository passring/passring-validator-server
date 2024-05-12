Init:\
fill in .env
```
npm i
npm run drizzle:migrate
npm run start
```

Run:
```
npm run drizzle:migrate (after each schema changes)
npm run start
```

Changed schema?
```
npm run drizzle:generate
npm run drizzle:migrate
npm run start
```
