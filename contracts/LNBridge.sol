pragma solidity ^0.8.9;
pragma experimental ABIEncoderV2;

import "hardhat/console.sol";
import "./ECDSA.sol";
import "./BTC.sol";
import "./SECP256K1.sol";
import "./ParseBTCLib.sol";
import "./BytesLib.sol";
import "./BTCUtils.sol";

// TODO GIULIA: convert console.log into console.logBytes and console.logBytes32 when necessary

contract LNBridge {

    // define global variables for this contract instance (setup phase)
    struct BridgeInstance {
        bytes32 fundingTxId;
        bytes fundingTx_script;
        bytes sighash;
        bytes pkProver_Uncompressed; 
        bytes pkProver_Compressed; 
        bytes pkVerifier_Uncompressed;
        bytes pkVerifier_Compressed;
        uint256 index;
        uint timelock; //October 18th, 00.00
        uint timelock_dispute; //to be used
    }

    BridgeInstance public bridge;

    function setup(bytes32 _fundingTxId, bytes memory _fundingTx_script, bytes memory _sighash, bytes memory _pkProver_Uncompressed, bytes memory _pkProver_Compressed, bytes memory _pkVerifier_Uncompressed, bytes memory _pkVerifier_Compressed, uint256 _index, uint _timelock) external {

        bridge.fundingTxId = _fundingTxId;
        bridge.fundingTx_script = _fundingTx_script;
        bridge.sighash = _sighash;
        bridge.pkProver_Uncompressed = _pkProver_Uncompressed;
        bridge.pkProver_Compressed = _pkProver_Compressed;
        bridge.pkVerifier_Uncompressed = _pkVerifier_Uncompressed;
        bridge.pkVerifier_Compressed = _pkVerifier_Compressed;
        bridge.index = _index;
        bridge.timelock = _timelock;
    }

    function submitProof(bytes memory CT_P_unlocked, bytes memory CT_V_unlocked) external view returns(bool) {

        // check transactions are not locked
        require(ParseBTCLib.getTimelock(CT_P_unlocked) == bytes4(0), "Commitment transaction of P is locked");
        require(ParseBTCLib.getTimelock(CT_V_unlocked) == bytes4(0), "Commitment transaction of V is locked");

        // check transactions are well formed
        ParseBTCLib.LightningHTLCData memory lightningHTLC_P;
        ParseBTCLib.LightningHTLCData memory lightningHTLC_V;
        ParseBTCLib.P2PKHData memory p2pkh_P; 
        ParseBTCLib.P2PKHData memory p2pkh_V;
        ParseBTCLib.OpReturnData memory opreturn;
        (lightningHTLC_P, p2pkh_P, opreturn) = ParseBTCLib.getOutputsDataLNB(CT_P_unlocked); //note: the p2pkh_P is the p2pkh belonging in P's commitment transaction, but holds the public key of V
        (lightningHTLC_V, p2pkh_V) = ParseBTCLib.getOutputsData_2(CT_V_unlocked); //note: the p2pkh_V is the p2pkh belonging in V's commitment transaction, but holds the public key of P

        require(opreturn.data == lightningHTLC_V.rev_secret, "P's commitment transaction does not hardcode V's revocation key");
         // TODO GIULIA: do test cases for the require below
        require(p2pkh_P.value == lightningHTLC_V.value, "Amount mismatch between p2pkh of P and lightning HTLC of V");
        require(lightningHTLC_P.value == p2pkh_V.value, "Amount mismatch between p2pkh of V and lightning HTLC of P");
        require(sha256(BTCUtils.hash160(bridge.pkVerifier_Compressed)) == sha256(abi.encodePacked(p2pkh_P.pkhash)), "The p2pkh in P's unlocked commitment transaction does not correspond to Verifier's one");
        require(sha256(BTCUtils.hash160(bridge.pkProver_Compressed)) == sha256(abi.encodePacked(p2pkh_V.pkhash)), "The p2pkh in V's unlocked commitment transaction does not correspond to Prover's one");        

        //retrieve signatures
        ParseBTCLib.Signature memory sigV = ParseBTCLib.getSignature(CT_P_unlocked);
        ParseBTCLib.Signature memory sigP = ParseBTCLib.getSignature(CT_V_unlocked);

        //verify signatures
        // TODO GIULIA: create tests
        bytes32 digestP =  ParseBTCLib.getTxDigest(CT_P_unlocked, bridge.fundingTx_script, bridge.sighash);
        bytes memory pkV = ParseBTCLib.verifyBTCSignature(uint256(digestP), uint8(sigV.v), BytesLib.toUint256(sigV.r,0), BytesLib.toUint256(sigV.s,0)); // unprefixed uncompressed key v = 28
        require(sha256(pkV) == sha256(bridge.pkVerifier_Uncompressed));

        bytes32 digestV = ParseBTCLib.getTxDigest(CT_V_unlocked, bridge.fundingTx_script, bridge.sighash);
        bytes memory pkP = ParseBTCLib.verifyBTCSignature(uint256(digestV), uint8(sigP.v), BytesLib.toUint256(sigP.r,0), BytesLib.toUint256(sigP.s,0)); // unprefixed uncompressed key v = 27
        require(sha256(pkP) == sha256(bridge.pkProver_Uncompressed));

        return true;

    }

    function dispute(bytes memory rawTxP_locked, bytes memory sigV, bytes memory rawTxV_unlocked, bytes memory sigP) external {
       
    }

    function resolveDispute(bytes memory oldRevSecret, bytes memory rawTxP_unlocked, bytes memory sigV) external {
       
    }

    function settle() external {
       
    }

}

