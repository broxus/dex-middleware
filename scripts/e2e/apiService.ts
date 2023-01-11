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
  mapping: Record<string, Array<string>>;
  firstRoot: string;
  leaves: number;
  route: {
    steps: Array<RouteStep>;
    globalPriceImpact: string;
    globalFee: string;
  };
  payload: string;
  id: number;
  gas: string;
};
export const getSwapPayload = (swapConfig: SwapConfig): Promise<SwapPayloadResponse> => {
  return axios
    .post<SwapPayloadResponse>("https://api-test-npools.flatqube.io/v2/pools/cross_swap_payload_middleware", {
      crossPairInput: swapConfig,
    })
    .then(res => res.data);
};
