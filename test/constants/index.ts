export const PreBuiltRoutes = {
  succesSimpleRoute: {
    route: {
      outcoming: "qwe",
      roots: ["foo", "bar", "qwe"],
      contract_name: "DexStablePool",
      numerator: 1,
      nextSteps: [
        {
          outcoming: "tst",
          roots: ["qwe", "tst", "coin"],
          contract_name: "DexStablePool",
          numerator: 1,
          nextSteps: [],
        },
      ],
    },

    leaves: 2,
    start_token: "bar",
  },

  successMultiRoutes: (amountIncrease: number) => ({
    route: {
      outcoming: "bar",
      roots: ["foo", "bar", "qwe"],
      numerator: 1,
      amountIncrease,

      nextSteps: [
        {
          outcoming: "foo",
          roots: ["foo", "bar"],
          numerator: 1,
          amountIncrease,
          nextSteps: [
            { outcoming: "tst", roots: ["tst", "foo"], numerator: 2, nextSteps: [], amountIncrease },

            {
              outcoming: "coin",
              roots: ["foo", "coin"],
              numerator: 3,
              amountIncrease,

              nextSteps: [
                {
                  outcoming: "tst",
                  roots: ["qwe", "tst", "coin"],
                  numerator: 1,
                  nextSteps: [],
                  amountIncrease,
                },
              ],
            },
          ],
        },
      ],
    },
    leaves: 2,
    start_token: "qwe",
    successSteps: [0, 1],
    brokenSteps: [],
  }),

  failMultiRoutes: (amountIncrease: number) => ({
    route: {
      outcoming: "bar",
      roots: ["foo", "bar", "qwe"],
      numerator: 1,
      amountIncrease,
      nextSteps: [
        {
          outcoming: "foo",
          roots: ["foo", "bar"],
          numerator: 1,
          amountIncrease,
          nextSteps: [
            {
              outcoming: "tst",
              roots: ["tst", "foo"],
              numerator: 1,
              nextSteps: [],
              amountIncrease: amountIncrease,
            },
            {
              outcoming: "coin",
              roots: ["foo", "coin"],
              numerator: 1,
              amountIncrease: amountIncrease,

              nextSteps: [
                {
                  outcoming: "tst",
                  roots: ["qwe", "tst", "coin"],
                  numerator: 1,
                  nextSteps: [],
                  amountIncrease: 1000000000000000000000000000000000000000000000000000000000000000000000000,
                },
              ],
            },
          ],
        },
      ],
    },
    leaves: 2,
    start_token: "qwe",
    successSteps: [0],
    brokenSteps: [2],
  }),
  failSimpleRoute: {
    route: {
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
            { outcoming: "tst", roots: ["tst", "foo"], numerator: 2, nextSteps: [], amountIncrease: -0.1 },

            {
              outcoming: "coin",
              roots: ["foo", "coin"],
              numerator: 3,
              nextSteps: [
                {
                  outcoming: "tst",
                  roots: ["qwe", "tst", "coin"],
                  numerator: 1,
                  nextSteps: [],
                  amountIncrease: 0.01,
                },
              ],
            },
          ],
        },
      ],
    },
    leaves: 3,
    start_token: "qwe",
    successSteps: [0, 1],
    brokenSteps: [3],
  },
};
