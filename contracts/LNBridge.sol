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
        (lightningHTLC_P, p2pkh_P, opreturn) = ParseBTCLib.getOutputsDataLNB(CT_P_unlocked); 
        (lightningHTLC_V, p2pkh_V) = ParseBTCLib.getOutputsData_2(CT_V_unlocked);

        require(opreturn.data == lightningHTLC_V.rev_secret, "P's commitment transaction does not hardcode V's revocation key");
        require(p2pkh_P.value == lightningHTLC_V.value, "Amount mismatch between p2pkh of P and lightning HTLC of V");
        require(lightningHTLC_P.value == p2pkh_V.value, "Amount mismatch between p2pkh of V and lightning HTLC of P");

        //following checks not working: ATTENTION: might need to use prefixed uncompressed keys!!!!
        /* console.logBytes20(ripemd160("mhdTzofrDHXF18US18Y6ZfV5JhqCxa13yh"));
        console.log("pk hashes in the p2pkh script");
        console.logBytes20(p2pkh_P.pkhash);
        console.logBytes20(p2pkh_V.pkhash);
        console.log("ripemd160 of the compressed pk ");
        console.logBytes20(ripemd160(BytesLib.slice(bridge.pkVerifier_Compressed, 0, 32)));
        console.logBytes20(ripemd160(BytesLib.slice(bridge.pkProver_Compressed, 0, 32))); 
        console.log("ripemd160(sha(pk)) of the compressed pk ");
        console.logBytes(BTCUtils.hash160(BytesLib.slice(bridge.pkVerifier_Compressed, 0, 32)));
        console.logBytes(BTCUtils.hash160(BytesLib.slice(bridge.pkProver_Compressed, 0, 32)));
        console.log("ripemd160(ripemd160(sha(pk))) of the compressed pk ");
        console.logBytes20(ripemd160(BTCUtils.hash160(BytesLib.slice(bridge.pkVerifier_Compressed, 0, 32))));
        console.logBytes20(ripemd160(BTCUtils.hash160(BytesLib.slice(bridge.pkProver_Compressed, 0, 32)))); */

        /* console.logBytes32(lightningHTLC_P.pk1);
        console.logBytes(BytesLib.slice(bridge.pkVerifier_Uncompressed, 0, 32));
        console.logBytes32(lightningHTLC_P.pk2);
        console.logBytes(BytesLib.slice(bridge.pkProver_Uncompressed, 0, 32)); */

        //require(ripemd160(BytesLib.slice(bridge.pkProver, 0, 32)) == p2pkh_P.pkhash, "The pk in P's unlocked commitment transaction (p2pkh output) is not Prover's one");
        
        //require(BTC.sliceBytes32(bridge.pkVerifier, 0) == p2pkh_V.pkhash, "The pk in V's unlocked commitment transaction (p2pkh output) is not Verifier's one.");
        

        //retrieve signatures
        ParseBTCLib.Signature memory sigV = ParseBTCLib.getSignature(CT_P_unlocked);
        ParseBTCLib.Signature memory sigP = ParseBTCLib.getSignature(CT_V_unlocked);

        //TODO GIULIA: verify signatures: change v from 27 to 28 and viceversa depending on R
        bytes32 digestP =  ParseBTCLib.getTxDigest(CT_P_unlocked, bridge.fundingTx_script, bridge.sighash);
        bytes memory pkV = ParseBTCLib.verifyBTCSignature(uint256(digestP), uint8(sigV.v), BytesLib.toUint256(sigV.r,0), BytesLib.toUint256(sigV.s,0)); // unprefixed uncompressed key v = 28

        bytes32 digestV = ParseBTCLib.getTxDigest(CT_V_unlocked, bridge.fundingTx_script, bridge.sighash);
        bytes memory pkP = ParseBTCLib.verifyBTCSignature(uint256(digestV), uint8(sigP.v), BytesLib.toUint256(sigP.r,0), BytesLib.toUint256(sigP.s,0)); // unprefixed uncompressed key v = 27

        return true;

    }

    function dispute(bytes memory rawTxP_locked, bytes memory sigV, bytes memory rawTxV_unlocked, bytes memory sigP) external {
       
    }

    function resolveDispute(bytes memory oldRevSecret, bytes memory rawTxP_unlocked, bytes memory sigV) external {
       
    }

    function settle() external {
       
    }

}

