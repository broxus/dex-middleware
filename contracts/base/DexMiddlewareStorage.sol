pragma ever-solidity >=0.62.0;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

import "../interfaces/IDexMiddleware.sol";

abstract contract DexMiddlewareStorage is IDexMiddleware {
    uint128 public static nonce;
    TvmCell public static dexMiddlewareChildCode;

    uint128 currentChildNonce;
}