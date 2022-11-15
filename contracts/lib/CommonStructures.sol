pragma ever-solidity >=0.62.0;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

library CommonStructures {
    struct FinishTransaction {
       address tokenReceiver;
       TvmCell payload;
    }

    struct ChildSwapPayload {
        TvmCell swapPayload;
        address pairAddress;
        uint128 amount;
        FinishTransaction onSuccess; 
        FinishTransaction onFail;
    }



    struct PayloadForDex {
        TvmCell dexPayload;
        uint32 leaves;
        address firtRoot;
        address remainingGasTo;
        uint128 tokensAmount;
        uint128 attachedValue;
        uint128 deployWalletValue;
        mapping (address => address[]) rootToSendersAllowanceMap;
        FinishTransaction successPayload;
        FinishTransaction cancelPayload;
    }

    struct PayloadForTransfer {
        address reseiver;
        address _remainingGasTo;
        uint128 amount;
        TvmCell payload;
        uint128 attachedValue;
        uint128 deployWalletValue;
        bool notify;
    }
}