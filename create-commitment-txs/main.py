from bitcoinutils.transactions import Transaction, TxInput, TxOutput
from bitcoinutils.script import Script
from bitcoinutils.keys import P2pkhAddress, PrivateKey, PublicKey
from identity import Id
from helper import hash256, gen_secret
import init
import scripts
import txs
import hashlib
import struct
from bitcoinutils.constants import SIGHASH_ALL

init.init_network()

#ids chosen at random
id_P = Id('d44348ff037a7f65bcf9b7c86181828f5e05dbfe6cf2efe9af6362c8d53a00b0') #address is mhdTzofrDHXF18US18Y6ZfV5JhqCxa13yh
id_V = Id('b45349ff037a7f65bcf9b7c86181828f5e05dbfe6cf2efe9af6362c8d53a00b0') #address is my6e3Kf7vUEW9dvdhS9jrMHUjsL1k95csk 

# new tx to P: eebefbe57fc27188acf24b9c2b03f69016a86e66ba691c15cf2a802b9eb4fad8
# new tx to V: 14032db0c21c079cb6e7cdba52fc0fd21d72bdc651dfc4adb3bcaca1d42d006c
# new funding tx: f6617e14ee663db4eed1cc0367c2d770e4eb95e56b97d7785b13e5b57dcf9674


"""
# # # # # # # #
# Funding transaction
# # # # # # # #

#inputs
tx_in_P = TxInput('eebefbe57fc27188acf24b9c2b03f69016a86e66ba691c15cf2a802b9eb4fad8', 1) 
tx_in_V = TxInput('14032db0c21c079cb6e7cdba52fc0fd21d72bdc651dfc4adb3bcaca1d42d006c', 0) 
#outputs
tx_out_multisig = TxOutput(18295, scripts.get_script_ft_output(id_P, id_V)) 
#tx_out_payback = TxOutput(9100, id_P.p2pkh)
#construct tx
tx = Transaction([tx_in_P, tx_in_V], [tx_out_multisig])
#compute signatures
sig_P = id_P.sk.sign_input(tx, 0 , id_P.p2pkh) 
sig_V = id_V.sk.sign_input(tx, 1 , id_V.p2pkh) 
# unlocking script for the input
tx_in_P.script_sig = Script([sig_P, id_P.pk.to_hex()])
tx_in_V.script_sig = Script([sig_V, id_V.pk.to_hex()])

print(tx.serialize())
"""

"""
# # # # # # # #
# Spend funding tx!
# # # # # # # #
 
#inputs 
tx_in_forfees = TxInput('d7a751512420e267ad5abbfdca6c2f9133ab61e7952d728db868d3bc50d89110', 0)
tx_in_ft = TxInput('d7a751512420e267ad5abbfdca6c2f9133ab61e7952d728db868d3bc50d89110', 1) 
#outputs
tx_out = TxOutput(25880, scripts.get_script_ft_output(id_P, id_V))
# construct tx
tx = Transaction([tx_in_forfees, tx_in_ft], [tx_out])
scriptFToutput = scripts.get_script_ft_output(id_P, id_V)

print(tx.serialize())

#compute signatures
sig_P = id_P.sk.sign_input(tx, 1 , scriptFToutput) 
sig_V = id_V.sk.sign_input(tx, 1 , scriptFToutput) 
#print("SigV: ", sig_V)
sig_P_forfees = id_P.sk.sign_input(tx, 0 , id_P.p2pkh) 
# unlocking script for the input
tx_in_ft.script_sig = Script([sig_V, sig_P]) #note P and V are reversed!
tx_in_forfees.script_sig = Script([sig_P_forfees, id_P.pk.to_hex()])

print(tx.serialize())
"""


# # # # # # # #
# Create unlocked commitment transaction P 
# # # # # # # #

secret_rev_P = hash256("Hey! This is P, and this is my revocation secret".encode("utf-8").hex()) 
secret_rev_V = hash256("Hey! This is V, and this is my revocation secret".encode("utf-8").hex()) 

# P is owner and V is punisher. Secret_rev is from P (V knows it)
ct_P_locked = txs.get_LNBridge_ct(TxInput('f6617e14ee663db4eed1cc0367c2d770e4eb95e56b97d7785b13e5b57dcf9674', 0), id_P, id_V, hash256(secret_rev_P), hash256(secret_rev_V), 9000, 9000, 420, l=True, timelock=0x2, locked=True)

ct_V_locked = txs.get_standard_ct(TxInput('f6617e14ee663db4eed1cc0367c2d770e4eb95e56b97d7785b13e5b57dcf9674', 0), id_V, id_P, hash256(secret_rev_V), 9000, 9000, 420, l=False, timelock=0x2, locked=True)

ct_P_unlocked = txs.get_LNBridge_ct(TxInput('f6617e14ee663db4eed1cc0367c2d770e4eb95e56b97d7785b13e5b57dcf9674', 0), id_P, id_V, hash256(secret_rev_P), hash256(secret_rev_V), 9000, 9000, 420, l=True, timelock=0x2, locked=False)

ct_V_unlocked = txs.get_standard_ct(TxInput('f6617e14ee663db4eed1cc0367c2d770e4eb95e56b97d7785b13e5b57dcf9674', 0), id_V, id_P, hash256(secret_rev_V), 9000, 9000, 420, l=False, timelock=0x2, locked=False)

print("Comm TX P locked: ", ct_P_locked.serialize())
print("")
print("Comm TX V locked: ", ct_V_locked.serialize())
print("")
print("Comm TX P unlocked: ", ct_P_unlocked.serialize()) # 6ff3e49f2a5394e3bb4c43d7d409e534da0dcc53e72c3bab981ff9e4422aa073
print("")
print("Comm TX V unlocked: ", ct_V_unlocked.serialize())

######### Useful Websites #########

# Breakdown Bitcoin Raw Transaction: https://rsbondi.github.io/btc-adventure/
# Bitcoin transactino decoder: https://live.blockcypher.com/btc/decodetx/
# Blockstream testnet explorer: https://blockstream.info/testnet/