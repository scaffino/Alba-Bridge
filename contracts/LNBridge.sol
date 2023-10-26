pragma solidity ^0.8.9;
pragma experimental ABIEncoderV2;

import "hardhat/console.sol";
import "./ECDSA.sol";
import "./BTC.sol";
import "./SECP256K1.sol";
import "./ParseBTCLib.sol";
import "./BytesLib.sol";
import "./BTCUtils.sol";

// TODO GIULIA: extract timelock from LightningHTLC

contract LNBridge {

    // define global variables for this contract instance (setup phase)
    struct BridgeInstance {
        bytes32 fundingTxId;
        bytes fundingTx_script;
        bytes4 fundingTx_index;
        bytes sighash;
        bytes pkProver_Uncompressed; 
        bytes pkVerifier_Uncompressed;
        //uint256 index;
        //uint timelock; //October 18th, 00.00
        //uint timelock_dispute; //to be used
    }

    BridgeInstance public bridge;

    function setup(bytes32 _fundingTxId, 
                   bytes memory _fundingTx_script, 
                   bytes memory _sighash,
                   bytes memory _pkProver_Uncompressed, 
                   bytes memory _pkVerifier_Uncompressed) external {

        bridge.fundingTxId = _fundingTxId;
        bridge.fundingTx_script = _fundingTx_script;
        bridge.sighash = _sighash;
        bridge.pkProver_Uncompressed = _pkProver_Uncompressed;
        bridge.pkVerifier_Uncompressed = _pkVerifier_Uncompressed;
    }

    function submitProof(bytes memory CT_P_unlocked, 
                         bytes memory CT_V_unlocked) external view returns(bool) {

        // check transactions are not locked
        require(ParseBTCLib.getTimelock(CT_P_unlocked) == bytes4(0), "Commitment transaction of P is locked");
        require(ParseBTCLib.getTimelock(CT_V_unlocked) == bytes4(0), "Commitment transaction of V is locked");

        // check transactions are well formed
        ParseBTCLib.LightningHTLCData[2] memory lightningHTLC;
        ParseBTCLib.P2PKHData[2] memory p2pkh; 
        ParseBTCLib.OpReturnData memory opreturn;
        (lightningHTLC[0], p2pkh[0], opreturn) = ParseBTCLib.getOutputsDataLNB(CT_P_unlocked); //note: the p2pkh_P is the p2pkh belonging in P's commitment transaction, but holds the public key of V
        (lightningHTLC[1], p2pkh[1]) = ParseBTCLib.getOutputsDataLN(CT_V_unlocked); //note: the p2pkh_V is the p2pkh belonging in V's commitment transaction, but holds the public key of P

        require(opreturn.data == lightningHTLC[1].rev_secret, "P's commitment transaction does not hardcode V's revocation key");
         // TODO GIULIA: do test cases for the require below
        require(p2pkh[0].value == lightningHTLC[1].value, "Amount mismatch between p2pkh of P and lightning HTLC of V");
        require(lightningHTLC[0].value == p2pkh[1].value, "Amount mismatch between p2pkh of V and lightning HTLC of P");

        ParseBTCLib.CompressedPK memory pks = ParseBTCLib.extractCompressedPK(bridge.fundingTx_script);
        require(sha256(BTCUtils.hash160(pks.pk2)) == sha256(abi.encodePacked(p2pkh[0].pkhash)), "The p2pkh in P's unlocked commitment transaction does not correspond to Verifier's one");
        require(sha256(BTCUtils.hash160(pks.pk1)) == sha256(abi.encodePacked(p2pkh[1].pkhash)), "The p2pkh in V's unlocked commitment transaction does not correspond to Prover's one");        

        // check transactions spend the funding transaction
        // TODO GIULIA: create tests
        require(ParseBTCLib.getInputsData(CT_P_unlocked).txid == bridge.fundingTxId, "P's commitment transaction does not spend the funding transaction");
        require(ParseBTCLib.getInputsData(CT_V_unlocked).txid == bridge.fundingTxId, "V's commitment transaction does not spend the funding transaction");
 
        //retrieve signatures
        ParseBTCLib.Signature[2] memory sig;
        sig[1] = ParseBTCLib.getSignature(CT_P_unlocked); // sig V
        sig[0] = ParseBTCLib.getSignature(CT_V_unlocked); // sig P

        //verify signatures
        // TODO GIULIA: create tests
        bytes32[2] memory digest;
        digest[0] =  ParseBTCLib.getTxDigest(CT_P_unlocked, bridge.fundingTx_script, bridge.sighash); // digest of commitment transaction of P 
        require(sha256(ParseBTCLib.verifyBTCSignature(uint256(digest[0]), uint8(sig[1].v), BytesLib.toUint256(sig[1].r,0), BytesLib.toUint256(sig[1].s,0))) == sha256(bridge.pkVerifier_Uncompressed), "Invalid signature of V over commitment transaction of P"); 

        digest[1] = ParseBTCLib.getTxDigest(CT_V_unlocked, bridge.fundingTx_script, bridge.sighash); // the last argument is the sighash, which in this case is SIGHASH_ALL
        require(sha256(ParseBTCLib.verifyBTCSignature(uint256(digest[1]), uint8(sig[0].v), BytesLib.toUint256(sig[0].r,0), BytesLib.toUint256(sig[0].s,0))) == sha256(bridge.pkProver_Uncompressed), "Invalid signature of P over commitment transaction of V"); 
 
        return true;

    }

    function dispute(bytes memory rawTxP_locked, bytes memory sigV, bytes memory rawTxV_unlocked, bytes memory sigP) external {
       
    }

    function resolveDispute(bytes memory oldRevSecret, bytes memory rawTxP_unlocked, bytes memory sigV) external {
       
    }

    function settle() external {
       
    }

}

