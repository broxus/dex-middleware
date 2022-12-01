pragma ever-solidity >=0.62.0;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

library CommonStructures {
    struct FinishTransaction {
        address tokenReceiver;
        uint128 valueForFinalTransfer;
        uint128 deployWalletValue;
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
        address firstRoot;
        address remainingGasTo;
        uint128 tokensAmount;
        uint128 attachedValue;
        uint128 deployWalletValue;
        mapping (address => address[]) rootToSendersAllowanceMap;
        FinishTransaction successPayload;
        FinishTransaction cancelPayload;
    }

    struct PayloadForTransfer {
        address receiver;
        address _remainingGasTo;
        uint128 amount;
        TvmCell payload;
        uint128 attachedValue;
        uint128 deployWalletValue;
        bool notify;
    }

    struct CalculationResult {
        uint128 everValue;
        uint128 tokenAmount;
    }
}
