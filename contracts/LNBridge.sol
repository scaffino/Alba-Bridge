pragma solidity ^0.8.9;

// Uncomment this line to use console.log
import "hardhat/console.sol";
import "./SafeMath.sol";
import "./TypedMemView.sol";
//import "./ViewBTC.sol";
//import "./BTCUtils.sol";
//import "./ECDSA.sol";
import "./CheckBitcoinSigs.sol";
import "./BTC.sol";

contract LNBridge {

    // define global variables for this contract instance (setup phase)
    bytes32 private fundingTxId;
    bytes32 private pkProver;
    bytes32 private pkVerifier;
    uint256 private index;
    uint public timestamp; //october 18th, 00.00
    uint public timestamp_dispute; //to be used

        
    function verifySignature(bytes memory pk, bytes32 digest, uint8 v, bytes32 r, bytes32 s) public view returns(bool) {
        return CheckBitcoinSigs.checkSig(pk, digest, v, r, s);
    }
/*
    function getInputs(bytes memory _txBytes) external returns(uint[] memory) {
        uint pos;
        uint[] memory input_script_lens;
        // pos = 4 skips the version number
        (input_script_lens, pos) = BTC.scanInputs(_txBytes, 4, 0);
        console.log("Check input_script_lens:", input_script_lens);
        return (input_script_lens);
    }
*/
    function getTheTwoOutputs(bytes memory _txBytes) external returns(uint, bytes20, uint, bytes20) {
        uint one;
        bytes20 two;
        uint three;
        bytes20 four;
        (one, two, three, four) = BTC.getFirstTwoOutputs(_txBytes);
        console.log("Check one:", one);
        //console.log("Check two:", BytesLib.convertByteToString(two));
        console.log("Check two:", BytesLib.toHexString(two));
        console.log("Check three:", three);
        console.log("Check four:", BytesLib.toHexString(four));
        return (one, two, three, four);
    }


    function setup(bytes32 _fundingTxId, bytes32 _pkProver, bytes32 _pkVerifier, uint256 _index, uint _timestamp) external {
        fundingTxId = _fundingTxId;
        pkProver = _pkProver;
        pkVerifier = _pkVerifier;
        index = _index;
        timestamp = _timestamp;
    }

    function submitProof(bytes memory rawTxP_unlocked, bytes memory sigV, bytes memory rawTxV_unlocked, bytes memory sigP) external {

        // check tx are well formed

        // check rawTxP_unlocked hardcodes revocation key in rawTxV_unlocked and index

        // check there is no timelock in rawTxP_unlocked and rawTxV_unlocked

        // check signatures are valid

    }

    function dispute(bytes memory rawTxP_locked, bytes memory sigV, bytes memory rawTxV_unlocked, bytes memory sigP) external {
       
    }

    function resolveDispute(bytes memory oldRevSecret, bytes memory rawTxP_unlocked, bytes memory sigV) external {
       
    }

    function settle() external {
       
    }

}