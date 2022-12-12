pragma ever-solidity >=0.62.0;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

import "./lib/CommonStructures.sol";
import "./lib/ErrorCodes.sol";
import "./lib/Constants.sol";
import "./lib/Payload.sol";
import "./interfaces/IDexMiddleware.sol";
import "./interfaces/IDexChildMiddleware.sol";


import "broxus-ton-tokens-contracts/contracts/interfaces/ITokenWallet.sol";
import "broxus-ton-tokens-contracts/contracts/interfaces/ITokenRoot.sol";
import "broxus-ton-tokens-contracts/contracts/abstract/TokenWalletDestroyableBase.sol";
import "@broxus/contracts/contracts/libraries/MsgFlag.sol";
import "broxus-ton-tokens-contracts/contracts/interfaces/IAcceptTokensTransferCallback.sol";
import "locklift/src/console.sol";
import "dex/contracts/libraries/DexOperationStatusV2.sol";



contract DexChildMiddleware is IAcceptTokensTransferCallback, IDexChildMiddleware {
    uint128 public static nonce;
    address public static root;

    address rootWallet;
    uint32 necessaryLeaves;
    address remainingGasTo;
    address firstRoot;
    CommonStructures.FinishTransaction successConfig;
    CommonStructures.FinishTransaction cancelConfig;
    uint128 initialTokensAmount;
    TvmCell dexPayload;

    uint16 countOfRoots;

    mapping(address => uint128) receivedTokens;
    mapping (address => mapping(address => bool)) rootToAllowedSenders;
    mapping (address => mapping(address => bool)) walletToAllowedSenders;
    bool isCanceledTransaction;

    constructor(
        address _rootWallet,
        TvmCell _dexPayload,
        uint128 _tokensAmount,
        mapping (address => address[]) _rootToSendersAllowanceMap,
        address _remainingGasTo,
        uint32 _leaves,
        address _firstRoot,
        CommonStructures.FinishTransaction _successConfig,
        CommonStructures.FinishTransaction _cancelConfig
    ) public {

        require(msg.sender == root, ErrorCodes.NOT_ROOT);
        rootWallet = _rootWallet;
        dexPayload = _dexPayload;
        initialTokensAmount = _tokensAmount;
        for ((address tokenRoot, address[] senders) : _rootToSendersAllowanceMap) {
            for (address sender : senders) {
                rootToAllowedSenders[tokenRoot][sender] = true;
            }
        }

        remainingGasTo = _remainingGasTo;
        necessaryLeaves = _leaves;
        firstRoot = _firstRoot;
        successConfig = _successConfig;
        cancelConfig = _cancelConfig;

        countOfRoots = uint16(_rootToSendersAllowanceMap.keys().length);

        for ((address rootAddress, ) : rootToAllowedSenders) {
            ITokenRoot(rootAddress).walletOf{
                value: 0.05 ever,
                callback: DexChildMiddleware.handleAddressReceived
            }(address(this));
        }

    }
    modifier onlyRoot() {
        require(msg.sender == root, ErrorCodes.NOT_ROOT);
        _;
    }
    modifier onlyAllowedAddresses(address tokensSender) {

        require(walletToAllowedSenders.exists(msg.sender), ErrorCodes.NOT_ALLOWED_TOKEN_WALLET);

        bool isAllowed = tokensSender == root || walletToAllowedSenders[msg.sender].exists(tokensSender);

        require(isAllowed, ErrorCodes.NOT_ALLOWED_TOKENS_SENDER);
        _;
    }

    modifier onlyAllowedRoot() {
        require(rootToAllowedSenders.exists(msg.sender));
        _;
    }


    function _reserve() internal pure returns (uint128) {
		return
			math.min(address(this).balance - msg.value, Constants.CHILD_CONTRACT_MIN_BALANCE);
	}

    function getFinalTransactionSettings() internal view returns (CommonStructures.FinishTransaction) {
        return isCanceledTransaction ? cancelConfig : successConfig;
    }

    function handleAddressReceived(address tokenWallet) external onlyAllowedRoot {
        walletToAllowedSenders[tokenWallet] = rootToAllowedSenders[msg.sender];
        countOfRoots--;
        if (countOfRoots == 0) {
            requestTokensFromRoot();
        }
    }

    function requestTokensFromRoot() internal view {
        IDexMiddleware(root).onChildRequestTokens{
            value: 0,
            flag: MsgFlag.ALL_NOT_RESERVED
        }(nonce, rootWallet, initialTokensAmount);
    }

    function handleRootTransfer(
        address,
        uint128 _amount,
        address _remainingGasTo
    ) internal view {
        ITokenWallet(msg.sender).transfer{value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false}(
            _amount,
            firstRoot,
            0,
            _remainingGasTo,
            true,
            dexPayload
        );
    }

    function handleSuccessDexTransfer(

        uint128 _amount,

        address _originalSender
    ) internal {

        require(address(this) == _originalSender, ErrorCodes.ONLY_SELF_SENDER);

        necessaryLeaves -= 1;

        receivedTokens[msg.sender] += _amount;
        if (necessaryLeaves == 0) {
            finalizeTransaction(getFinalTransactionSettings());
        }
    }

    function handleCancelDexTransfer(
        uint128 _amount,
        uint32 _brokenLeaves
    ) internal {
        receivedTokens[msg.sender] += _amount;
        necessaryLeaves -= _brokenLeaves;
        isCanceledTransaction = true;
        if (necessaryLeaves == 0) {
            finalizeTransaction(getFinalTransactionSettings());
        }
    }

    function finalizeTransaction(CommonStructures.FinishTransaction finalTransactionSettings) internal view {

        for ((address tokenWallet, uint128 tokensAmount) : receivedTokens) {
            ITokenWallet(tokenWallet).transfer{value: finalTransactionSettings.valueForFinalTransfer + finalTransactionSettings.deployWalletValue, bounce: false}(
                tokensAmount,
                finalTransactionSettings.tokenReceiver,
                finalTransactionSettings.deployWalletValue,
                remainingGasTo,
                true,
                finalTransactionSettings.payload
            );
        }

        for ((address tokenWallet, ) : walletToAllowedSenders) {
            TokenWalletDestroyableBase(tokenWallet).destroy{value: 0.05 ever, bounce: false}(remainingGasTo);
        }

        remainingGasTo.transfer({
            value: 0,
            flag: MsgFlag.ALL_NOT_RESERVED/* + MsgFlag.DESTROY_IF_ZERO Add destroy after testing*/,
            bounce: false
        });
    }

    function forceFinalize(bool isSuccess) onlyRoot override external {
        finalizeTransaction(isSuccess ? successConfig : cancelConfig);
    }

    function onAcceptTokensTransfer(
        address _tokenRoot,
        uint128 _amount,
        address _sender,
        address,
        address _remainingGasTo,
        TvmCell _payload
    ) override external onlyAllowedAddresses(_sender) {

        if (_sender == root) {
            handleRootTransfer(_tokenRoot, _amount, _remainingGasTo);
            return;
        }
        TvmSlice slicePayload = _payload.toSlice();
        (uint8 v2DexOperationType) = slicePayload.decode(uint8);

        if (v2DexOperationType == DexOperationStatusV2.SUCCESS) {
            (, TvmCell originalSender) = slicePayload.decode(TvmCell, TvmCell);
            handleSuccessDexTransfer(
                _amount,
                originalSender.toSlice().decode(address)
            );
            return;
        }

        if (v2DexOperationType == DexOperationStatusV2.CANCEL) {
            (, , TvmCell brokenLeavesCell) = slicePayload.decode(uint16, TvmCell, TvmCell);
            (uint32 brokenLeaves) = brokenLeavesCell.toSlice().decode(uint32);
            handleCancelDexTransfer(
                _amount,
                brokenLeaves
            );
        }

    }
}
