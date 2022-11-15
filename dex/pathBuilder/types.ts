import { Address } from "locklift";

type RouteLeaf = {
  outcoming: string;
  roots: Array<string>;
  numerator: number;
  nextSteps: Array<RouteLeaf>;
};

export type Route = Array<RouteLeaf>;
export type Tokens = Record<string, Token>;
export type Token = {
  symbol: string;
  decimals: number;
  address: Address;
};

export const defaultRoute: Route = [
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
];
