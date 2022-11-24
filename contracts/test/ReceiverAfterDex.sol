pragma ever-solidity >=0.62.0;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

import "broxus-ton-tokens-contracts/contracts/interfaces/IAcceptTokensTransferCallback.sol";
import "locklift/src/console.sol";


contract ReceiverAfterDex is IAcceptTokensTransferCallback {
    uint128 private static _nonce;
    address private static root;
    constructor() public {}
    event onReceiveTokens(address from, uint128 amount, string message);


    function onAcceptTokensTransfer(
        address _tokenRoot,
        uint128 _amount,
        address _sender,
        address _senderWallet,
        address _remainingGasTo,
        TvmCell _payload
    ) override external {
        TvmSlice messageSlice = _payload.toSlice();
        string message = messageSlice.decode(string);
        emit onReceiveTokens(_sender, _amount, message);
    }
}