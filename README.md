# Galaxy Fox

This repo contains the smart contract for the Galaxy Fox token.

## How to run

1. Install dependencies

```bash
pnpm install
```

2. Compile contracts

```bash
pnpm run compile
```

3. Run tests

```bash
pnpm run test
```

4. Run coverage

```bash
pnpm run coverage
```

## Test Coverage

| File               | % Stmts | % Branch | % Funcs | % Lines |
| ------------------ | ------- | -------- | ------- | ------- |
| GalaxyFoxToken.sol | 82.14   | 75.61    | 85.71   | 88.37   |

## Gas Report

| Solc version: 0.8.23 | Optimizer enabled: true | Runs: 200       | Block limit: 30000000 gas |         |         |           |
| -------------------- | ----------------------- | --------------- | ------------------------- | ------- | ------- | --------- |
| Methods              | 37 gwei/gas             | 2507.56 usd/eth |                           |         |         |           |
| Contract             | Method                  | Min             | Max                       | Avg     | # calls | usd (avg) |
| GalaxyFox            | approve                 | 46446           | 46458                     | 46448   | 6       | 4.31      |
| GalaxyFox            | burn                    | 28247           | 33931                     | 29044   | 16      | 2.69      |
| GalaxyFox            | setBuyTax               | 24823           | 46795                     | 32752   | 4       | 3.04      |
| GalaxyFox            | setEcosystemHolder      | -               | -                         | 29128   | 2       | 2.70      |
| GalaxyFox            | setExcludedFromFee      | 24508           | 46420                     | 35464   | 2       | 3.29      |
| GalaxyFox            | setLiquidityHolder      | 29029           | 29041                     | 29035   | 2       | 2.69      |
| GalaxyFox            | setMarketingHolder      | -               | -                         | 29042   | 2       | 2.69      |
| GalaxyFox            | setMaxDailyVolume       | -               | -                         | 30961   | 1       | 2.87      |
| GalaxyFox            | setMiniBeforeLiquify    | 23893           | 45877                     | 34885   | 2       | 3.24      |
| GalaxyFox            | setPair                 | -               | -                         | 46508   | 1       | 4.31      |
| GalaxyFox            | setSellTax              | 24822           | 46794                     | 32751   | 4       | 3.04      |
| GalaxyFox            | setTaxEnabled           | 26072           | 28872                     | 27472   | 2       | 2.55      |
| GalaxyFox            | transfer                | 72400           | 270425                    | 121739  | 16      | 11.29     |
| Deployments          | -                       | -               | -                         | 4685421 | 15.6%   | 434.71    |
