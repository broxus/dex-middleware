pragma ever-solidity >=0.62.0;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

import "./ReceiverAfterDex.sol";

contract ReceiversFactory {
    TvmCell static _receiverCode;
    uint128 static _nonce;
    uint128 childCounter;
    event ReceiverDeployed(address receiver);

    constructor() public {
        tvm.accept();
    }

    function getChildPayload(string text) public pure returns (TvmCell) {
       return abi.encode(text);
    }


    function deployReceivers(uint128 count) public {
        for (uint128 i; i < count; i++) {
            address childAddress = new ReceiverAfterDex{
                stateInit: tvm.buildStateInit({
                    contr:ReceiverAfterDex,
                    varInit:{
                        root: address(this),
                        _nonce: childCounter++
                    },
                    pubkey: 0,
                    code: _receiverCode
                }),
                value: 0.1 ever
            }();
            emit ReceiverDeployed(childAddress);
        }
    }

}