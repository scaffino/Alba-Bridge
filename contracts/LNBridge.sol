pragma solidity ^0.8.9;
pragma experimental ABIEncoderV2;

import "hardhat/console.sol";
import "./ECDSA.sol";
import "./BTC.sol";
import "./SECP256K1.sol";
import "./ParseBTCLib.sol";
import "./BytesLib.sol";
import "./BTCUtils.sol";

// This contract is used by Prover P and verifier V to verify on Ethereum the current state of their Lightning payment channel 

// TODO GIULIA: create mapping between money in the channel and money in the contract

contract LNBridge {

    event stateEvent(string label, bool stateStatus);

    // define global variables for this contract instance (setup phase)
    struct BridgeInstance {
        bytes32 fundingTxId;
        bytes fundingTx_script;
        bytes4 fundingTx_index;
        bytes sighash;
        bytes pkProver_Uncompressed; 
        bytes pkVerifier_Uncompressed;
        uint256 timelock; //timelock is 1701817200, i.e., Tue Dec 05 2023 23:00:00 GMT+0000. 
        uint256 timelock_dispute; //relative timelock 
    }

    struct BridgeState {
        bool setupDone;
        bool validProofSubmitted;
        bool disputeOpened;
        bool disputeClosedP;
        bool disputeClosedV;
    }

    struct Storage {
        uint balP;
        uint balV;
        bytes32 revKey;
    }

    BridgeInstance public bridge;
    BridgeState public state;    
    Storage public contractStorage;

    function setup(bytes32 _fundingTxId, 
                   bytes memory _fundingTx_script, 
                   bytes4 _fundingTx_index, 
                   bytes memory _sighash,
                   bytes memory _pkProver_Uncompressed, 
                   bytes memory _pkVerifier_Uncompressed, 
                   uint256 _timelock, 
                   uint256 _timelock_dispute) external {
        
        // TODO GIULIA: we need signatures of P and V over the bridge state

        bridge.fundingTxId = _fundingTxId;
        bridge.fundingTx_script = _fundingTx_script;
        bridge.fundingTx_index = _fundingTx_index;
        bridge.sighash = _sighash;
        bridge.pkProver_Uncompressed = _pkProver_Uncompressed;
        bridge.pkVerifier_Uncompressed = _pkVerifier_Uncompressed;
        bridge.timelock = _timelock;
        bridge.timelock_dispute = _timelock_dispute;

        state.validProofSubmitted = false;
        state.disputeOpened = false;
        state.disputeClosedP = false;
        state.disputeClosedV = false;
        state.setupDone = true;
    }

    function submitProof(bytes memory CT_P_unlocked, 
                         bytes memory CT_V_unlocked) external {

        // check that current time is smaller than the timeout defined in Setup, and check proof has not yet been submitted, nor dispute raised
        if (block.timestamp < bridge.timelock && (state.setupDone == true && state.validProofSubmitted == false && state.disputeOpened == false)) {

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
            require(p2pkh[0].value == lightningHTLC[1].value, "Amount mismatch between p2pkh of P and lightning HTLC of V");
            require(lightningHTLC[0].value == p2pkh[1].value, "Amount mismatch between p2pkh of V and lightning HTLC of P");

            (bytes memory pk1, bytes memory pk2) = ParseBTCLib.extractCompressedPK(bridge.fundingTx_script);
            require(sha256(BTCUtils.hash160(pk2)) == sha256(abi.encodePacked(p2pkh[0].pkhash)), "The p2pkh in P's unlocked commitment transaction does not correspond to Verifier's one");
            require(sha256(BTCUtils.hash160(pk1)) == sha256(abi.encodePacked(p2pkh[1].pkhash)), "The p2pkh in V's unlocked commitment transaction does not correspond to Prover's one");        

            // check transactions spend the funding transaction 
            require(ParseBTCLib.getInputsData(CT_P_unlocked).txid == bridge.fundingTxId, "P's commitment transaction does not spend the funding transaction");
            require(ParseBTCLib.getInputsData(CT_V_unlocked).txid == bridge.fundingTxId, "V's commitment transaction does not spend the funding transaction");
    
            //retrieve signatures
            ParseBTCLib.Signature[2] memory sig;
            sig[1] = ParseBTCLib.getSignature(CT_P_unlocked); // sig V
            sig[0] = ParseBTCLib.getSignature(CT_V_unlocked); // sig P

            //verify signatures
            bytes32[2] memory digest;
            digest[0] =  ParseBTCLib.getTxDigest(CT_P_unlocked, bridge.fundingTx_script, bridge.sighash); // digest of commitment transaction of P 
            require(sha256(ParseBTCLib.verifyBTCSignature(uint256(digest[0]), uint8(sig[1].v), BytesLib.toUint256(sig[1].r,0), BytesLib.toUint256(sig[1].s,0))) == sha256(bridge.pkVerifier_Uncompressed), "Invalid signature of V over commitment transaction of P"); 

            digest[1] = ParseBTCLib.getTxDigest(CT_V_unlocked, bridge.fundingTx_script, bridge.sighash); // the last argument is the sighash, which in this case is SIGHASH_ALL
            require(sha256(ParseBTCLib.verifyBTCSignature(uint256(digest[1]), uint8(sig[0].v), BytesLib.toUint256(sig[0].r,0), BytesLib.toUint256(sig[0].s,0))) == sha256(bridge.pkProver_Uncompressed), "Invalid signature of P over commitment transaction of V"); 

            // update and store balances
            contractStorage.balP = lightningHTLC[0].value;
            contractStorage.balV = lightningHTLC[1].value;
    
            // update state of the protocol
            state.validProofSubmitted = true;

            emit stateEvent("Proof successfully verified: state.validProofSubmitted = true", state.validProofSubmitted);

        } else {

            emit stateEvent("Proof submitted too late: state.validProofSubmitted = false", state.validProofSubmitted);
        } 
    }

    function dispute(bytes memory CT_P_locked, 
                     bytes memory CT_V_unlocked) external {

        // check that current time is smaller than the timeout defined in Setup, and check proof has not yet been submitted, nor dispute raised
        if (block.timestamp < bridge.timelock && (state.setupDone == true && state.validProofSubmitted == false && state.disputeOpened == false)) {
            
            // check commitment transaction of P is locked and commitment transaction of V is unlocked
            require(ParseBTCLib.getTxTimelock(CT_P_locked) > bridge.timelock + bridge.timelock_dispute, "Commitment transaction of P is unlocked or timelock of the timelocked Tx is smaller or equal than Timelock T + Relative Timelock T_rel"); 
            require(ParseBTCLib.getTxTimelock(CT_V_unlocked) == uint32(0), "Commitment transaction of V is locked"); 

            // check transactions are well formed
            ParseBTCLib.LightningHTLCData[2] memory lightningHTLC;
            ParseBTCLib.P2PKHData[2] memory p2pkh; 
            ParseBTCLib.OpReturnData memory opreturn;
            (lightningHTLC[0], p2pkh[0], opreturn) = ParseBTCLib.getOutputsDataLNB(CT_P_locked); //note: the p2pkh_P is the p2pkh belonging in P's commitment transaction, but holds the public key of V
            (lightningHTLC[1], p2pkh[1]) = ParseBTCLib.getOutputsDataLN(CT_V_unlocked); //note: the p2pkh_V is the p2pkh belonging in V's commitment transaction, but holds the public key of P
            require(opreturn.data == lightningHTLC[1].rev_secret, "P's commitment transaction does not hardcode V's revocation key");
            require(p2pkh[0].value == lightningHTLC[1].value, "Amount mismatch between p2pkh of P and lightning HTLC of V");
            require(lightningHTLC[0].value == p2pkh[1].value, "Amount mismatch between p2pkh of V and lightning HTLC of P"); 

            (bytes memory pk1, bytes memory pk2) = ParseBTCLib.extractCompressedPK(bridge.fundingTx_script);
            require(sha256(BTCUtils.hash160(pk2)) == sha256(abi.encodePacked(p2pkh[0].pkhash)), "The p2pkh in P's locked commitment transaction does not correspond to Verifier's one");
            require(sha256(BTCUtils.hash160(pk1)) == sha256(abi.encodePacked(p2pkh[1].pkhash)), "The p2pkh in V's unlocked commitment transaction does not correspond to Prover's one");        

            // check transactions spend the funding transaction 
            require(ParseBTCLib.getInputsData(CT_P_locked).txid == bridge.fundingTxId, "P's commitment transaction does not spend the funding transaction");
            require(ParseBTCLib.getInputsData(CT_V_unlocked).txid == bridge.fundingTxId, "V's commitment transaction does not spend the funding transaction");

            //retrieve signatures
            ParseBTCLib.Signature[2] memory sig;
            sig[1] = ParseBTCLib.getSignature(CT_P_locked); // sig V
            sig[0] = ParseBTCLib.getSignature(CT_V_unlocked); // sig P

            //verify signatures
            bytes32[2] memory digest;
            digest[0] =  ParseBTCLib.getTxDigest(CT_P_locked, bridge.fundingTx_script, bridge.sighash); // digest of commitment transaction of P 
            require(sha256(ParseBTCLib.verifyBTCSignature(uint256(digest[0]), uint8(sig[1].v), BytesLib.toUint256(sig[1].r,0), BytesLib.toUint256(sig[1].s,0))) == sha256(bridge.pkVerifier_Uncompressed), "Invalid signature of V over commitment transaction of P"); 

            digest[1] = ParseBTCLib.getTxDigest(CT_V_unlocked, bridge.fundingTx_script, bridge.sighash); // the last argument is the sighash, which in this case is SIGHASH_ALL
            require(sha256(ParseBTCLib.verifyBTCSignature(uint256(digest[1]), uint8(sig[0].v), BytesLib.toUint256(sig[0].r,0), BytesLib.toUint256(sig[0].s,0))) == sha256(bridge.pkProver_Uncompressed), "Invalid signature of P over commitment transaction of V");  

            // update and store balances
            contractStorage.balP = lightningHTLC[0].value;
            contractStorage.balV = lightningHTLC[1].value;
            // store also the revocation key of P for resolveInvalidDispute
            contractStorage.revKey = lightningHTLC[0].rev_secret;
    
            // update state of the protocol
            state.disputeOpened = true;

            emit stateEvent("Dispute successfully opened: state.disputeOpened = true", state.disputeOpened); 

        } else {

            emit stateEvent("Dispute not opened: state.disputeOpened = false", state.disputeOpened);
        } 
    }

    // resolve valid dispute raised by P: V submits the unlocked version of the transaction
    function resolveValidDispute(bytes memory CT_P_unlocked) external {

        if (block.timestamp < (bridge.timelock + bridge.timelock_dispute) && (state.setupDone == true && state.validProofSubmitted == false && state.disputeOpened == true)) {

            // check transaction is not locked
            require(ParseBTCLib.getTimelock(CT_P_unlocked) == bytes4(0), "Commitment transaction of P is locked");

            // check it has valid signature of V
            ParseBTCLib.Signature memory sigV = ParseBTCLib.getSignature(CT_P_unlocked); // sig V
            bytes32 digest = ParseBTCLib.getTxDigest(CT_P_unlocked, bridge.fundingTx_script, bridge.sighash); // digest of commitment transaction of P 
            require(sha256(ParseBTCLib.verifyBTCSignature(uint256(digest), uint8(sigV.v), BytesLib.toUint256(sigV.r,0), BytesLib.toUint256(sigV.s,0))) == sha256(bridge.pkVerifier_Uncompressed), "Invalid signature of V over commitment transaction of P"); 

            // TODO GIULIA: update balances after having done the mapping
        
            // update state of the protocol
            state.disputeClosedP = true;

            emit stateEvent("Resolve Valid Dispute successfully executed: state.disputeClosedP = true", state.disputeClosedP);

        } else {

            emit stateEvent("Resolve Valid Dispute failed: state.disputeClosedP = false", state.disputeClosedP);
        } 
    }

    // resolve invalid dispute raised by P: V provides the revocation secret for that proves P opened the dispute with an old state
    function resolveInvalidDispute(string memory revSecret) external {

        if (block.timestamp < (bridge.timelock + bridge.timelock_dispute) 
            && (state.setupDone == true && state.validProofSubmitted == false && state.disputeOpened == true)
            && contractStorage.revKey == sha256(abi.encodePacked(sha256(bytes(revSecret))))) {

            // update and store balances: all money go to V
            // TODO GIULIA: to check after creating mapping for money in the contract and money in the channel
            contractStorage.balP = 0;
            contractStorage.balV = 1;

            // update state of the protocol
            state.disputeClosedV = true;

            emit stateEvent("Resolve Invalid Dispute successfully executed: state.disputeClosedV = true", state.disputeClosedV);

        } else {

            emit stateEvent("Resolve Invalid Dispute failed: state.disputeClosedV = false", state.disputeClosedV);
        } 
       
    }

    function settle() external payable {

        // TODO GIULIA: after writing functions above, check this and do tests

        if (state.validProofSubmitted == true) {
            // distribute funds IN THE CONTRACT according to mapping
        } else if (state.disputeOpened == true && (state.disputeClosedP == false && state.disputeClosedV == false)) {
            // dispute has not been closed: give all funds in the contract to prover
        } else if (state.disputeOpened == true && (state.disputeClosedP == true )) {
            // distribute funds IN THE CONTRACT according to mapping
        } else if (state.disputeOpened == true && (state.disputeClosedV == true )) {
            // dispute was opened with an old state: give all funds in the contract to verifier
        } else if (state.setupDone == true && state.disputeOpened == false && (state.disputeOpened == false )) {
            // nobody submitted nothing: distribute funds according to inital state (give back to P and V the amount they contributed with)
        }
       
    }

}

