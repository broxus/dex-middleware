import axios from "axios";
import { SwapConfig } from "./config";

type RouteStep = {
  spentCurrencyAddress: string;
  receiveCurrencyAddress: string;
  spentAmount: string;
  minimumReceiveAmount: string;
  expectedReceiveAmount: string;
  fee: string;
  priceImpact: string;
  actionType: string;
  poolAddress: string;
  currencyAddresses: Array<string>;
  poolType: "default";
};
type SwapPayloadResponse = {
  tokensTransferPayload: string;
  sendTo: string;
  everAmount: string;
  tokenAmount: string;
  minTokenAmountReceive: string;
  tokenAmountReceive: string;
};
export const getSwapPayload = (swapConfig: SwapConfig): Promise<SwapPayloadResponse> => {
  return axios
    .post<{ output: { swap: SwapPayloadResponse } }>("https://api-test-npools.flatqube.io/v2/middleware", {
      input: { swap: swapConfig },
    })
    .then(res => {
      debugger;
      return res.data.output.swap;
    });
};

type SwapWithUnwrap = {
  fromCurrencyAddress: string;
  whiteListUri: null;
  whiteListCurrencies: [];
  minTvl: string;
  deep: number;
  amount: string;
  slippage: string;
  id: null;
  remainingGasTo: string;
  successPayload: "payload base64";
  cancelPayload: {
    tokenReceiver: "address";
    valueForFinalTransfer: "123";
    deployWalletValue: "123";
    payload: "payload base64";
  };
};
export const getSwapPlusUnwrapPayload = swapConfig => {};
