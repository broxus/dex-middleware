pragma ever-solidity >=0.62.0;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

import "./CommonStructures.sol";

library Payload {
    function buildPayload(
        CommonStructures.PayloadForDex[] _payloadsForDex,
        CommonStructures.PayloadForTransfer[] _payloadsForTransfers,
        address remainingTokensTo
    ) public  returns(TvmCell) {
        return abi.encode(_payloadsForDex, _payloadsForTransfers, remainingTokensTo);
    }

    function encodePayload(TvmCell _payload) internal returns (CommonStructures.PayloadForDex[], CommonStructures.PayloadForTransfer[], address) {
        return abi.decode(_payload, (CommonStructures.PayloadForDex[], CommonStructures.PayloadForTransfer[], address));
    }
}
