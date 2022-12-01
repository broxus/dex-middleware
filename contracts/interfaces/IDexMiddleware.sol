pragma ever-solidity >=0.62.0;
pragma AbiHeader expire;

import "../lib/CommonStructures.sol";

interface IDexMiddleware {
     function buildPayload(
        CommonStructures.PayloadForDex[] _payloadsForDex,
        CommonStructures.PayloadForTransfer[] _payloadsForTransfers,
        address remainingTokensTo
    ) external pure returns (TvmCell);
    function onChildRequestTokens(uint128 _childNonce,address _rootWallet, uint128 _tokensAmount) external;
    function setIsPaused(bool _isPaused) external;
    function setChildCode(TvmCell dexMiddlewareChildCode) external;
    function calculateFeeAndTokensValue(
        CommonStructures.PayloadForDex[] _payloadsForDex,
        CommonStructures.PayloadForTransfer[] _payloadsForTransfer
    ) external pure returns (CommonStructures.CalculationResult);
}
