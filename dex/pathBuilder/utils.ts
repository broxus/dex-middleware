import { Address, Contract } from "locklift";
import { migrationLog } from "../migration/migrationLog";

export const dummyContract: Contract<any> = locklift.factory.getDeployedContract(
  "DexVault",
  new Address(migrationLog.Account1.address),
);

export const Constants = {
  tokens: {
    foo: {
      name: "Foo",
      symbol: "Foo",
      decimals: 6,
      upgradeable: true,
    },
    bar: {
      name: "Bar",
      symbol: "Bar",
      decimals: 6,
      upgradeable: true,
    },
    qwe: {
      name: "QWE",
      symbol: "Qwe",
      decimals: 8,
      upgradeable: true,
    },
    tst: {
      name: "Tst",
      symbol: "Tst",
      decimals: 9,
      upgradeable: true,
    },
    coin: {
      name: "Coin",
      symbol: "Coin",
      decimals: 9,
      upgradeable: true,
    },
    wever: {
      name: "Wrapped EVER",
      symbol: "WEVER",
      decimals: 9,
      upgradeable: true,
    },
  },
  LP_DECIMALS: 9,

  TESTS_TIMEOUT: 1200000,
};
