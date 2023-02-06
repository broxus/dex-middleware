# DEX middleware - DeFi utility for making multi swaps, multi sends, multi burn, and combining it

## Deploy
Update `.env` file
```shell
yarn
```
```shell
yarn run deploy-main
```



## Entry point overview
1. First of all need to create a transfer payload via `DexMiddleware.buildPayload`. Each of the prams (except remainingTokensTo) can be an empty array
```solidity
 function buildPayload(
     CommonStructures.PayloadForDex[] _payloadsForDex, // multi-swap config
     CommonStructures.PayloadForTransfer[] _payloadsForTransfers, // tokens multi-send config
     CommonStructures.PayloadForBurn[] _payloadsForBurn, // tokens multi-burn config
     CommonStructures.PayloadForUnwrap[] _payloadForUnwrap,
     address remainingTokensTo // remaining tokens receiver
 ) override external pure returns (TvmCell);
```
2. Then calculate the required tokens and evers amount via `DexMiddleware.buildPayload` (optional step, but it can save mistakes)
```solidity
 function calculateFeeAndTokensValue(
      CommonStructures.PayloadForDex[] _payloadsForDex,
      CommonStructures.PayloadForTransfer[] _payloadsForTransfer,
      CommonStructures.PayloadForBurn[] _payloadsForBurn,
      CommonStructures.PayloadForUnwrap[] _payloadForUnwrap
 ) override public pure returns (CommonStructures.CalculationResult);
```
3. Send payload from step 1 with tokens and evers amount from point 2


## Multi-swap overview
A user can make an endless count of swaps in a single transaction with configuration success and cancel destination behavior.

Let's look at `CommonStructures.PayloadForDex` struct
```solidity
struct PayloadForDex {
     TvmCell dexPayload; //tokens transfer payload calculated by dex
     uint32 leaves; // count of successful transactions that dex will send
     address firstRoot; // entry pool address
     address remainingGasTo;
     uint128 tokensAmount; // amount of tokens that will be attached to the first transfer (first root) 
     uint128 valueForDexOperation; // ever value that will be attached to the first transfer
     uint128 deployWalletValue;
     mapping (address => address[]) rootToSendersAllowanceMap; // *rootToSendersAllowanceMap
     FinishTransaction successPayload; // * FinishTransaction
     FinishTransaction cancelPayload;// * FinishTransaction
 }
```
`rootToSendersAllowanceMap` - security field that prevents not expected transfers to the swap flow.

It should be configured with next rules:
- keys of this mapping is the allowed token root

- values of this mapping is the allowed senders array of this token

`FinishTransaction successPayload` and `FinishTransaction cancelPayload` destination behavior
```solidity
 struct FinishTransaction {
     address tokenReceiver;
     uint128 valueForFinalTransfer; // how many evers should be attached to the destination transfer
     uint128 deployWalletValue;
     TvmCell payload; // payload for destination transfer
 }
```
### Different between `successPayload` and `cancelPayload`
Dex swap includes so-called splits which mean transactions can be split to some other transaction.
Each split transaction can be `cancel` or `success`, so one of the main task of this project is
deciding of type of transaction and making the final transfer to the `success` or `cancel` destination point

## Multi-send overview
A user can make an endless count of transactions in a single transaction

Let's look at `CommonStructures.PayloadForTransfer`
```solidity
 struct PayloadForTransfer {
    address receiver; // tokens receiver
    address _remainingGasTo;
    uint128 amount; // tokens amount
    TvmCell payload; // payload for transfer
    uint128 attachedValue; // ever value for transfer
    uint128 deployWalletValue;
    bool notify;
}
```
This payload extended from `ITokenWallet.transfer` method but with some additional fields

## Multi-burn overview
A user can make an endless count of burns
Let's look at `CommonStructures.PayloadForBurn`
```solidity
 struct PayloadForBurn {
     address callbackTo; // who will be notified about tokens burn
     address remainingGasTo;
     uint128 amount; // burn amount
     TvmCell payload; // payload for burn receiver
     uint128 attachedValue; // ever value for burn receiver
 }
```
This payload extended from `IBurnableTokenWallet.burn` method but with some additional fields

# Hints
With Dex-Middleware we can build so huge flow in a single transaction.
Example flow:
1. Swap 100 USDT -> 0.1 WBTC
2. Send to three users  0.01 WBTC each
3. Burn 0.06 WBTC for the bridge contract
   And after this flow `remainingTokensTo` receiver will receive an extra amount of WBTC

# Api usage
examples of API usage can be found inside `scripts/e2e` 
