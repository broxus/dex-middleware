import { Contract, getRandomNonce, Signer, toNano, WalletTypes } from "locklift";
import { FactorySource } from "../../build/factorySource";
import { Account } from "locklift/everscale-client";
import { Dex, getDexInstance } from "../../dex";
import BigNumber from "bignumber.js";

let sample: Contract<FactorySource["Sample"]>;
let signer: Signer;
let account: Account;
let dex: Dex;
describe.skip("Test Sample contract", async function () {
  before(async () => {
    signer = (await locklift.keystore.getSigner("0"))!;
    account = (
      await locklift.factory.accounts.addNewAccount({
        type: WalletTypes.MsigAccount,
        contract: "Wallet",
        mSigType: "SafeMultisig",
        initParams: {
          _randomNonce: getRandomNonce(),
        },
        constructorParams: {},
        value: toNano(100),
        publicKey: signer.publicKey,
      })
    ).account;
    dex = await getDexInstance();
  });
  describe("Contracts", async function () {
    it("Load contract factory", async function () {
      const START_TOKEN = "Qwe";
      const { tokenWallet, tokenDecimals } = await dex
        .getTokenRootByName({ tokenName: START_TOKEN })
        .methods.walletOf({ answerId: 0, walletOwner: account.address })
        .call()
        .then(async res => {
          return {
            tokenWallet: locklift.factory.getDeployedContract("TokenWalletUpgradeable", res.value0),
            tokenDecimals: (
              await dex.getTokenRootByName({ tokenName: START_TOKEN }).methods.decimals({ answerId: 0 }).call()
            ).value0,
          };
        });
      await dex.sendTokensTo({
        tokenName: START_TOKEN,
        receiver: account.address,
        amount: new BigNumber(1200).shiftedBy(Number(tokenDecimals)).toString(),
      });
      await tokenWallet.methods
        .balance({ answerId: 0 })
        .call()
        .then(res => console.log(res.value0));
      const { payload, firstPool } = await dex.getPayload(
        {
          recipient: account.address,
          options: {
            amount: 1000,
            // route: [
            //   {
            //     outcoming: "foo",
            //     roots: ["foo", "bar", "qwe"],
            //     numerator: 1,
            //     nextSteps: [
            //       {
            //         outcoming: "tst",
            //         roots: ["tst", "foo"],
            //         numerator: 1,
            //         nextSteps: [{ outcoming: "qwe", roots: ["qwe", "tst", "coin"], numerator: 1, nextSteps: [] }],
            //       },
            //       {
            //         outcoming: "tst",
            //         roots: ["tst", "foo"],
            //         numerator: 2,
            //         nextSteps: [{ outcoming: "qwe", roots: ["qwe", "tst", "coin"], numerator: 1, nextSteps: [] }],
            //       },
            //     ],
            //   },
            // ],
            route: [
              {
                outcoming: "bar",
                roots: ["foo", "bar", "qwe"],
                numerator: 1,
                nextSteps: [
                  {
                    outcoming: "foo",
                    roots: ["foo", "bar"],
                    numerator: 1,
                    nextSteps: [
                      { outcoming: "tst", roots: ["tst", "foo"], numerator: 2, nextSteps: [] },
                      {
                        outcoming: "coin",
                        roots: ["foo", "coin"],
                        numerator: 3,
                        nextSteps: [{ outcoming: "tst", roots: ["qwe", "tst", "coin"], numerator: 1, nextSteps: [] }],
                      },
                    ],
                  },
                ],
              },
            ],
            start_token: "qwe",
          },
        },
        account,
      );

      debugger;
      const transaction = await locklift.tracing.trace(
        tokenWallet.methods
          .transfer({
            amount: new BigNumber(1000).shiftedBy(Number(tokenDecimals)).toString(),
            payload,
            notify: true,
            remainingGasTo: account.address,
            recipient: firstPool,
            deployWalletValue: toNano(2),
          })
          .send({
            from: account.address,
            amount: toNano(5),
          }),
        { rise: false },
      );

      await dex
        .getTokenRootByName({ tokenName: "Tst" })
        .methods.walletOf({ answerId: 0, walletOwner: account.address })
        .call()
        .then(res =>
          locklift.factory
            .getDeployedContract("TokenWalletUpgradeable", res.value0)
            .methods.balance({ answerId: 0 })
            .call(),
        )
        .then(res => console.log(`Qwe balance is ${res.value0}`));
      await transaction.traceTree?.beautyPrint();
      console.log(`Total gas used ${transaction.traceTree.totalGasUsed()}`);
      debugger;
    });
  });
});
