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
from binascii import unhexlify, hexlify
from bitcoinutils.constants import SIGHASH_ALL

init.init_network()

#ids chosen at random
id_P = Id('d44348ff037a7f65bcf9b7c86181828f5e05dbfe6cf2efe9af6362c8d53a00b0') #address is mhdTzofrDHXF18US18Y6ZfV5JhqCxa13yh
id_V = Id('b45349ff037a7f65bcf9b7c86181828f5e05dbfe6cf2efe9af6362c8d53a00b0') #address is my6e3Kf7vUEW9dvdhS9jrMHUjsL1k95csk 

# new tx to P: eebefbe57fc27188acf24b9c2b03f69016a86e66ba691c15cf2a802b9eb4fad8
# new tx to V: 14032db0c21c079cb6e7cdba52fc0fd21d72bdc651dfc4adb3bcaca1d42d006c
# new funding tx: f6617e14ee663db4eed1cc0367c2d770e4eb95e56b97d7785b13e5b57dcf9674



# # # # # # # #
# Funding transaction
# # # # # # # #

#inputs
tx_in_P = TxInput('60ee896b9efc7553d868215cdb4c488827fb833739af75087dbe23536cc0b61c', 1) 
tx_in_V = TxInput('e618afd8ee491a005d665e1321334cc396eb4622af737e487134776f76a721d0', 1) 
#outputs
tx_out_multisig = TxOutput(9000, scripts.get_script_ft_output(id_P, id_V)) 
#tx_out_payback = TxOutput(9100, id_P.p2pkh)
#construct tx
tx = Transaction([tx_in_P, tx_in_V], [tx_out_multisig])
#compute signatures
sig_P = id_P.sk.sign_input(tx, 0 , id_P.p2pkh) 
sig_V = id_V.sk.sign_input(tx, 1 , id_V.p2pkh) 
# unlocking script for the input
tx_in_P.script_sig = Script([sig_P, id_P.pk.to_hex()])
tx_in_V.script_sig = Script([sig_V, id_V.pk.to_hex()])

print("Funding transaction: ", tx.serialize()) 
print("--------- End funding transaction -----------") 
"""
# new one: c6e5450bde373444ed0f7b9ef44044fff6c8ca16be46a6bbfcebdf09e1a8bfd7
# Funding transaction:  0200000002b80541649fddd8d1637f078c0642597c724868814a1309c934b4ef3bc693c7e7000000006a47304402204a1f9992bad969cfa54dc3309e6ff8c033ff6b49ad31eaa49b69cda6088f475c022079687ea6631c374e3871ebfb4d778417c88840cd2bfa75ec2d0f7ebef6b162da01210240602913fbabf074554d1db1c9a108978167734826e36bddfb8830852de2137fffffffff69f6197010b97d2bfeab7ed642b77a5842170626e27e607cc8c828fd95311268000000006a473044022077a14c3798f60f3b876d01b781c9ac856b29f2ad382b3d526e5cab92db144cb7022004f239071007851946600dded3e7e8176eb229227d48b5d06fbb716f1f203d7101210313f17fa639f9cf2108e9dc9a14df8a9d5b9f1df1a91efe3d2830e08edd71e182ffffffff01774700000000000046210240602913fbabf074554d1db1c9a108978167734826e36bddfb8830852de2137fad210313f17fa639f9cf2108e9dc9a14df8a9d5b9f1df1a91efe3d2830e08edd71e182ac00000000

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

#print("")
#print("Rev Key P: ", secret_rev_P)
#print("Rev Key V: ", secret_rev_V)
#print("")

# P is owner and V is punisher. Secret_rev is from P (V knows it)
ct_P_locked = txs.get_LNBridge_ct(TxInput('da09f9ac4c16a0f988350bca3243c9e3b6b7f6b8c471db7c49c50de2cb2b3eeb', 0), id_P, id_V, secret_rev_P, secret_rev_V, 9000, 9000, 420, l=True, bothsigs=False, timelock=0x2, locked=True)

ct_V_locked = txs.get_standard_ct(TxInput('da09f9ac4c16a0f988350bca3243c9e3b6b7f6b8c471db7c49c50de2cb2b3eeb', 0), id_P, id_V, secret_rev_V, 9000, 9000, 420, l=False, bothsigs=False, timelock=0x2, locked=True)

ct_P_unlocked = txs.get_LNBridge_ct(TxInput('da09f9ac4c16a0f988350bca3243c9e3b6b7f6b8c471db7c49c50de2cb2b3eeb', 0), id_P, id_V, secret_rev_P, secret_rev_V, 9000, 9000, 420, l=True, bothsigs=False, timelock=0x2, locked=False)

ct_V_unlocked = txs.get_standard_ct(TxInput('da09f9ac4c16a0f988350bca3243c9e3b6b7f6b8c471db7c49c50de2cb2b3eeb', 0), id_P, id_V, secret_rev_V, 9000, 9000, 420, l=False, bothsigs=False, timelock=0x2, locked=False)

print("Comm TX P locked: ", ct_P_locked.serialize())
print("")
print("Comm TX V locked: ", ct_V_locked.serialize())
print("")
print("Comm TX P unlocked: ", ct_P_unlocked.serialize()) 



# e83e8fd2ab897789b434bf798ffcebd4799e8de3fdb7fdf24664149e92bc82a8
# 0200000001d7bfa8e109dfebfcbba646be16cac8f6ff4440f49e7b0fed443437de0b45e5c6000000008f473044022048afcdf24b0cf4a217ae273a9af6ed8491387db916cd6acf59ea394624568bb402204c1f796a30664d83e3b41b657fbf4606839689c1e9469684a4488d3b2176fc3501463043021f5cc217d9d40529ec0b23cac32785fae592e410d297dccd216478dcdfe9807f0220025add493d2b34740a3ad4a4abe35a8d4f1a7ca3f23b987c9c3867fb22c4c37f01ffffffff0356220000000000007276210313f17fa639f9cf2108e9dc9a14df8a9d5b9f1df1a91efe3d2830e08edd71e182ac6375aa2069e38cf1ba4b8d4ba92944fc38de10bacab9b32a7e78bb57cd72f598e035149e8867210240602913fbabf074554d1db1c9a108978167734826e36bddfb8830852de2137fad52b275685156220000000000001976a914c0d90b19a448b569bd0cc77b3da2dd5bb41d2c9f88ac0000000000000000226a20f0f0427c47433d9d440fc105e7d61d1520b5c889ac6405596362fdce95658a3500000000

print("")
print("Comm TX V unlocked: ", ct_V_unlocked.serialize())

######### Useful Websites #########

# Breakdown Bitcoin Raw Transaction: https://rsbondi.github.io/btc-adventure/
# Bitcoin transactino decoder: https://live.blockcypher.com/btc/decodetx/
# Blockstream testnet explorer: https://blockstream.info/testnet/