import { toNano } from "locklift";

export type _SwapConfig = {
  amount: string;
  deep: number;
  direction: "expectedexchange";
  fromCurrencyAddress: string;
  minTvl: string;
  slippage: string;
  toCurrencyAddress: string;
  whiteListCurrencies: Array<string>;
};

export type SwapConfig = {
  fromCurrencyAddress: string;
  toCurrencyAddress: string;
  whiteListUri: null;
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
export const config: { swapConfig: SwapConfig; dexMiddlewareAddress: string } = {
  dexMiddlewareAddress: "0:39307c672f3b0894e5ec7b872740a464b5563965deb488df750540d86c51feb3",
  swapConfig: {
    amount: "1000000000",
    id: null,
    whiteListUri: "",
    deep: 10,
    fromCurrencyAddress: "0:fe614b31763bf583d2a70eeb593277b8285530df151287bab309a991bce9b77e",
    minTvl: "0",
    slippage: "0.1",
    toCurrencyAddress: "0:c1e9a31f96ce6bbd261c9a0055df469c703daec27d250321ac422d4fc6e51eeb",
    whiteListCurrencies: [],
  },
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
  fromCurrencyAddress: "0:fe614b31763bf583d2a70eeb593277b8285530df151287bab309a991bce9b77e",
  minTvl: "0",
  slippage: "0.1",
  toCurrencyAddress: "0:be1a8eb70b7b334f69e79940df6920dfcc03fefc34abc444cb41cba342a320d5",
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
export const getDefaultSwapPlusUnwrapPayload = ({
  remainingGasTo,
  tokenReceiver,
}: {
  remainingGasTo: string;
  tokenReceiver: string;
}): SwapWithUnwrap => ({
  amount: "10000000",
  id: null,
  whiteListUri: null,
  remainingGasTo,
  cancelPayload: {
    payload: EMPTY_TVM_CELL,
    deployWalletValue: "0",
    tokenReceiver,
    valueForFinalTransfer: toNano(0.1),
  },
  successPayload: {
    payload: EMPTY_TVM_CELL,
    deployWalletValue: "0",
    tokenReceiver,
    valueForFinalTransfer: toNano(0.5),
  },
  deep: 10,
  fromCurrencyAddress: "0:fe614b31763bf583d2a70eeb593277b8285530df151287bab309a991bce9b77e",
  minTvl: "0",
  slippage: "0.1",
  whiteListCurrencies: [],
});
