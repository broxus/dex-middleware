export type SwapConfig = {
  amount: string;
  deep: number;
  direction: "expectedexchange";
  fromCurrencyAddress: string;
  minTvl: string;
  slippage: string;
  toCurrencyAddress: string;
  whiteListCurrencies: Array<string>;
};
export const config: { swapConfig: SwapConfig; dexMiddlewareAddress: string } = {
  dexMiddlewareAddress: "0:39307c672f3b0894e5ec7b872740a464b5563965deb488df750540d86c51feb3",
  swapConfig: {
    amount: "1000000000",
    deep: 10,
    direction: "expectedexchange",
    fromCurrencyAddress: "0:fe614b31763bf583d2a70eeb593277b8285530df151287bab309a991bce9b77e",
    minTvl: "0",
    slippage: "0.1",
    toCurrencyAddress: "0:c1e9a31f96ce6bbd261c9a0055df469c703daec27d250321ac422d4fc6e51eeb",
    whiteListCurrencies: [
      "0:fe614b31763bf583d2a70eeb593277b8285530df151287bab309a991bce9b77e",
      "0:751b9d0f8c629d004a2a746bf34ba09c0c6ebbd9cc3f375b6259b85f69d6e18d",
      "0:be1a8eb70b7b334f69e79940df6920dfcc03fefc34abc444cb41cba342a320d5",
      "0:c1e9a31f96ce6bbd261c9a0055df469c703daec27d250321ac422d4fc6e51eeb",
    ],
  },
};
