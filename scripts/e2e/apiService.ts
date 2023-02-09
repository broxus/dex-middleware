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

export const getSwapPayload = (swapConfig: SwapConfig, apiEndpoint: string): Promise<SwapPayloadResponse> => {
  return axios
    .post<{ output: { swap: SwapPayloadResponse } }>(`${apiEndpoint}/v2/middleware`, {
      input: { swap: swapConfig },
    })
    .then(res => {
      debugger;
      return res.data.output.swap;
    });
};

export const getSwapPlusUnwrapPayload = (swapConfig: SwapWithUnwrap, apiEndpoint: string) => {
  debugger;
  return axios
    .post<{ output: { swapAndUnwrapAll: SwapPayloadResponse } }>(`${apiEndpoint}/v2/middleware`, {
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
export const getSwapPlusBurnPayload = (swapConfig: SwapWithBurn, apiEndpoint: string) => {
  return axios
    .post<{ output: { swapAndBurn: SwapPlusBurnPayloadResponse } }>(`${apiEndpoint}/v2/middleware`, {
      input: { swapAndBurn: swapConfig },
    })
    .then(res => {
      debugger;
      return res.data.output.swapAndBurn;
    })
    .catch(e => {
      console.log(e);
      throw new Error(e);
    });
};
