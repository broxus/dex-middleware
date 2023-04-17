let tokens = {};

function getPoolName(pool_tokens: Array<any>) {
  return pool_tokens.reduce((acc, token) => acc + tokens[token].symbol, "");
}

function isLpToken(token, pool_roots) {
  return token.slice(-2) === "Lp" && !pool_roots.includes(token);
}
export const getPayload = async () => {};
