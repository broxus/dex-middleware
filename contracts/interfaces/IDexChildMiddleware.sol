pragma ever-solidity >=0.62.0;
pragma AbiHeader expire;

import "../lib/CommonStructures.sol";

interface IDexChildMiddleware {
    function forceFinalize(bool isSuccess) external;
}
