pragma ever-solidity >=0.62.0;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

library Constants {
    // COMMON
    uint128 constant DEPLOY_WALLET_VALUE = 0.1 ever;

    // ROOT
    uint128 constant ROOT_CONTRACT_MIN_BALANCE = 1 ever;
    uint128 constant DEPLOY_CHILD_VALUE = 0.1 ever;
    // CHILD
    uint128 constant CHILD_CONTRACT_MIN_BALANCE = 0.1 ever;
    uint128 constant REQUEST_TOKEN_WALLET_ADDRESS_VALUE = 0.05 ever;
}
