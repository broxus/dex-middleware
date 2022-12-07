pragma ever-solidity >=0.62.0;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

import "./CommonStructures.sol";

library Payload {
    function buildPayload(
        CommonStructures.PayloadForDex[] _payloadsForDex,
        CommonStructures.PayloadForTransfer[] _payloadsForTransfers,
        CommonStructures.PayloadForBurn[] _payloadForBurn,
        address remainingTokensTo
    ) public  returns(TvmCell) {
        return abi.encode(
            _payloadsForDex,
            _payloadsForTransfers,
            _payloadForBurn,
            remainingTokensTo
        );
    }

    function encodePayload(TvmCell _payload) internal returns (
        CommonStructures.PayloadForDex[],
        CommonStructures.PayloadForTransfer[],
        CommonStructures.PayloadForBurn[],
        address
    ) {
        return abi.decode(
            _payload,
            (
                CommonStructures.PayloadForDex[],
                CommonStructures.PayloadForTransfer[],
                CommonStructures.PayloadForBurn[],
                address
            )
        );
    }
}
