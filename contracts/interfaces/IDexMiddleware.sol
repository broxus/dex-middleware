pragma ever-solidity >=0.62.0;
pragma AbiHeader expire;

import "../lib/CommonStructures.sol";

interface IDexMiddleware {

    struct Details {
        uint128  nonce;
        address  owner;
        uint32 dexMiddlewareVersion;
        bool isPaused;
        uint128 currentChildNonce;
        uint32 childVersion;
    }

    event OwnerChanged(address newOwner);
    event PauseStateChanged(bool newState);
    event ChildCodeUpdated(uint128 newVersion);
    function getDetails() external responsible view returns (Details);
    function transferOwnership(address _newOwner) external;
    function buildPayload(
    CommonStructures.PayloadForDex[] _payloadsForDex,
    CommonStructures.PayloadForTransfer[] _payloadsForTransfers,
    CommonStructures.PayloadForBurn[] _payloadsForBurn,
    address remainingTokensTo
    ) external pure returns (TvmCell);

    function onChildRequestTokens(uint128 _childNonce,address _rootWallet, uint128 _tokensAmount) external;

    function setIsPaused(bool _isPaused) external;

    function setChildCode(TvmCell dexMiddlewareChildCode) external;

    function calculateFeeAndTokensValue(
    CommonStructures.PayloadForDex[] _payloadsForDex,
    CommonStructures.PayloadForTransfer[] _payloadsForTransfer,
    CommonStructures.PayloadForBurn[] _payloadsForBurn
    ) external pure returns (CommonStructures.CalculationResult);

    function forceChildsFinalize(CommonStructures.ForceChildFinalize[] childsSettings) external;
    function upgrade(TvmCell _newCode, uint32 _newVersion, address _sendGaTo) external;
}
