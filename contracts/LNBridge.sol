pragma solidity ^0.8.9;
pragma experimental ABIEncoderV2;

import "hardhat/console.sol";
import "./ECDSA.sol";
import "./BTC.sol";
import "./SECP256K1.sol";
import "./ParseBitcoinRawTx.sol";


contract LNBridge {

    ParseBitcoinRawTx parseBitcoinRawTx = new ParseBitcoinRawTx();

    // define global variables for this contract instance (setup phase)
    struct BridgeInstance {
        bytes32 fundingTxId;
        bytes32 pkProver;
        bytes32 pkVerifier;
        uint256 index;
        uint timelock; //October 18th, 00.00
        uint timelock_dispute; //to be used
    }

    BridgeInstance public bridge;

    function setup(bytes32 _fundingTxId, bytes32 _pkProver, bytes32 _pkVerifier, uint256 _index, uint _timelock) external {
        bridge.fundingTxId = _fundingTxId;
        bridge.pkProver = _pkProver;
        bridge.pkVerifier = _pkVerifier;
        bridge.index = _index;
        bridge.timelock = _timelock;
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

