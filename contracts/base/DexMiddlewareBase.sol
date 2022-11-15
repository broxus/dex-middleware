pragma ever-solidity >=0.62.0;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

import "./DexMiddlewareStorage.sol";
import "../DexChildMiddleware.sol";
import "../lib/ErrorCodes.sol";
import "../lib/Constants.sol";
import "../lib/CommonStructures.sol";

import "@broxus/contracts/contracts/libraries/MsgFlag.sol";




abstract contract DexMiddlewareBase is DexMiddlewareStorage {

    modifier onlyChild(uint128 childNonce) {
        address childAddress = getChildAddress(childNonce);
        require(msg.sender == childAddress,ErrorCodes.NOT_CHILD_CONTRACT);
        _;
    }

        // utils
    function _reserve() internal pure returns (uint128) {
		return
			math.max(address(this).balance - msg.value, Constants.CHILD_CONTRACT_MIN_BALANCE);
	}

    function _buildInitAccount(uint128 childNonce)
		internal
		view
		virtual
		returns (TvmCell)
	{
		return
			tvm.buildStateInit({
				contr: DexChildMiddleware,
				varInit: {
					root: address(this),
                    nonce: childNonce
				},
				pubkey: 0,
				code: dexMiddlewareChildCode
			});
	}

    function deployChild(
        uint128 childNonce,
        address _rootWallet,
        TvmCell _dexPayload,
        uint128 _tokensAmount,
        uint128 _attachedValue,
        mapping (address => address[]) _rootToSendersAllowanceMap,
        uint32 _leaves,
        address _firstRoot,
        address _remainingGasTo,
        CommonStructures.FinishTransaction _successPayload,
        CommonStructures.FinishTransaction _cancelPayload
        ) internal returns(address) {
        return new DexChildMiddleware{
            stateInit: _buildInitAccount(childNonce),
            value: _attachedValue
        }(_rootWallet, _dexPayload, _tokensAmount, _rootToSendersAllowanceMap, _remainingGasTo, _leaves, _firstRoot, _successPayload, _cancelPayload);
    }

    function getChildAddress(uint128 childNonce) public view responsible returns(address) {
        return {value: 0, flag: MsgFlag.REMAINING_GAS, bounce: false} address(
            tvm.hash(_buildInitAccount(childNonce))
        );
    }
}