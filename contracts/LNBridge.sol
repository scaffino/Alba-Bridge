pragma solidity ^0.8.9;
pragma experimental ABIEncoderV2;

import "hardhat/console.sol";
import "./ParseBTCLib.sol";
import "./BytesLib.sol";
import "./BTCUtils.sol";
import "./ECDSA.sol";
import "./LNBridgeHelper.sol";

// This contract is used by Prover P and verifier V to verify on Ethereum the current state of their Lightning payment channel 

contract LNBridge {

    event stateEvent(string label, bool stateStatus);
    event lockCoinsEvent(string label, address addr, uint amount);

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
        uint256 balDistrConst; 
    }

    struct BridgeState {
        bool coinsLocked;
        bool setupDone;
        bool validProofSubmitted;
        bool disputeOpened;
        bool disputeClosedP;
        bool disputeClosedV;
    }

    struct PaymentChannel {
        uint balP; // this is the balance in the payment channel
        uint balV; // this is the balance in the payment channel
        bytes32 revKey;
    }

    BridgeInstance public bridge;
    BridgeState public state;    
    PaymentChannel public paymentChan;

    mapping(address => uint256) initBalancesETH;

    address prover;
    address verifier;
    uint256 contractSupply;

    constructor(address _prover, address _verifier) {
        prover = _prover; 
        verifier = _verifier; 
    } 

    // this function allows protocol parties to lock funds in the contract
    receive() external payable {

        // React to receiving ether
        initBalancesETH[msg.sender] = msg.value; 
        contractSupply = contractSupply + msg.value;
        state.coinsLocked = true;
        emit lockCoinsEvent("Coins locked!", msg.sender, msg.value);
    
    } 

    function setup(bytes32 _fundingTxId, 
                   bytes memory _fundingTx_script, 
                   bytes4 _fundingTx_index, 
                   bytes memory _sighash,
                   bytes memory _pkProver_Uncompressed, 
                   bytes memory _pkVerifier_Uncompressed, 
                   uint256 _timelock, 
                   uint256 _timelock_dispute, 
                   bytes memory sigP, 
                   bytes memory sigV) external {
        
        // populate protocol specifics
        bridge.fundingTxId = _fundingTxId;
        bridge.fundingTx_script = _fundingTx_script;
        bridge.fundingTx_index = _fundingTx_index;
        bridge.sighash = _sighash;
        bridge.pkProver_Uncompressed = _pkProver_Uncompressed;
        bridge.pkVerifier_Uncompressed = _pkVerifier_Uncompressed;
        bridge.timelock = _timelock;
        bridge.timelock_dispute = _timelock_dispute;

        bridge.balDistrConst = 7; // TODO for the future: make it dynamic

        // verify signatures over setup data
        bytes memory message = bytes.concat(BytesLib.toBytes(bridge.fundingTxId), bridge.fundingTx_script, BytesLib.toBytesNew(bridge.fundingTx_index), bridge.sighash, bridge.pkProver_Uncompressed, bridge.pkVerifier_Uncompressed, BytesLib.uint256ToBytes(bridge.timelock), BytesLib.uint256ToBytes(bridge.timelock_dispute));
        require(prover == ECDSA.recover(sha256(message), abi.encodePacked(sigP)), "Invalid signature of P over the setup data");
        require(verifier == ECDSA.recover(sha256(message), abi.encodePacked(sigV)), "Invalid signature of V over the setup data"); 

        // populate state variables
        state.validProofSubmitted = false;
        state.disputeOpened = false;
        state.disputeClosedP = false;
        state.disputeClosedV = false;
        state.setupDone = true;
    }

    function submitProof(bytes memory CT_P_unlocked, 
                         bytes memory CT_V_unlocked) external {

        // check that current time is smaller than the timeout defined in Setup, and check proof has not yet been submitted, nor dispute raised
        if (block.timestamp < bridge.timelock && (state.coinsLocked == true && 
                                                  state.setupDone == true && 
                                                  state.validProofSubmitted == false && 
                                                  state.disputeOpened == false)) {

            // check transactions are not locked
            require(ParseBTCLib.getTimelock(CT_P_unlocked) == bytes4(0), "Commitment transaction of P is locked");
            require(ParseBTCLib.getTimelock(CT_V_unlocked) == bytes4(0), "Commitment transaction of V is locked");

            // check transactions are well formed
            ParseBTCLib.LightningHTLCData[2] memory lightningHTLC;
            ParseBTCLib.P2PKHData[2] memory p2pkh; 
            ParseBTCLib.OpReturnData memory opreturn;
            (lightningHTLC, p2pkh, opreturn) = LNBridgeHelper.checkTxAreWellFormed(CT_P_unlocked, CT_V_unlocked, bridge.fundingTx_script, bridge.fundingTxId);

            LNBridgeHelper.checkSignatures(CT_P_unlocked, CT_V_unlocked, bridge.fundingTx_script, bridge.sighash, bridge.pkProver_Uncompressed, bridge.pkVerifier_Uncompressed);         

            // Check on the channel balance: e.g., require the balance of P is higher than X, with X = 10 in this example
            require(lightningHTLC[0].value > 10, "In this PC update (aka. current state) the Prover does not have a sufficient amount of coins");
    
            // update state of the protocol
            state.validProofSubmitted = true;

            //emit stateEvent("Proof successfully verified: state.validProofSubmitted = true", state.validProofSubmitted);
            emit stateEvent("Proof successfully verified", state.validProofSubmitted);

        } else {

            //emit stateEvent("Proof submitted too late: state.validProofSubmitted = false", state.validProofSubmitted);
            emit stateEvent("Proof submitted too late", state.validProofSubmitted);

        } 
    }

    function dispute(bytes memory CT_P_locked, 
                     bytes memory CT_V_unlocked) external {

        // check that current time is smaller than the timeout defined in Setup, and check proof has not yet been submitted, nor dispute raised
        if (block.timestamp < bridge.timelock && (state.coinsLocked == true && 
                                                  state.setupDone == true && 
                                                  state.validProofSubmitted == false && 
                                                  state.disputeOpened == false)) {
            
            // check commitment transaction of P is locked and commitment transaction of V is unlocked
            require(ParseBTCLib.getTxTimelock(CT_P_locked) > bridge.timelock + bridge.timelock_dispute, "Commitment transaction of P is unlocked or timelock of the timelocked Tx is smaller or equal than Timelock T + Relative Timelock T_rel"); 
            require(ParseBTCLib.getTxTimelock(CT_V_unlocked) == uint32(0), "Commitment transaction of V is locked"); 

            // check transactions are well formed
            ParseBTCLib.LightningHTLCData[2] memory lightningHTLC;
            ParseBTCLib.P2PKHData[2] memory p2pkh; 
            ParseBTCLib.OpReturnData memory opreturn;
            (lightningHTLC, p2pkh, opreturn) = LNBridgeHelper.checkTxAreWellFormed(CT_P_locked, CT_V_unlocked, bridge.fundingTx_script, bridge.fundingTxId);

            require(LNBridgeHelper.checkSignatures(CT_P_locked, CT_V_unlocked, bridge.fundingTx_script, bridge.sighash, bridge.pkProver_Uncompressed, bridge.pkVerifier_Uncompressed) == true, "Invalid signatures");   

            // Check on the channel balance: e.g., require the balance of P is higher than X, with X = 10 in this example
            require(lightningHTLC[0].value > 10, "In this PC update Prover does not have a sufficient amount of coins");

            // store balances
            paymentChan.balP = lightningHTLC[0].value;
            paymentChan.balV = lightningHTLC[1].value;
            // store also the revocation key of P for resolveInvalidDispute
            paymentChan.revKey = LNBridgeHelper.getRevSecret(CT_P_locked);
    
            // update state of the protocol
            state.disputeOpened = true;

            emit stateEvent("Dispute successfully opened", state.disputeOpened); 

        } else {

            emit stateEvent("Dispute not opened", state.disputeOpened);
        } 
    }

    // resolve valid dispute raised by P: V submits the unlocked version of the transaction
    function resolveValidDispute(bytes memory CT_P_unlocked) external {

        if (block.timestamp < (bridge.timelock + bridge.timelock_dispute) && (state.coinsLocked == true && state.setupDone == true && state.validProofSubmitted == false && state.disputeOpened == true)) {

            // check transaction is not locked
            require(ParseBTCLib.getTimelock(CT_P_unlocked) == bytes4(0), "Commitment transaction of P is locked");

            //check transaction spends the funding transaction
            require(ParseBTCLib.getInputsData(CT_P_unlocked).txid == bridge.fundingTxId, "P's commitment transaction does not spend the funding transaction");

            // check balance correctness
            ParseBTCLib.LightningHTLCData memory lightningHTLC;
            ParseBTCLib.P2PKHData memory p2pkh; 
            ParseBTCLib.OpReturnData memory opreturn;
            (lightningHTLC, p2pkh, opreturn) = ParseBTCLib.getOutputsDataLNB(CT_P_unlocked); 
            require(lightningHTLC.value == paymentChan.balP, "The value in the HTLC does not corrispond to the value in the HTLC of P's locked transaction");
            require(p2pkh.value == paymentChan.balV, "The value in the p2pkh does not corrispond to the value in the HTLC of V's unlocked transaction");

            //check signature
            LNBridgeHelper.checkSignature(CT_P_unlocked, bridge.fundingTx_script, bridge.sighash, bridge.pkVerifier_Uncompressed);    
        
            // update state of the protocol
            state.disputeClosedP = true;

            emit stateEvent("Resolve Valid Dispute successfully executed", state.disputeClosedP);

        } else {

            emit stateEvent("Resolve Valid Dispute failed", state.disputeClosedP);
        } 
    }

    // resolve invalid dispute raised by P: V provides the revocation secret for that proves P opened the dispute with an old state
    function resolveInvalidDispute(string memory revSecret) external {

        if (block.timestamp < (bridge.timelock + bridge.timelock_dispute) 
            && (state.coinsLocked == true  && state.setupDone == true && state.validProofSubmitted == false && state.disputeOpened == true)
            && paymentChan.revKey == sha256(abi.encodePacked(sha256(bytes(revSecret))))) {

            // update state of the protocol
            state.disputeClosedV = true;

            emit stateEvent("Resolve Invalid Dispute successfully executed", state.disputeClosedV);

        } else {

            emit stateEvent("Resolve Invalid Dispute failed", state.disputeClosedV);
        } 
       
    }

    function settle() external payable {

        if (state.validProofSubmitted == true || (state.disputeOpened == true && state.disputeClosedP == true)) {

            // distribute funds in the contract according to mapping
            (bool sentP, ) = prover.call{value: (contractSupply * (bridge.balDistrConst / 100))}("");
            require(sentP, "Failed to send Ether P ");
            (bool sentV, ) = verifier.call{value: (contractSupply * (1 - bridge.balDistrConst / 100))}("");
            require(sentV, "Failed to send Ether V ");

            emit stateEvent("Valid proof submitted and funds distributed", true);

        } else if (state.disputeOpened == true && (state.disputeClosedP == false && state.disputeClosedV == false)) {

            // dispute has not been closed: give all funds in the contract to prover
            (bool sentP, ) = prover.call{value: contractSupply}("");
            require(sentP, "Failed to send Ether P");

            emit stateEvent("All funds given to P", true);

        } else if (state.disputeOpened == true && state.disputeClosedV == true ) {

            // dispute was opened with an old state: give all funds in the contract to verifier
            (bool sentV, ) = verifier.call{value: contractSupply}("");
            require(sentV, "Failed to send Ether V");

            emit stateEvent("All funds given to V", true);

        } else if (state.coinsLocked == true && state.setupDone == false) {

            // nobody submitted nothing: distribute funds according to inital state (give back to P and V the amount they contributed with)
            (bool sentP, ) = prover.call{value: initBalancesETH[prover]}("");
            require(sentP, "Failed to send Ether P");
            (bool sentV, ) = verifier.call{value: initBalancesETH[verifier]}("");
            require(sentV, "Failed to send Ether V");

            emit stateEvent("Funds distributed as for initial distribution", true);

        }
    }

}
