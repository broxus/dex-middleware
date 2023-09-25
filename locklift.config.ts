import { LockliftConfig } from "locklift";
import { FactorySource } from "./build/factorySource";
import { SimpleGiver, GiverWallet, TestnetGiver } from "./giverSettings";
import * as chai from "chai";
import "locklift-verifier";
const result = require("dotenv").config();

import { lockliftChai } from "locklift/chaiPlugin";
chai.use(lockliftChai);
import * as fs from "fs";
import path from "path";

declare global {
  const locklift: import("locklift").Locklift<FactorySource>;
}

const LOCAL_NETWORK_ENDPOINT = process.env.NETWORK_ENDPOINT || "http://localhost/graphql";
const DEV_NET_NETWORK_ENDPOINT = process.env.DEV_NET_NETWORK_ENDPOINT || "https://devnet-sandbox.evercloud.dev/graphql";

// Create your own link on https://dashboard.evercloud.dev/
const MAIN_NET_NETWORK_ENDPOINT = process.env.MAIN_NET_NETWORK_ENDPOINT || "https://mainnet.evercloud.dev/XXX/graphql";
const config: LockliftConfig = {
  verifier: {
    verifierVersion: "latest", // contract verifier binary, see https://github.com/broxus/everscan-verify/releases
    apiKey: process.env.VERIFY_API_KEY || "",
    secretKey: process.env.VERIFY_SECRET_KEY || "",
    // license: "AGPL-3.0-or-later", <- this is default value and can be overrided
  },
  compiler: {
    // Specify path to your TON-Solidity-Compiler
    // path: "/mnt/o/projects/broxus/TON-Solidity-Compiler/build/solc/solc",

    // Or specify version of compiler
    version: "0.62.0",

    // Specify config for extarnal contracts as in exapmple
    externalContracts: {
      "node_modules/broxus-ton-tokens-contracts/build": [
        "TokenRoot",
        "TokenWallet",
        "TokenRootUpgradeable",
        "TokenWalletUpgradeable",
        "TokenWalletPlatform",
      ],
      // dex_build: fs
      //   .readdirSync(path.resolve(__dirname, "dex_build"))
      //   .filter(el => el.includes(".abi.json"))
      //   .map(el => el.replace(".abi.json", "")),
      "node_modules/dex/build": fs
        .readdirSync(path.resolve(__dirname, "node_modules/dex/build"))
        .filter(el => el.includes(".abi.json") && el !== "Wallet.abi.json")
        .map(el => el.replace(".abi.json", "")),
    },
  },
  linker: {
    // Specify path to your stdlib
    // lib: "/mnt/o/projects/broxus/TON-Solidity-Compiler/lib/stdlib_sol.tvm",
    // // Specify path to your Linker
    // path: "/mnt/o/projects/broxus/TVM-linker/target/release/tvm_linker",

    // Or specify version of linker
    version: "0.15.48",
  },
  networks: {
    local: {
      // Specify connection settings for https://github.com/broxus/everscale-standalone-client/
      connection: {
        id: 1,
        // group: "localnet",
        type: "graphql",
        data: {
          endpoints: [LOCAL_NETWORK_ENDPOINT],
          latencyDetectionInterval: 1000,
          local: true,
        },
      },
      // This giver is default local-node giverV2
      giver: {
        // Check if you need provide custom giver
        giverFactory: (ever, keyPair, address) => new SimpleGiver(ever, keyPair, address),
        address: "0:ece57bcc6c530283becbbd8a3b24d3c5987cdddc3c8b7b33be6e4a6312490415",
        key: "172af540e43a524763dd53b26a066d472a97c4de37d5498170564510608250c3",
      },

      keys: {
        // Use everdev to generate your phrase
        // !!! Never commit it in your repos !!!
        phrase: "expire caution sausage spot monkey prefer dad rib vicious pepper mimic armed",
        amount: 20,
      },
    },
    test: {
      connection: {
        id: 1,
        type: "graphql",
        group: "dev",
        data: {
          endpoints: [DEV_NET_NETWORK_ENDPOINT],
          latencyDetectionInterval: 1000,
          local: false,
        },
      },
      giver: {
        giverFactory: (ever, keyPair, address) => new GiverWallet(ever, keyPair, address),
        address: "0:ece57bcc6c530283becbbd8a3b24d3c5987cdddc3c8b7b33be6e4a6312490415",
        phrase: "expire caution sausage spot monkey prefer dad rib vicious pepper mimic armed",
        accountId: 0,
      },

      keys: {
        // Use everdev to generate your phrase
        // !!! Never commit it in your repos !!!
        // phrase: "action inject penalty envelope rabbit element slim tornado dinner pizza off blood",
        amount: 20,
      },
    },
    main: {
      // Specify connection settings for https://github.com/broxus/everscale-standalone-client/
      connection: "mainnetJrpc",
      giver: {
        // giverFactory: (ever, keyPair, address) => new TestnetGiver(ever, keyPair, address),
        address: process.env.MAIN_GIVER_ADDRESS || "set me",
        key: process.env.MAIN_GIVER_KEY || "set me",
      },

      keys: {
        phrase: process.env.SEED || "set me",
        amount: 500,
      },
    },
    mainCustomJrpc: {
      // Specify connection settings for https://github.com/broxus/everscale-standalone-client/
      connection: {
        id: 1,
        group: "group",
        type: "jrpc",
        data: {
          endpoint: process.env.MAIN_ENDPOINT || "set me",
        },
      },
      giver: {
        // giverFactory: (ever, keyPair, address) => new TestnetGiver(ever, keyPair, address),
        address: process.env.MAIN_GIVER_ADDRESS || "set me",
        phrase: process.env.MAIN_GIVER_SEED_PHRASE || "set me",
        accountId: 0,
      },

      keys: {
        phrase: process.env.SEED || "set me",
        amount: 500,
      },
    },
    venom_main: {
      connection: {
        id: 1,
        group: "group",
        type: "jrpc",
        data: {
          endpoint: "https://jrpc.venom.foundation",
        },
      },
      giver: {
        address: process.env.VENOM_MAIN_GIVER_ADDRESS ?? "",
        phrase: process.env.VENOM_MAIN_GIVER_PHRASE ?? "",
        accountId: 0,
      },
      keys: {
        amount: 20,
      },
    },
  },
  mocha: {
    timeout: 2000000,
    bail: true,
  },
};

export default config;
