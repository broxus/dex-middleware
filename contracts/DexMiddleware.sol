pragma ever-solidity >=0.62.0;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

import "./lib/Payload.sol";
import "./lib/Constants.sol";

import "./interfaces/IDexMiddleware.sol";
import "./DexChildMiddleware.sol";
import "./base/DexMiddlewareBase.sol";

import "broxus-ton-tokens-contracts/contracts/interfaces/IAcceptTokensTransferCallback.sol";
import "broxus-ton-tokens-contracts/contracts/interfaces/IAcceptTokensMintCallback.sol";

import "@broxus/contracts/contracts/libraries/MsgFlag.sol";
import "broxus-ton-tokens-contracts/contracts/interfaces/ITokenWallet.sol";
import "broxus-ton-tokens-contracts/contracts/abstract/TokenWalletDestroyableBase.sol";
import "dex/contracts/libraries/DexGas.sol";

import "locklift/src/console.sol";


contract DexMiddleware is IAcceptTokensTransferCallback, DexMiddlewareBase {

    constructor() public {
        // TODO: стандартная необходимая проверка при деплое внешним ключом
        require (tvm.pubkey() != 0, 123123);
        require (tvm.pubkey() == msg.pubkey(), 123123);
        tvm.accept();
    }


    function onAcceptTokensTransfer(
        address,
        uint128 _amount,
        address,
        address,
        address _remainingGasTo,
        TvmCell _payload
    ) override external {

        handleTokensTransfer(
            _amount,
            _remainingGasTo,
            _payload
        );
    }

    function onAcceptTokensMint(
        address,
        uint128 _amount,
        address _remainingGasTo,
        TvmCell _payload
    ) external {
        handleTokensTransfer(
            _amount,
            _remainingGasTo,
            _payload
        );
    }

    function calculateFeeAndTokensValue(
        CommonStructures.PayloadForDex[] _payloadsForDex,
        CommonStructures.PayloadForTransfer[] _payloadsForTransfer
    ) override public pure returns (CommonStructures.CalculationResult) {
        uint128 requiredValue;
        uint128 requiredTokenAmount;
        for (CommonStructures.PayloadForTransfer _transferConfig : _payloadsForTransfer) {
            requiredTokenAmount += _transferConfig.amount;
            requiredValue += (_transferConfig.attachedValue + _transferConfig.deployWalletValue);
        }

        for (CommonStructures.PayloadForDex _dexConfig : _payloadsForDex) {
            requiredTokenAmount += _dexConfig.tokensAmount;

            uint128 maxValueForFinalTransfer = math.max(_dexConfig.successPayload.valueForFinalTransfer, _dexConfig.cancelPayload.valueForFinalTransfer);

            uint128 maxDeployWalletValue = math.max(
                math.max(_dexConfig.successPayload.deployWalletValue, _dexConfig.cancelPayload.deployWalletValue),
                Constants.DEPLOY_WALLET_VALUE
            );

            requiredValue += Constants.DEPLOY_CHILD_VALUE +
                _dexConfig.leaves *
                (
                    maxValueForFinalTransfer +
                    maxDeployWalletValue +
                    DexGas.CROSS_POOL_EXCHANGE_MIN_VALUE
                );
        }

        return CommonStructures.CalculationResult({
            everValue: requiredValue,
            tokenAmount: requiredTokenAmount
        });
    }
    function checkIsEnoughValueAndTokens(
        CommonStructures.PayloadForDex[] _payloadsForDex,
        CommonStructures.PayloadForTransfer[] _payloadsForTransfer,
        uint128 _receivedTokensAmount
    ) internal returns(bool, uint128) {
        CommonStructures.CalculationResult calculationResult = calculateFeeAndTokensValue(_payloadsForDex, _payloadsForTransfer);
        if (msg.value < calculationResult.everValue) {
            return (false, 0);
        }
        if (_receivedTokensAmount < calculationResult.tokenAmount) {
            return (false, 0);
        }
        uint128 extraTokensAmount = _receivedTokensAmount - calculationResult.tokenAmount;
        return (true, _receivedTokensAmount - calculationResult.tokenAmount);
    }

    function handleTokensTransfer(
        uint128 _amount,
        address _remainingGasTo,
        TvmCell _payload
    ) internal {
        tvm.rawReserve(_reserve(), 0);

        (
            CommonStructures.PayloadForDex[] payloadsForDex,
            CommonStructures.PayloadForTransfer[] payloadsForTransfer,
            address remainingTokensTo
        ) = Payload.encodePayload(_payload);

        (
            bool isEnoughTokensAndValue,
            uint128 extraTokensAmount
        ) = checkIsEnoughValueAndTokens(payloadsForDex, payloadsForTransfer, _amount);

        if (!isEnoughTokensAndValue || isPaused) {
            ITokenWallet(msg.sender).transfer{value: 0, flag:MsgFlag.ALL_NOT_RESERVED, bounce: false}(
                _amount,
                remainingTokensTo,
                0,
                _remainingGasTo,
                true,
                _payload
            );
            return;
        }

        if (extraTokensAmount > 0) {
            ITokenWallet(msg.sender).transfer{value: Constants.EXTRA_TOKENS_TRANSFER_VALUE, bounce: false}(
                extraTokensAmount,
                remainingTokensTo,
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
        CommonStructures.PayloadForTransfer[] _payloadsForTransfers,
        address remainingTokensTo
    ) override external pure returns (TvmCell) {
        return Payload.buildPayload(_payloadsForDex, _payloadsForTransfers, remainingTokensTo);
    }
}
