import { Address } from "locklift/everscale-provider";

export const getExpectedTokenAmount = ({
  steps,
  successSteps,
  brokenSteps,
}: {
  steps: { amount: string; roots: Address[]; outcoming: Address }[];
  brokenSteps: Array<number>;
  successSteps: Array<number>;
}) => {
  const successTokensExpectedAmount = successSteps
    .map(successStep => steps[successStep])
    .reduce(
      (acc, next) => {
        return {
          tokenRoot: next.outcoming,
          amount: (Number(acc.amount) + Number(next.amount)).toString(),
        };
      },
      { tokenRoot: new Address(""), amount: "0" },
    );
  const brokenTokensExpectedAmount = brokenSteps
    .map(brokenStep => steps[brokenStep])
    .reduce((acc, next) => {
      const outcomingStringAddress = next.outcoming.toString();
      if (!(outcomingStringAddress in acc)) {
        acc[outcomingStringAddress] = "0";
      }
      acc[outcomingStringAddress] = (Number(acc[outcomingStringAddress]) + Number(next.amount)).toString();
      return acc;
    }, {} as Record<string, string>);

  return {
    successTokensExpectedAmount,
    brokenTokensExpectedAmount,
  };
};
