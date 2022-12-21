import { Address, Contract, toNano, zeroAddress } from "locklift";
import { Migration } from "../migration";
import { DexPairAbi, DexStablePairAbi, DexStablePoolAbi } from "../../build/factorySource";
import BigNumber from "bignumber.js";
import { Account } from "everscale-standalone-client";
import { Constants, dummyContract } from "./utils";

BigNumber.config({ EXPONENTIAL_AT: 257 });

// program
//   .allowUnknownOption()
//   .option("-a, --amount <amount>", "Amount of first token for exchange")
//   .option("-st, --start_token <start_token>", "Spent token")
//   .option("-r, --route <route>", "Exchange route")
//
//   .option("-prcn, --pair_contract_name <pair_contract_name>", "DexPair contract name")
//   .option("-plcn, --pool_contract_name <pool_contract_name>", "DexPool contract name");
//
// program.parse(process.argv);
//
// const options = program.opts();
//
// options.amount = options.amount ? +options.amount : 100;
// options.start_token = options.start_token ? options.start_token : "foo";
// options.route = options.route ? JSON.parse(options.route) : [];
// options.pair_contract_name = options.pair_contract_name || "DexPair";
// options.pool_contract_name = options.pool_contract_name || "DexStablePool";
const migration = new Migration();
type Options = {
  amount: number;
  start_token: string;
  route: Array<any>;
};
const EMPTY_TVM_CELL = "te6ccgEBAQEAAgAAAA==";

let tokens = {};
let DexRoot;
let DexVault;
let Account3;
let poolsContracts = {};
let tokenRoots = {};
let accountWallets = {};
let dexWallets = {};

let keyPairs;

function getPoolName(pool_tokens) {
  return pool_tokens.reduce((acc, token) => acc + tokens[token].symbol, "");
}

function isLpToken(token, pool_roots) {
  return token.slice(-2) === "Lp" && !pool_roots.includes(token);
}

async function getPoolTokensRoots(poolName, pool_tokens) {
  const Pool = poolsContracts[poolName];
  if (pool_tokens.length === 2) {
    // pairs
    // return Pool.call({ method: "getTokenRoots", params: {} });
    return (Pool as Contract<DexPairAbi>).methods
      .getTokenRoots({ answerId: 0 })
      .call()
      .then(res => {
        return res;
      });
  } else {
    // pools
    return (Pool as Contract<DexStablePoolAbi>).methods
      .getTokenRoots({ answerId: 0 })
      .call()
      .then(res => {
        return res.roots;
      });
  }
}

async function dexPoolInfo(pool_tokens) {
  let poolName = getPoolName(pool_tokens);
  const Pool = poolsContracts[poolName] as Contract<DexStablePoolAbi>;
  const poolRoots = await getPoolTokensRoots(poolName, pool_tokens);

  const balances = await Pool.methods
    .getBalances({ answerId: 0 })
    .call()
    .then(res => res.value0);

  let lp_supply = new BigNumber(balances.lp_supply).shiftedBy(-tokens[poolName + "Lp"].decimals).toString();

  let token_symbols, token_balances;
  if (pool_tokens.length === 2) {
    // pairs

    token_symbols = [tokens[pool_tokens[0]].symbol, tokens[pool_tokens[1]].symbol];
    if (poolRoots.left === tokenRoots[pool_tokens[0]].address) {
      token_balances = [
        new BigNumber(balances.left_balance).shiftedBy(-tokens[pool_tokens[0]].decimals).toString(),
        new BigNumber(balances.right_balance).shiftedBy(-tokens[pool_tokens[1]].decimals).toString(),
      ];
    } else {
      token_balances = [
        new BigNumber(balances.right_balance).shiftedBy(-tokens[pool_tokens[0]].decimals).toString(),
        new BigNumber(balances.left_balance).shiftedBy(-tokens[pool_tokens[1]].decimals).toString(),
      ];
    }
  } else {
    // pools
    token_symbols = [];
    token_balances = [];

    pool_tokens.forEach(token => {
      const idx = poolRoots.findIndex(token_root => token_root === tokenRoots[token].address);
      token_symbols.push(tokens[token].symbol);
      token_balances.push(new BigNumber(balances.balances[idx]).shiftedBy(-tokens[token].decimals).toString());
    });
  }

  return {
    symbols: token_symbols,
    balances: token_balances,
    lp_symbol: poolName + "Lp",
    lp_supply: lp_supply,
  };
}
export type Config = {
  options: Options;
  recipient: Address;
  callbackPayloads?: { success?: string; cancel?: string };
};

export const getPayload = async ({
  recipient,
  options: { start_token, route, amount },
  callbackPayloads,
}: Config): Promise<{
  payload: string;
  firstPool: Address;
  finalExpectedAmount: string;
  steps: Array<{ amount: string; roots: Array<Address>; outcoming: Address }>;
}> => {
  keyPairs = await locklift.keystore.getSigner("0");

  DexRoot = migration.load("DexRoot");
  DexVault = migration.load("DexVault");
  Account3 = migration.load("Account3");

  console.log("DexRoot: " + DexRoot.address);
  console.log("DexVault: " + DexVault.address);
  console.log("Account#3: " + Account3.address);

  async function loadPoolsData(route) {
    for (let elem of route) {
      let pool_tokens = elem.roots;

      for (let token of pool_tokens) {
        if (token.slice(-2) === "Lp") {
          tokens[token] = { name: token, symbol: token, decimals: Constants.LP_DECIMALS, upgradeable: true };
        } else {
          tokens[token] = Constants.tokens[token];
        }

        if (tokenRoots[token] === undefined) {
          // const root = await locklift.factory.getContract("TokenRootUpgradeable", TOKEN_CONTRACTS_PATH);

          const root = migration.load(tokens[token].symbol + "Root");
          tokenRoots[token] = root;
          console.log(`${tokens[token].symbol}TokenRoot: ${root.address}`);
        }
      }
      let poolName = getPoolName(pool_tokens);
      tokens[poolName + "Lp"] = {
        name: poolName + "Lp",
        symbol: poolName + "Lp",
        decimals: Constants.LP_DECIMALS,
        upgradeable: true,
      };

      let pool: Contract<any> = dummyContract;
      if (pool_tokens.length === 2) {
        // pair
        // pool = await locklift.factory.getContract(pair_contract_name);

        const tokenLeft = tokens[pool_tokens[0]];
        const tokenRight = tokens[pool_tokens[1]];
        if (migration.exists(`DexPair${tokenLeft.symbol}${tokenRight.symbol}`)) {
          pool = migration.load(`DexPair${tokenLeft.symbol}${tokenRight.symbol}`);
          console.log(`DexPair${tokenLeft.symbol}${tokenRight.symbol}: ${pool.address}`);
        } else if (migration.exists(`DexPair${tokenRight.symbol}${tokenLeft.symbol}`)) {
          pool = migration.load(`DexPair${tokenRight.symbol}${tokenLeft.symbol}`);
          console.log(`DexPair${tokenRight.symbol}${tokenLeft.symbol}: ${pool.address}`);
        } else {
          console.log(`DexPair${tokenLeft.symbol}${tokenRight.symbol} NOT EXISTS`);
        }
      } else {
        if (migration.exists(`DexPool${poolName}`)) {
          pool = migration.load(`DexPool${poolName}`);
          console.log(`DexPool${poolName}: ${pool.address}`);
        } else {
          console.log(`DexPool${poolName} NOT EXISTS`);
        }
      }
      poolsContracts[poolName] = pool;

      await loadPoolsData(elem.nextSteps);
    }
  }
  await loadPoolsData(route);

  async function loadSingleTokenData(tokenId) {
    let dexWallet = dummyContract;
    const accountWallet = dummyContract;

    let tokenName =
      tokenId.slice(-2) === "Lp" && Constants.tokens[tokenId] === undefined
        ? tokenId
        : Constants.tokens[tokenId].symbol;

    if (tokenRoots[tokenId] === undefined) {
      tokens[tokenId] = { name: tokenId, symbol: tokenName, decimals: Constants.LP_DECIMALS, upgradeable: true };
      const root = migration.load(tokenName + "Root");
      tokenRoots[tokenId] = root;
      console.log(`${tokenName}TokenRoot: ${root.address}`);
    }
    if (accountWallets[tokenId] === undefined || dexWallets[tokenId] === undefined) {
      dexWallet = migration.load(tokenName + "VaultWallet");
      dexWallets[tokenId] = dexWallet;
      accountWallets[tokenId] = accountWallet;
      console.log(`${tokenName}VaultWallet: ${dexWallet.address}`);
    }
  }

  async function getRouteTokensInfo(route) {
    for (let elem of route) {
      await loadSingleTokenData(elem.outcoming);

      await getRouteTokensInfo(elem.nextSteps);
    }
  }

  await loadSingleTokenData(start_token);
  await getRouteTokensInfo(route);

  //  end before
  //  start build
  console.log("#################################################");

  async function getRouteDexPoolsInfo(route, poolsMap) {
    for (let elem of route) {
      let poolName = getPoolName(elem.roots);
      poolsMap[poolName] = await dexPoolInfo(elem.roots);

      await getRouteDexPoolsInfo(elem.nextSteps, poolsMap);
    }
  }

  const poolsStart = {};

  await getRouteDexPoolsInfo(route, poolsStart);

  const expectedPoolBalances = {};
  const steps: {
    amount: string;
    roots: Array<string>;
    outcoming: string;
    numerator: number;
    nextStepIndices: Array<number>;
  }[] = [];
  let currentAmount = new BigNumber(amount).shiftedBy(tokens[start_token].decimals).toString();

  let finalExpectedAmount = new BigNumber(0);
  let lastTokenN;
  let lastStepPools = [];

  // Calculate expected result
  console.log(`### EXPECTED ###`);

  async function getExpectedAmount(route, spent_token, spent_amount) {
    let denominator = route.reduce((partialSum, elem) => partialSum + elem.numerator, 0);

    let next_indices = [];

    for (let elem of route) {
      let pool_roots = elem.roots.map(token => tokenRoots[token].address);
      let poolName = getPoolName(elem.roots);
      const poolRoots = await getPoolTokensRoots(poolName, elem.roots);

      let partial_spent_amount = new BigNumber(spent_amount)
        .multipliedBy(elem.numerator)
        .dividedToIntegerBy(denominator)
        .toString();

      let expected, expected_amount;
      if (isLpToken(spent_token, elem.roots)) {
        // spent token is lp token of the current pool
        const outcomingIndex = poolRoots.findIndex(root => root === tokenRoots[elem.outcoming].address);
        //TODO
        // expected = await (poolsContracts[poolName] as Contract<DexStablePoolAbi>).call({
        //   method: "expectedWithdrawLiquidityOneCoin",
        //   params: {
        //     lp_amount: partial_spent_amount,
        //     outcoming: tokenRoots[elem.outcoming].address,
        //   },
        // });
        expected = await (poolsContracts[poolName] as Contract<DexStablePoolAbi>).methods
          .expectedWithdrawLiquidityOneCoin({
            lp_amount: partial_spent_amount,
            outcoming: tokenRoots[elem.outcoming].address,
            answerId: 0,
          })
          .call()
          .then(res => res.value0);
        debugger;
        expected_amount = expected.amounts[outcomingIndex];
      } else if (isLpToken(elem.outcoming, elem.roots)) {
        // receive token is lp token of the current pool
        const amounts = poolRoots.map(token_root =>
          elem.roots.find(token => token_root === tokenRoots[token].address) === spent_token
            ? partial_spent_amount
            : "0",
        );
        //TODO
        // expected = await poolsContracts[poolName].call({
        //   method: "expectedDepositLiquidityV2",
        //   params: {
        //     amounts: amounts,
        //   },
        // });
        expected = await (poolsContracts[poolName] as Contract<DexStablePoolAbi>).methods
          .expectedDepositLiquidityOneCoin({
            answerId: 0,
            spent_token_root: tokenRoots[spent_token].address,
            amount: partial_spent_amount,
          })
          .call()
          .then(res => res.value0);
        debugger;
        expected_amount = expected.lp_reward;
      } else {
        if (elem.roots.length === 2) {
          // pair
          //TODO
          // expected = await poolsContracts[poolName].call({
          //   method: "expectedExchange",
          //   params: {
          //     amount: partial_spent_amount,
          //     spent_token_root: tokenRoots[spent_token].address,
          //   },
          // });
          expected = await (poolsContracts[poolName] as Contract<DexPairAbi>).methods
            .expectedExchange({
              amount: partial_spent_amount,
              spent_token_root: tokenRoots[spent_token].address,
              answerId: 0,
            })
            .call()
            .then(res => res);
        } else {
          // pool

          expected = await (poolsContracts[poolName] as Contract<DexStablePoolAbi>).methods
            .expectedExchange({
              amount: partial_spent_amount,
              spent_token_root: tokenRoots[spent_token].address,
              receive_token_root: tokenRoots[elem.outcoming].address,
              answerId: 0,
            })
            .call()
            .then(res => res);
        }

        const expectedAmount = new BigNumber(expected.expected_amount);

        expected_amount = expectedAmount.plus(expectedAmount.multipliedBy(elem.amountIncrease || 0)).toFixed(0);
        console.log(`Original expected ${expectedAmount} -> ${expected_amount}`);
      }

      console.log();
      let tokenLeft = tokens[spent_token];
      let tokenRight = tokens[elem.outcoming];
      let logStr = `${new BigNumber(partial_spent_amount).shiftedBy(-tokenLeft.decimals)} ${tokenLeft.symbol}`;
      logStr += " -> ";
      logStr += `${new BigNumber(expected_amount).shiftedBy(-tokenRight.decimals)} ${tokenRight.symbol}`;
      if (isLpToken(spent_token, elem.roots)) {
        // spent token is lp token of the current pool
        logStr += `, fee = ${new BigNumber(expected.expected_fee).shiftedBy(-tokenRight.decimals)} ${
          tokenRight.symbol
        }`;
      } else if (isLpToken(elem.outcoming, elem.roots)) {
        // receive token is lp token of the current pool
        const pool_tokens = poolRoots.map(token_root =>
          elem.roots.find(token => token_root === tokenRoots[token].address),
        );

        expected.pool_fees.forEach(
          (pool_fee, idx) =>
            (logStr += `, fee = ${new BigNumber(pool_fee)
              .plus(expected.beneficiary_fees[idx])
              .shiftedBy(-tokens[pool_tokens[idx]].decimals)} ${tokens[pool_tokens[idx]].symbol}`),
        );
      } else {
        logStr += `, fee = ${new BigNumber(expected.expected_fee).shiftedBy(-tokenLeft.decimals)} ${tokenLeft.symbol}`;
      }
      console.log(logStr);

      const expected_balances = [];
      elem.roots.forEach((root, idx) => {
        if (root === spent_token) {
          expected_balances.push(
            new BigNumber(partial_spent_amount)
              .shiftedBy(-tokenLeft.decimals)
              .plus(poolsStart[poolName].balances[idx])
              .toString(),
          );
        } else if (root === elem.outcoming) {
          expected_balances.push(
            new BigNumber(poolsStart[poolName].balances[idx])
              .minus(new BigNumber(expected_amount).shiftedBy(-tokenRight.decimals))
              .toString(),
          );
        } else {
          expected_balances.push(poolsStart[poolName].balances[idx]);
        }
      });
      let expected_lp_supply;
      if (isLpToken(spent_token, elem.roots)) {
        // spent token is lp token of the current pool
        expected_lp_supply = new BigNumber(poolsStart[poolName].lp_supply)
          .minus(new BigNumber(partial_spent_amount).shiftedBy(-tokenLeft.decimals))
          .toString();
      } else if (isLpToken(elem.outcoming, elem.roots)) {
        // receive token is lp token of the current pool
        expected_lp_supply = new BigNumber(poolsStart[poolName].lp_supply)
          .plus(new BigNumber(expected_amount).shiftedBy(-tokenRight.decimals))
          .toString();
      } else {
        expected_lp_supply = poolsStart[poolName].lp_supply;
      }

      expectedPoolBalances[poolName] = { lp_supply: expected_lp_supply, balances: expected_balances };

      let next_step_indices = await getExpectedAmount(elem.nextSteps, elem.outcoming, expected_amount.toString());
      steps.push({
        amount: expected_amount.toString(),
        roots: pool_roots,
        outcoming: tokenRoots[elem.outcoming].address,
        numerator: elem.numerator,
        nextStepIndices: next_step_indices,
      });

      next_indices.push(steps.length - 1);

      if (!elem.nextSteps.length) {
        lastStepPools.push({ roots: elem.roots, amount: expected_amount.toString() });
      }
    }

    if (!route.length) {
      finalExpectedAmount = finalExpectedAmount.plus(spent_amount);
      lastTokenN = spent_token;
    }

    return next_indices;
  }

  let next_indices = await getExpectedAmount(route, start_token, currentAmount);
  console.log("");

  let poolName = getPoolName(route[0].roots);
  const firstPool = poolsContracts[poolName] as Contract<DexPairAbi>;

  let payload;
  if (route[0].roots.length === 2) {
    // pair
    const params = {
      _id: 0,
      _deployWalletGrams: locklift.utils.toNano("0.05"),
      _expectedAmount: steps[next_indices[0]].amount,
      _outcoming: steps[next_indices[0]].outcoming,
      _nextStepIndices: steps[next_indices[0]].nextStepIndices,
      _steps: steps,
      _recipient: Account3.address,
      _success_payload: callbackPayloads?.success ?? EMPTY_TVM_CELL,
      _cancel_payload: callbackPayloads?.cancel ?? EMPTY_TVM_CELL,
      _referral: zeroAddress,
    };
    console.log(`Call buildCrossPairExchangePayloadV2(${firstPool.address.toString()}`);

    console.log(`Call buildCrossPairExchangePayloadV2(${JSON.stringify(params, null, 4)})`);
    //TODO
    // payload = await firstPool.call({
    //   method: "buildCrossPairExchangePayloadV2",
    //   params,
    // });

    payload = await firstPool.methods
      .buildCrossPairExchangePayloadV2(params)
      .call()
      .then(res => res.value0);
  } else {
    // pool
    const params = {
      id: 0,
      deployWalletGrams: locklift.utils.toNano("0.05"),
      expectedAmount: steps[next_indices[0]].amount,
      outcoming: steps[next_indices[0]].outcoming,
      nextStepIndices: steps[next_indices[0]].nextStepIndices,
      steps: steps,
      success_payload: callbackPayloads?.success ?? EMPTY_TVM_CELL,
      cancel_payload: callbackPayloads?.cancel ?? EMPTY_TVM_CELL,
      recipient: recipient,
      referral: zeroAddress,
    };
    console.log(`Call buildCrossPairExchangePayload(${firstPool.address.toString()}`);

    console.log(`Call buildCrossPairExchangePayload(${JSON.stringify(params, null, 4)})`);
    //TODO
    // payload = await firstPool.call({
    //   method: "buildCrossPairExchangePayload",
    //   params,
    // });
    payload = await (firstPool as unknown as Contract<DexStablePoolAbi>).methods
      .buildCrossPairExchangePayload(params)
      .call()
      .then(res => res.value0);
  }
  //  end build
  return { payload, firstPool: firstPool.address, finalExpectedAmount: finalExpectedAmount.toString(), steps };
};
