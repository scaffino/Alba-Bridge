pragma solidity ^0.8.9;
pragma experimental ABIEncoderV2;

import "hardhat/console.sol";
import "./SafeMath.sol";
import "./TypedMemView.sol";
//import "./ViewBTC.sol";
import "./BTCUtils.sol";
import "./ECDSA.sol";
import "./CheckBitcoinSigs.sol";
import "./BTC.sol";
import "./SECP256K1.sol";

// TODO GIULIA: move helper functions to a helper file and only keep in this contract the functions of the protocol

contract LNBridge {

    // define global variables for this contract instance (setup phase)
    struct BridgeInstance {
        bytes32 fundingTxId;
        bytes32 pkProver;
        bytes32 pkVerifier;
        uint256 index;
        uint timelock; //october 18th, 00.00
        uint timelock_dispute; //to be used
    }

    struct LightningHTLCData {
        uint value;
        bytes32 pk1;
        bytes32 pk2;
        bytes32 rev_secret;
    }

    struct P2PKHData {
        uint value;
        bytes20 pkhash;
    }

    struct OpReturnData {
        uint value;
        bytes32 data;
    }

    struct Input {
        uint number_of_inputs;
        bytes32 txid;
        bytes4 inputIndex;
    }

    struct ExtractOutputAux {
        uint pos; // skip version
        uint[] input_script_lens; 
        uint[] output_script_lens;
        uint[] script_starts;
        uint[] output_values;
    }

    struct Signature {
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    BridgeInstance public bridge;

    function getOutputsData(bytes memory _txBytes) external view returns(LightningHTLCData memory, P2PKHData memory, OpReturnData memory) {

        LightningHTLCData memory htlc;
        OpReturnData memory opreturn;
        P2PKHData memory p2pkh;
        ExtractOutputAux memory out_aux;

        out_aux.pos = 4;

        (out_aux.input_script_lens, out_aux.pos) = BTC.scanInputs(_txBytes, out_aux.pos, 0);

        (out_aux.output_values, out_aux.script_starts, out_aux.output_script_lens, out_aux.pos) = BTC.scanOutputs(_txBytes, out_aux.pos, 0);

        {
            for (uint i = 0; i < 3; i++) {
                if (i==0) {
                    (htlc.pk1, htlc.rev_secret, htlc.pk2) = BTC.parseOutputScriptHTLC(_txBytes, out_aux.script_starts[i], out_aux.output_script_lens[i]);
                    htlc.value = out_aux.output_values[i];
                }
                if (i == 1) {
                    p2pkh.pkhash = BTC.sliceBytes20(abi.encodePacked(BTC.parseOutputScript(_txBytes, out_aux.script_starts[i], out_aux.output_script_lens[i])),0);
                    p2pkh.value = out_aux.output_values[i];
                }
                if (i == 2) {
                    opreturn.data = BTC.parseOutputScript(_txBytes, out_aux.script_starts[i], out_aux.output_script_lens[i]);
                    opreturn.value = out_aux.output_values[i];
                }
            }
        }

        /*
        console.log("Check value_output_1:", htlc.value);
        console.log("Check pk1_Output1:", BytesLib.toHexString(uint(htlc.pk1), 32));
        console.log("Check rev_sec:", BytesLib.toHexString(uint(htlc.rev_secret), 32));
        console.log("Check pk2_Output1:", BytesLib.toHexString(uint(htlc.pk2), 32));

        console.log("Check value_output_2:", p2pkh.value);
        console.log("Check script_data_2:", BytesLib.toHexString(p2pkh.pkhash));
        console.log("Check value_output_3:", opreturn.value);
        console.log("Check script_data_3:", BytesLib.toHexString(uint(opreturn.data), 32));       
        */

        return (htlc, p2pkh, opreturn);
    }

    function getTimelock(bytes memory _txBytes) external view returns(bytes4) {
        uint256 rawTxSize = _txBytes.length;
        //console.log("Tx Size: ", rawTxSize);
        bytes4 timelock = (bytes4(BytesLib.slice(_txBytes, rawTxSize-5, uint256(4))));
        //console.log("Timelock: ", BytesLib.toHexString(timelock));
        return timelock;
    }

    function getInputsData(bytes memory _txBytes) external view returns(Input memory) {

        Input memory input;

        (input.number_of_inputs, ) = BTC.parseVarInt(_txBytes, uint(4));
        input.inputIndex = bytes4(BytesLib.slice(_txBytes, 37, uint256(4)));
        input.txid = BytesLib.flipBytes32(bytes32(BytesLib.slice(_txBytes, 5, uint256(37))));

        require(input.number_of_inputs == 1, "Tx has too many inputs (>1)");
        
        //console.log("inputIndex: ", BytesLib.toHexString(inputIndex));
        //console.log("txid: ", BytesLib.toHexString(uint(txid), 32));
        //console.log("number_of_inputs: ", number_of_inputs);
        
        return input;
    }

    function getSignatures(bytes memory _txBytes) external returns(Signature[] memory) {

        Signature[] memory sigs;
        // TODO GIULIA: write function that isolates the signature components
        return sigs;

        /////////////
        // 30 # DER Sequence tag
        // 44 # Sequence length 0x44 (68) bytes
        // 02 # Integer element
        // 20 # Element length 0x20 (32) bytes
        // 3ff7162d6635246dbf59b7fa9e72e3023e959a73b1fbc51edbaaa5a8dbc6d2f7 # ECDSA r value
        // 02 # Integer element
        // 20 # Element length 0x20 (32) bytes
        // 776e2fa5740df01cc0ac47bda713e87fc59044960122ba45abb11c949655c584 # ECDSA s value
        //  DER encoding completed
        // 01  # this is the sighas flag (SIGHASH ALL, in this case)
        /////////////

        //Check this https://bitcoin.stackexchange.com/questions/92680/what-are-the-der-signature-and-sec-format
    }

    // this funciton returns the Ethereum address
    function verifyETHSignature(bytes32 message, bytes memory signature) external view returns(address){
        address mytestaddr = ECDSA.recover(message, signature);
        return mytestaddr;
    }

    //this function returns the signing Public Key 
    function verifyBTCSignature(uint256 digest, uint8 v, uint256 r, uint256 s) external view returns (bytes memory) {
        (uint256 x, uint256 y) = SECP256K1.recover(uint256(digest), v - 27, uint256(r), uint256(s));
        return abi.encodePacked(x, y);
    }

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

