pragma ever-solidity >=0.62.0;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

import "./lib/CommonStructures.sol";
import "./lib/ErrorCodes.sol";
import "./lib/Constants.sol";
import "./lib/Payload.sol";
import "./interfaces/IDexMiddleware.sol";

import "broxus-ton-tokens-contracts/contracts/interfaces/ITokenWallet.sol";
import "broxus-ton-tokens-contracts/contracts/interfaces/ITokenRoot.sol";
import "broxus-ton-tokens-contracts/contracts/abstract/TokenWalletDestroyableBase.sol";
import "@broxus/contracts/contracts/libraries/MsgFlag.sol";
import "broxus-ton-tokens-contracts/contracts/interfaces/IAcceptTokensTransferCallback.sol";
import "locklift/src/console.sol";


contract DexChildMiddleware is IAcceptTokensTransferCallback {
    uint128 public static nonce;
    address public static root;

    address rootWallet;
    uint32 necessaryLeaves;
    address remainingGasTo;
    address firstRoot;
    CommonStructures.FinishTransaction successConfig;
    CommonStructures.FinishTransaction cancelConfig;
    uint128 initialTokensAmount;
    TvmCell dexPaylod;

    uint256 receivedRootsCounter;
    uint256 countOfRoots;

    mapping(address => uint128) receivedTokens;
    mapping (address => address[]) rootToSenderAllowanceMap;
    mapping (address => address[]) walletToSenderAllowanceMap;
    bool isCanceledTransaction;

    constructor(
        address _rootWallet,
        TvmCell _dexPaylod,
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
        dexPaylod = _dexPaylod;
        initialTokensAmount = _tokensAmount;
        rootToSenderAllowanceMap = _rootToSendersAllowanceMap;
        remainingGasTo = _remainingGasTo;
        necessaryLeaves = _leaves;
        firstRoot = _firstRoot;
        successConfig = _successConfig;
        cancelConfig = _cancelConfig;

        countOfRoots = _rootToSendersAllowanceMap.keys().length;

        for ((address rootAddress, address[] senders) : rootToSenderAllowanceMap) {
            ITokenRoot(rootAddress).walletOf{
                value: 0.05 ever,
                callback: DexChildMiddleware.handleAddressReceived
            }(address(this));
        }

    }

    modifier onlyAllowdAddresses(address tokensSender) {
        require(walletToSenderAllowanceMap.exists(msg.sender), ErrorCodes.NOT_ALLOWED_TOKEN_WALLET);
        address[] allowedTokensSenders = walletToSenderAllowanceMap[msg.sender];
        bool isAllowed;

        if (tokensSender == root) {
            isAllowed = true;

        } else {
            for (address allowedSender : allowedTokensSenders) {
                if (allowedSender == tokensSender) {
                    isAllowed = true;
                }
            }
        }

        require(isAllowed, ErrorCodes.NOT_ALLOWED_TOKENS_SENDER);
        _;
    }

    modifier onlyAllowedRoot() {
        require(rootToSenderAllowanceMap.exists(msg.sender));
        _;
    }

    // utils
    function _reserve() internal pure returns (uint128) {
		return
			math.min(address(this).balance - msg.value, Constants.CHILD_CONTRACT_MIN_BALANCE);
	}

    function handleAddressReceived(address tokenWallet) external onlyAllowedRoot {
        walletToSenderAllowanceMap[tokenWallet] = rootToSenderAllowanceMap[msg.sender];
        if (walletToSenderAllowanceMap.keys().length == countOfRoots) {
            requestTokensFromRoot();
        }
    }

    function requestTokensFromRoot() internal {
        IDexMiddleware(root).onChildRequestTokens{
            value: 0,
            flag: MsgFlag.ALL_NOT_RESERVED
        }(nonce, rootWallet, initialTokensAmount);
    }

    function handleRootTransfer(  
        address _tokenRoot,
        uint128 _amount,
        address _remainingGasTo
    ) internal {
        ITokenWallet(msg.sender).transfer{value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false}(
            _amount,
            firstRoot,
            0,
            _remainingGasTo,
            true,
            dexPaylod
        );
    }

    function handleSuccessDexTransfer(
        address _tokenRoot,
        uint128 _amount,
        address _sender,
        address _senderWallet,
        address _remainingGasTo,
        address _originalSender
    ) internal {

        require(address(this) == _originalSender, ErrorCodes.ONLY_SELFF_SENDER);

        necessaryLeaves -= 1;

        receivedTokens[msg.sender] += _amount;
        if (necessaryLeaves == 0) {
            finilizeTransaction();
        }
    }

    function handleCancelDexTransfer(
        address _tokenRoot,
        uint128 _amount,
        address _sender,
        address _senderWallet,
        address _remainingGasTo,
        uint32 _bokenLeaves
    ) internal {
        receivedTokens[msg.sender] += _amount;
        necessaryLeaves -= _bokenLeaves;
        isCanceledTransaction = true;
        if (necessaryLeaves == 0) {
            finilizeTransaction();
        }
    }

    function finilizeTransaction() internal {
        TvmCell transferPayload;
        address receiver;
            console.log(format("finalize is cnaceled {}",isCanceledTransaction ? 1:0));

        if (isCanceledTransaction) {
            transferPayload = cancelConfig.payload;
            receiver = cancelConfig.tokenReceiver;
        } else {
            transferPayload = successConfig.payload;
            receiver = successConfig.tokenReceiver;
        }
        for ((address tokenWallet, uint128 tokensAmount) : receivedTokens) {
            ITokenWallet(tokenWallet).transfer{value: Constants.EXECUTE_TRAGET_TOKENS_TRANSFER_VALUE, bounce: false}(
                tokensAmount,
                receiver,
                Constants.EXECUTE_TRAGET_TOKENS_TRANSFER_VALUE / 2,
                remainingGasTo,
                true,
                transferPayload
            );
            // TODO rall it back after testing
            // TokenWalletDestroyableBase(tokenWallet).destroy{value: 0.1 ever, bounce: false}(remainingGasTo);

        }   
        remainingGasTo.transfer({
            value: 0,
            flag: MsgFlag.ALL_NOT_RESERVED  /*Add destroy after testing*/,
            bounce: false
        });
    }
    function onAcceptTokensTransfer(
        address _tokenRoot,
        uint128 _amount,
        address _sender,
        address _senderWallet,
        address _remainingGasTo,
        TvmCell _payload
    ) override external onlyAllowdAddresses(_sender) {


        if (_sender == root) {
            
            handleRootTransfer(_tokenRoot, _amount, _remainingGasTo);
            return;
        }
        TvmSlice slicePayload = _payload.toSlice();
        (uint8 v2DexOperationType, uint8 dexOperationType) = slicePayload.decode(uint8, uint8);
        // TODO remove hardcode
        if (v2DexOperationType == 200) {
            (TvmCell originalPayload, TvmCell originalSender) = slicePayload.decode(TvmCell, TvmCell);
            handleSuccessDexTransfer(
                _tokenRoot,
                _amount,
                _sender,
                _senderWallet,
                _remainingGasTo,
                originalSender.toSlice().decode(address)
            );
            return;
        }
        
        // TODO remove hardcode
        if (v2DexOperationType == 201) {
            (
                uint16 errorCode,
                TvmCell originalPayload,
                TvmCell bokenLeavesCell
            ) = slicePayload.decode(uint16, TvmCell, TvmCell);
            (uint32 bokenLeaves) = bokenLeavesCell.toSlice().decode(uint32);
            handleCancelDexTransfer(
                _tokenRoot,
                _amount,
                _sender,
                _senderWallet,
                _remainingGasTo,
                bokenLeaves
            );
        }

    }
}