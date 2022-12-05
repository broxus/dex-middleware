pragma ever-solidity >=0.62.0;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

import "../interfaces/IDexMiddleware.sol";

abstract contract DexMiddlewareStorage is IDexMiddleware {
    uint128 public static nonce;
    address public static owner;
    // TODO: надо бы иметь версию кода, при апгрейде делаем +1
    TvmCell public static dexMiddlewareChildCode;
    bool isPaused;

    uint128 currentChildNonce;

}
