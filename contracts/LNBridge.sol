pragma solidity ^0.8.9;
pragma experimental ABIEncoderV2;

import "hardhat/console.sol";
import "./ECDSA.sol";
import "./BTC.sol";
import "./SECP256K1.sol";
import "./ParseBTCLib.sol";

// TODO GIULIA: convert console.log into console.logBytes and console.logBytes32 when necessary

contract LNBridge {

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

    function submitProof(bytes memory CT_P_unlocked, bytes memory CT_V_unlocked) external view returns(bool) {

        bool isValidProof = true;

        //retrieve signatures
        ParseBTCLib.Signature memory sigV = ParseBTCLib.getSignature(CT_P_unlocked);
        ParseBTCLib.Signature memory sigP = ParseBTCLib.getSignature(CT_V_unlocked);

        //check signatures
        

        return isValidProof;
        /* R:  48afcdf24b0cf4a217ae273a9af6ed8491387db916cd6acf59ea394624568bb4
        S:  4c1f796a30664d83e3b41b657fbf4606839689c1e9469684a4488d3b2176fc35
        R:  58c343a0197bdf1709f034201091ccbaedc142051300b47f11fc783259bddbe1
        S:  5ad30a2d27f08dea138e4fa0bcc38bcc74590ed86a4f42d6507e9149b6802c73 */

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

