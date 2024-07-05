import os
import hashlib
import time
from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.backends import default_backend
import base64
from cryptography.hazmat.primitives import serialization
import lmdb

class FileManager:
    def __init__(self, private_key, node_id):
        self.private_key = private_key
        self.public_key = private_key.public_key()
        self.chunk_size = 1024
        self.node_id = node_id
        self.env = lmdb.open(f"db_{node_id}", map_size=5 * 1024 * 1024 * 100) # 500 MB 
        
    def encrypt_file(self, file_path):
        with open(file_path, 'rb') as file:
            data = file.read()
        symmetric_key = Fernet.generate_key()
        f = Fernet(symmetric_key)
        encrypted_data = f.encrypt(data)
        encrypted_symmetric_key = self.public_key.encrypt(
            symmetric_key,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None
            )
        )
        return encrypted_data, encrypted_symmetric_key

    def decrypt_file(self, encrypted_data, encrypted_key):
        try:
            # Decrypt the symmetric key
            symmetric_key = self.private_key.decrypt(
                encrypted_key,
                padding.OAEP(
                    mgf=padding.MGF1(algorithm=hashes.SHA256()),
                    algorithm=hashes.SHA256(),
                    label=None
                )
            )
            # Decrypt the file data
            f = Fernet(symmetric_key)
            decrypted_data = f.decrypt(encrypted_data)
            return decrypted_data
        except InvalidToken:
            print("Error: Invalid token. The data may be corrupted or the wrong key was used.")
            return None
        except Exception as e:
            print(f"Error during decryption: {str(e)}")
            return None

    def chunk_file(self, data):
        chunks = [data[i:i+self.chunk_size] for i in range(0, len(data), self.chunk_size)]
        return [(i, chunk) for i, chunk in enumerate(chunks)]  # Return chunks with sequence numbers

    def reconstruct_file(self, sequenced_chunks):
        # Sort chunks by sequence number and extract only the data
        sorted_chunks = sorted(sequenced_chunks, key=lambda x: x[0])
        return b''.join(chunk for _, chunk in sorted_chunks)

    def get_public_key_hash(self):
        public_key_bytes = self.public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        )
        return hashlib.sha256(public_key_bytes).hexdigest()[:16]  # First 16 chars of the hash

    def generate_file_id(self, file_path):
        # Combine public key hash, file name, and timestamp for uniqueness
        public_key_hash = self.get_public_key_hash()
        file_name = os.path.basename(file_path)
        timestamp = str(int(time.time()))
        combined = f"{public_key_hash}_{file_name}_{timestamp}".encode()
        return hashlib.sha256(combined).hexdigest()

    def prepare_file_for_distribution(self, file_path):
        file_id = self.generate_file_id(file_path)
        encrypted_data, encrypted_key = self.encrypt_file(file_path)
        sequenced_chunks = self.chunk_file(encrypted_data)
        return file_id, encrypted_key, sequenced_chunks

    def reconstruct_file_from_chunks(self, sequenced_chunks, encrypted_key):
        encrypted_data = self.reconstruct_file(sequenced_chunks)
        return self.decrypt_file(encrypted_data, encrypted_key)

    def store_chunk(self, chunk_id, seq_num, chunk_data):
        with self.env.begin(write=True) as txn:
            txn.put(chunk_id.encode(), chunk_data)
            txn.put(f"{chunk_id}_seq".encode(), str(seq_num).encode())

    def retrieve_chunk(self, chunk_id):
        with self.env.begin() as txn:
            chunk_data = txn.get(chunk_id.encode())
            seq_num = txn.get(f"{chunk_id}_seq".encode())
            if chunk_data is None or seq_num is None:
                return None
            return int(seq_num.decode()), chunk_data

    def delete_chunk(self, chunk_id):
        with self.env.begin(write=True) as txn:
            txn.delete(chunk_id.encode())
            txn.delete(f"{chunk_id}_seq".encode())