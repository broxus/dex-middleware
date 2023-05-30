import { toNano } from "locklift";

export type SwapConfig = {
  fromCurrencyAddress: string;
  toCurrencyAddress: string;
  whiteListUri: null | string;
  whiteListCurrencies: Array<string>;
  minTvl: string;
  deep: number;
  amount: string;
  slippage: string;
  remainingGasTo: string;
  id: null;
  successPayload: {
    tokenReceiver: string;
    valueForFinalTransfer: string;
    deployWalletValue: string;
    payload: string;
  };
  cancelPayload: {
    tokenReceiver: string;
    valueForFinalTransfer: string;
    deployWalletValue: string;
    payload: string;
  };
};
const EMPTY_TVM_CELL = "te6ccgEBAQEAAgAAAA==";

export const getDefaultSwapPayload = ({
  remainingGasTo,
  tokenReceiver,
}: {
  remainingGasTo: string;
  tokenReceiver: string;
}): SwapConfig => ({
  amount: "1000000000",
  id: null,
  whiteListUri: null,
  remainingGasTo,
  cancelPayload: {
    payload: EMPTY_TVM_CELL,
    deployWalletValue: toNano(0.5),
    tokenReceiver,
    valueForFinalTransfer: toNano(0.5),
  },
  successPayload: {
    payload: EMPTY_TVM_CELL,
    deployWalletValue: toNano(0.5),
    tokenReceiver,
    valueForFinalTransfer: toNano(0.5),
  },
  deep: 10,
  fromCurrencyAddress: "0:c9dcc33efb227772f7337b5624c5edeada81e998433055f8edecf6d92e84e3bf",
  minTvl: "0",
  slippage: "0.1",
  toCurrencyAddress: "0:7da188001d36bf8feffd51f0a13811fc387e32fbc5591e19df1defec5c0ad28c",
  whiteListCurrencies: [],
});
export type SwapWithUnwrap = {
  fromCurrencyAddress: string;
  whiteListUri: null;
  whiteListCurrencies: [];
  minTvl: string;
  deep: number;
  amount: string;
  slippage: string;
  id: null;
  remainingGasTo: string;
  successPayload: {
    tokenReceiver: string;
    payload: string;
  };
  cancelPayload: {
    tokenReceiver: string;
    valueForFinalTransfer: string;
    deployWalletValue: string;
    payload: string;
  };
};
export const getDefaultSwapPlusUnwrapPayload = ({
  remainingGasTo,
  tokenReceiver,
}: {
  remainingGasTo: string;
  tokenReceiver: string;
}): SwapWithUnwrap => ({
  amount: "1000",
  id: null,
  whiteListUri: null,
  remainingGasTo,
  cancelPayload: {
    payload: EMPTY_TVM_CELL,
    deployWalletValue: toNano(0.1),
    tokenReceiver,
    valueForFinalTransfer: toNano(1),
  },
  successPayload: {
    payload: EMPTY_TVM_CELL,
    tokenReceiver,
    valueForFinalTransfer: toNano(1),
  },
  deep: 10,
  fromCurrencyAddress: "0:a519f99bb5d6d51ef958ed24d337ad75a1c770885dcd42d51d6663f9fcdacfb2",
  minTvl: "0",
  slippage: "0.1",
  whiteListCurrencies: [],
});

export type SwapWithBurn = {
  fromCurrencyAddress: string;
  toCurrencyAddress: string;
  whiteListUri: null;
  whiteListCurrencies: [];
  minTvl: string;
  deep: number;
  amount: string;
  slippage: string;
  id: null;
  remainingGasTo: string;
  successPayload: {
    destination: string;
    attachedValue: string;
    payload: string;
  };
  cancelPayload: {
    tokenReceiver: string;
    valueForFinalTransfer: string;
    deployWalletValue: string;
    payload: string;
  };
};
export const getDefaultSwapPlusBurnPayload = ({
  remainingGasTo,
  tokenReceiver,
}: {
  remainingGasTo: string;
  tokenReceiver: string;
}): SwapWithBurn => ({
  amount: "10000000",
  id: null,
  whiteListUri: null,
  remainingGasTo,
  cancelPayload: {
    payload: EMPTY_TVM_CELL,
    deployWalletValue: toNano(1),
    tokenReceiver,
    valueForFinalTransfer: toNano(1),
  },
  successPayload: {
    payload: EMPTY_TVM_CELL,
    attachedValue: toNano(1),
    destination: tokenReceiver,
  },
  deep: 10,
  fromCurrencyAddress: "0:c9dcc33efb227772f7337b5624c5edeada81e998433055f8edecf6d92e84e3bf",
  toCurrencyAddress: "0:7da188001d36bf8feffd51f0a13811fc387e32fbc5591e19df1defec5c0ad28c",
  minTvl: "0",
  slippage: "0.1",
  whiteListCurrencies: [],
});
