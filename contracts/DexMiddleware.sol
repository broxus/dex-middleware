pragma ever-solidity >=0.62.0;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

import "./lib/Payload.sol";
import "./lib/Constants.sol";

import "./interfaces/IDexMiddleware.sol";
import "./DexChildMiddleware.sol";
import "./base/DexMiddlewareBase.sol";

import "broxus-ton-tokens-contracts/contracts/interfaces/IAcceptTokensTransferCallback.sol";
import "@broxus/contracts/contracts/libraries/MsgFlag.sol";
import "broxus-ton-tokens-contracts/contracts/interfaces/ITokenWallet.sol";
import "broxus-ton-tokens-contracts/contracts/abstract/TokenWalletDestroyableBase.sol";
import "dex/contracts/libraries/DexGas.sol";

import "locklift/src/console.sol";


contract DexMiddleware is IAcceptTokensTransferCallback, DexMiddlewareBase {

    constructor() public {
        tvm.accept();
    }


    function onAcceptTokensTransfer(
        address _tokenRoot,
        uint128 _amount,
        address _sender,
        address _senderWallet,
        address _remainingGasTo,
        TvmCell _payload
    ) override external {

        handleTokensTransfer(
            _tokenRoot,
            _amount,
            _sender,
            _senderWallet,
            _remainingGasTo,
            _payload
        );
    }

    function checkIsEnoughValue(
        CommonStructures.PayloadForDex[] _payloadsForDex,
        CommonStructures.PayloadForTransfer[] _payloadsForTransfer,
        uint128 _amount
    ) internal returns(bool) {
        uint128 msgValue = msg.value;
        uint128 amount = _amount;
        for (CommonStructures.PayloadForTransfer _transferConfig : _payloadsForTransfer) {
            if (msgValue < _transferConfig.attachedValue + _transferConfig.deployWalletValue) {
                return false;
            }

            if (amount < _transferConfig.amount) {
                return false;
            }
            amount -= _transferConfig.amount;
            msgValue -= (_transferConfig.attachedValue + _transferConfig.deployWalletValue);
        }

        for (CommonStructures.PayloadForDex _dexConfig : _payloadsForDex) {
            if (msgValue < _dexConfig.attachedValue) {
                return false;
            }

            if (amount < _dexConfig.tokensAmount) {
                return false;
            }

            amount -= _dexConfig.tokensAmount;

            uint128 maxValueForFinalTransfer = math.max(_dexConfig.successPayload.valueForFinalTransfer, _dexConfig.cancelPayload.valueForFinalTransfer);

            uint128 maxDeployWalletValue = math.max(
                math.max(_dexConfig.successPayload.deployWalletValue, _dexConfig.cancelPayload.deployWalletValue),
                Constants.DEPLOY_WALLET_VALUE
            );

            uint128 requiredAttachedValue = Constants.DEPLOY_CHILD_VALUE +
                _dexConfig.leaves *
                (
                    maxValueForFinalTransfer +
                    maxDeployWalletValue +
                    DexGas.CROSS_POOL_EXCHANGE_MIN_VALUE
                );

            if  (_dexConfig.attachedValue < requiredAttachedValue) {
                return false;
            }

            msgValue -= _dexConfig.attachedValue;
        }
        return true;
    }

    function handleTokensTransfer(
        address _tokenRoot,
        uint128 _amount,
        address _sender,
        address _senderWallet,
        address _remainingGasTo,
        TvmCell _payload
    ) internal {
        tvm.rawReserve(_reserve(), 0);

        (
            CommonStructures.PayloadForDex[] payloadsForDex,
            CommonStructures.PayloadForTransfer[] payloadsForTransfer
        ) = Payload.encodePayload(_payload);

        if (!checkIsEnoughValue(payloadsForDex, payloadsForTransfer, _amount)) {
            ITokenWallet(msg.sender).transfer{value: 0, flag:MsgFlag.ALL_NOT_RESERVED, bounce: false}(
                _amount,
                _sender,
                0,
                _remainingGasTo,
                true,
                _payload
            );
        }
        makeTransfers(payloadsForTransfer);
        createChildProcesses(payloadsForDex);
        _remainingGasTo.transfer({value: 0, flag:MsgFlag.ALL_NOT_RESERVED, bounce: false});
    }

    function makeTransfers(CommonStructures.PayloadForTransfer[] _payloadsForTransfer) internal {
        for (CommonStructures.PayloadForTransfer transferConfig : _payloadsForTransfer) {

            ITokenWallet(msg.sender).transfer{value: transferConfig.attachedValue + transferConfig.deployWalletValue, bounce: false}(
                transferConfig.amount,
                transferConfig.receiver,
                transferConfig.deployWalletValue,
                transferConfig._remainingGasTo,
                transferConfig.notify,
                transferConfig.payload
            );

        }
    }

    function createChildProcesses(CommonStructures.PayloadForDex[] _payloadsForDex) internal {

        for (CommonStructures.PayloadForDex dexConfig : _payloadsForDex) {
            address childAddress = deployChild(
                currentChildNonce++,
                msg.sender,
                dexConfig.dexPayload,
                dexConfig.tokensAmount,
                dexConfig.attachedValue,
                dexConfig.rootToSendersAllowanceMap,
                dexConfig.leaves,
                dexConfig.firstRoot,
                dexConfig.remainingGasTo,
                dexConfig.successPayload,
                dexConfig.cancelPayload
            );
        }
    }

    function onChildRequestTokens(uint128 _childNonce,address _rootWallet, uint128 _tokensAmount) override external onlyChild(_childNonce) {
            tvm.rawReserve(_reserve(), 0);
            TvmCell dummyPayload;
            uint128 deployChildWalletValue = msg.value / 2;
            ITokenWallet(_rootWallet).transfer{value:0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false}(
                _tokensAmount,
                msg.sender,
                deployChildWalletValue,
                msg.sender,
                true,
                dummyPayload
            );
    }

    function buildPayload(
        CommonStructures.PayloadForDex[] _payloadsForDex,
        CommonStructures.PayloadForTransfer[] _payloadsForTransfers
    ) override external pure returns (TvmCell) {
        return Payload.buildPayload(_payloadsForDex, _payloadsForTransfers);
    }
}
