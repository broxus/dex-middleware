import axios from "axios";
import { SwapConfig, SwapWithBurn, SwapWithUnwrap } from "./config";

type SwapPayloadResponse = {
  tokensTransferPayload: string;
  sendTo: string;
  everAmount: string;
  tokenAmount: string;
  minTokenAmountReceive: string;
  tokenAmountReceive: string;
  deployWalletValue: string;
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

export const getSwapPlusUnwrapPayload = (swapConfig: SwapWithUnwrap) => {
  debugger;
  return axios
    .post<{ output: { swapAndUnwrapAll: SwapPayloadResponse } }>("https://api-test-npools.flatqube.io/v2/middleware", {
      input: { swapAndUnwrapAll: swapConfig },
    })
    .then(res => {
      debugger;
      return res.data.output.swapAndUnwrapAll;
    });
};

type SwapPlusBurnPayloadResponse = {
  tokensTransferPayload: string;
  sendTo: string;
  everAmount: string;
  tokenAmount: string;
  minTokenAmountBurn: string;
  tokenAmountBurn: string;
  deployWalletValue: string;
};
export const getSwapPlusBurnPayload = (swapConfig: SwapWithBurn) => {
  return axios
    .post<{ output: { swapAndBurn: SwapPlusBurnPayloadResponse } }>(
      "https://api-test-npools.flatqube.io/v2/middleware",
      {
        input: { swapAndBurn: swapConfig },
      },
    )
    .then(res => {
      debugger;
      return res.data.output.swapAndBurn;
    });
};
