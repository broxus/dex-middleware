pragma ever-solidity >=0.62.0;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

import "../interfaces/IDexMiddleware.sol";

abstract contract DexMiddlewareStorage is IDexMiddleware {
    uint128 public static nonce;
    address public static owner;
    uint32 dexMiddlewareVersion = 1;
    TvmCell public static dexMiddlewareChildCode;
    bool isPaused;

    uint128 currentChildNonce;
    uint32 childVersion;
}
