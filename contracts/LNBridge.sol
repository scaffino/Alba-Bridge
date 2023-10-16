pragma solidity ^0.8.9;
pragma experimental ABIEncoderV2;

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
        bytes32 pkhash;
    }

    struct OpReturnData {
        uint value;
        bytes32 data;
    }

    struct ExtractOutputAux {
        uint pos; // skip version
        uint[] input_script_lens; 
        uint[] output_script_lens;
        uint[] script_starts;
        uint[] output_values;
    }

    LightningHTLCData public htlc;
    OpReturnData public opreturn;
    P2PKHData public p2pkh;
    ExtractOutputAux public out_aux;
    BridgeInstance public bridge;

    function getOutputData(bytes memory _txBytes) external returns(uint, bytes32, bytes32, bytes32, uint, bytes32, uint, bytes32) {

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
                    p2pkh.pkhash = BTC.parseOutputScript(_txBytes, out_aux.script_starts[i], out_aux.output_script_lens[i]);
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
        console.log("Check script_data_2:", BytesLib.toHexString(bytes20(p2pkh.pkhash)));
        console.log("Check value_output_3:", opreturn.value);
        console.log("Check script_data_3:", BytesLib.toHexString(uint(opreturn.data), 32));
        */

        return (htlc.value, htlc.pk1, htlc.rev_secret, htlc.pk2, p2pkh.value, p2pkh.pkhash, opreturn.value, opreturn.data);
    }

    function getTimelock(bytes memory _txBytes) external returns(bytes4) {
        uint256 rawTxSize = _txBytes.length;
        //console.log("Tx Size: ", rawTxSize);
        bytes4 timelock = bytes4(BytesLib.slice(_txBytes, rawTxSize-5, uint256(4)));
        //console.log("Timelock: ", BytesLib.toHexString(bytes4(timelock)));
        return timelock;
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