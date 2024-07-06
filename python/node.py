import hashlib
import socket
import threading
import json
import time
import random
import os
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from file_manager import FileManager
import struct
import math
import queue
import traceback
import asyncio
import hashlib
import logging

# logging.basicConfig(level=logging.DEBUG)
# logger = logging.getLogger(__name__)


MAX_UDP_PAYLOAD = 1024

class Node:
    def __init__(self, host, port, known_peer=None):
        self.host = host
        self.port = port
        self.peers = {}
        self.socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)  # UDP
        self.socket.bind((host, port))
        self.running = False
        self.threads = []
        self.shutdown_event = threading.Event()

        self.private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048
        )

        self.public_key = self.private_key.public_key()

        #generate public key hash as node id

        self.node_id = hashlib.sha256(
            self.public_key.public_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PublicFormat.SubjectPublicKeyInfo
            )
        ).hexdigest()
        
        self.file_manager = FileManager(self.private_key, self.node_id)
        
        self.know_peer = known_peer
        self.discovery_response_received = asyncio.Event()

        
        self.chunks = {}        # Store received chunks
        self.distributed_files = {}
        self.chunk_distribution = {}

        self.chunk_distribution_lock = asyncio.Lock()
        self.peer_lock = asyncio.Lock()
        self.chunk_lock = asyncio.Lock()

        self.chat_messages = []

        print(known_peer)
        print("Node initialized.")


    async def start(self):
        self.running = True
        self.threads = [threading.Thread(target=self.listen, daemon=True),
        threading.Thread(target=self.discover_peers, daemon=True),
        threading.Thread(target=self.ping_peers, daemon=True)]

        for thread in self.threads:
            thread.start()

            
        if self.know_peer:
            print("Sending discovery message to known peer...")
            self.send_message({'type': 'discovery'}, self.know_peer)
            try:
                await asyncio.wait_for(self.discovery_response_received.wait(), timeout=15)
            except asyncio.TimeoutError:
                print("Discovery response not received from known peer. Exiting.")
                return None, None

        print("Node started.")
        return self.port, self.node_id

    def stop(self):
        print("Stopping node...")
        self.running = False
        self.shutdown_event.set()
        self.leave()
        
        for thread in self.threads:
            thread.join(timeout=2)  
        
        try:
            self.socket.shutdown(socket.SHUT_RDWR)
        except Exception as e:
            pass 
        self.socket.close()
        
        print("Node stopped.")

    def listen(self):
        buffer = {}
        while not self.shutdown_event.is_set():
            try:
                data, addr = self.socket.recvfrom(MAX_UDP_PAYLOAD + 4)      # Receive data, including chunk header
                chunk_header = data[:4]     # Extract chunk header
                index, total_chunks = struct.unpack("!HH", chunk_header)        # Unpack chunk header
                chunk = data[4:]        # Extract chunk data

                if addr not in buffer:  
                    buffer[addr] = {}

                if addr in buffer and index in buffer[addr]:
                    continue  # Skip already received chunk

                buffer[addr][index] = chunk

                if len(buffer[addr]) == total_chunks and all(index in buffer[addr] for index in range(total_chunks)):
                    # All chunks received, reassemble
                    full_message = b''.join(buffer[addr][i] for i in range(total_chunks))
                    del buffer[addr]  # Clear buffer for this addr
                    message = json.loads(full_message.decode())
                    self.handle_message(message, addr)
            except Exception as e:
                print(f"Error in listen: {e}")
                traceback.print_exc()
                try:
                    self.socket.close()
                    self.socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                    self.socket.bind((self.host, self.port))
                except Exception as e:
                    pass


    def handle_message(self, message, addr):
        # print(message, addr) 
        # print(self.peers)
        try:
            msg_type = message.get('type')
            sender_id = message.get('sender_id')
            
            if msg_type == 'discovery':
                self.send_message({'type': 'discovery_response', 'port': self.port, 'node_id': self.node_id}, addr)

                for peer_id, peer_info in self.peers.items():
                    self.send_message({'type': 'new_peer', 'address': peer_info['host'], 'port': peer_info['port'], 'node_id': peer_id}, addr)
                self.peers[sender_id] = {'host': addr[0], 'port': addr[1], 'last_seen': time.time()}
                    
            elif msg_type == 'discovery_response':
                self.peers[sender_id] = {'host': addr[0], 'port': message['port'], 'last_seen': time.time()}
                self.discovery_response_received.set()


            elif msg_type == 'new_peer':
                new_peer_id = message['node_id']
                if new_peer_id not in self.peers and new_peer_id != self.node_id:
                    self.peers[new_peer_id] = {'host': message['address'], 'port': message['port'], 'last_seen': time.time()}
                    self.send_message({'type': 'discovery'}, (message['address'], message['port']))

            elif msg_type == 'ping':
                self.send_message({'type': 'pong'}, addr)

            elif msg_type == 'pong':
                self.peers[sender_id]['last_seen'] = time.time()

            elif msg_type == 'leave':
                # print("Node left:", addr)
                if sender_id in self.peers:
                    del self.peers[sender_id]
                    self.update_chunk_distribution(sender_id)

            elif msg_type == 'chat':
                print(f"Message from {sender_id}: {message['content']}")
                self.chat_messages.append({
                    'sender': sender_id,
                    'content': message['content']
                })
                

            elif msg_type == 'store_chunk':     # uploader sends chunk data to be stored
                chunk_id = message['chunk_id']
                seq_num = message['seq_num']
                chunk_data = bytes.fromhex(message['chunk_data'])
                chunk_hash = message['chunk_hash']

                if hashlib.sha256(chunk_data).hexdigest() == chunk_hash:
                    self.file_manager.store_chunk(chunk_id, seq_num, chunk_data)
                    print(f"Received chunk {chunk_id}")
                
                # Acknowledge storage to the sender
                    self.send_message({
                        'type': 'chunk_stored_ack',
                        'chunk_id': chunk_id,
                        'chunk_hash': chunk_hash
                    }, addr)

            elif msg_type == 'chunk_stored_ack':    # receiver acknowledges chunk storage
                chunk_id = message['chunk_id']
                file_id, _ = chunk_id.split('_')
                chunk_hash = message['chunk_hash']

                if chunk_hash == hashlib.sha256(self.chunks_being_distributed[chunk_id]).hexdigest():   # Check if chunk hash matches
                    if file_id in self.chunk_distribution and chunk_id in self.chunk_distribution[file_id]:
                        self.chunk_distribution[file_id][chunk_id].add(sender_id)

            elif msg_type == 'request_chunk':   # uploader requests chunk data
                chunk_id = message['chunk_id']
                chunk_data = self.file_manager.retrieve_chunk(chunk_id)
                if chunk_data:
                    seq_num, chunk_data = chunk_data
                    self.send_message({
                        'type': 'chunk_data',
                        'chunk_id': chunk_id,
                        'seq_num': seq_num,
                        'chunk_data': chunk_data.hex(),
                        'chunk_hash': hashlib.sha256(chunk_data).hexdigest()
                    }, addr)
                else:
                    print(f"Failed to retrieve chunk {chunk_id}")

            elif msg_type == 'chunk_data':      # uploader receives chunk data
                chunk_id = message['chunk_id']
                seq_num = message['seq_num']
                chunk_data = bytes.fromhex(message['chunk_data'])   # Convert chunk data to bytes
                chunk_hash = hashlib.sha256(chunk_data).hexdigest()
                
                if hashlib.sha256(chunk_data).hexdigest() == chunk_hash:
                    self.chunks[chunk_id] = (seq_num, chunk_data)       # Store chunk data
                    print(f"Chunk {seq_num + 1}/{len(self.chunk_distribution[chunk_id.split('_')[0]])} retrieved")

            elif msg_type == 'delete_chunk':
                chunk_id = message['chunk_id']
                self.file_manager.delete_chunk(chunk_id)
                print(f"Deleted chunk {chunk_id}")

        except Exception as e:
            print(f"Error handling message: {e}")
            traceback.print_exc()


    def discover_peers(self):
        while not self.shutdown_event.is_set():
            if self.peers:
                try:
                    peer = random.choice(list(self.peers.keys()))
                    self.send_message({'type': 'discovery'}, (self.peers[peer]['host'], self.peers[peer]['port']))
                except Exception as e:
                    print(f"Error in discover_peers: {e}")
                    traceback.print_exc()
            elif self.know_peer:
                try:
                    self.send_message({'type': 'discovery'}, (self.know_peer[0], self.know_peer[1]))  # if no peers, send discovery message to known peer
                except Exception as e:
                    print(f"Error in discover_peers: {e}")
                    traceback.print_exc()
                    
            time.sleep(2)


    def ping_peers(self):
        while not self.shutdown_event.is_set():
            # print("No of connected peers: ", len(self.peers))
            
            for peer in list(self.peers.keys()):
                try:
                    if time.time() - self.peers[peer]['last_seen'] > 30:
                        del self.peers[peer]
                    else:
                        self.send_message({'type': 'ping'}, (self.peers[peer]['host'], self.peers[peer]['port']))
                except Exception as e:
                    print(f"Error pinging peer {peer}: {e}")
                    traceback.print_exc()
            time.sleep(10)


    def leave(self):
        for peer in list(self.peers.keys()): 
            try:
                self.send_message({'type': 'leave'}, (self.peers[peer]['host'], self.peers[peer]['port']))
            except Exception as e:
                print(f"Error sending leave message to {peer}: {e}")
                traceback.print_exc()
        
        self.peers.clear()
        self.chunks.clear()
        
        for file_id in self.chunk_distribution:
            for chunk_id in self.chunk_distribution[file_id]:
                self.chunk_distribution[file_id][chunk_id] = {
                    node for node in self.chunk_distribution[file_id][chunk_id] 
                    if node != (self.host, self.port)
                }


    def send_message(self, message, addr):
        message['sender_id'] = self.node_id
        message_json = json.dumps(message).encode()
        message_length = len(message_json)

        # print("Message length: ", message_length)
        
        if message_length <= MAX_UDP_PAYLOAD:
            self._send_chunk(message_json, addr, 0, 1)
        else:
            num_chunks = (message_length + MAX_UDP_PAYLOAD - 1) // MAX_UDP_PAYLOAD
            for i in range(num_chunks):
                chunk = message_json[i * MAX_UDP_PAYLOAD:(i + 1) * MAX_UDP_PAYLOAD]
                self._send_chunk(chunk, addr, i, num_chunks)


    def _send_chunk(self, chunk, addr, index, total_chunks):
        chunk_header = struct.pack("!HH", index, total_chunks) 
        for i in range(3):
            try:
                self.socket.sendto(chunk_header + chunk, addr)
                return
            except Exception as e:
                print(f"Error sending chunk: {e}")
                traceback.print_exc()
                time.sleep(0.5)


    def broadcast(self, message):
        for peer in list(self.peers.keys()):
            self.send_message({'type': 'chat', 'content': message}, (self.peers[peer]['host'], self.peers[peer]['port']))


    async def send_chunk_to_peer(self, peer, chunk_id, seq_num, chunk):
        ack_received = False
        file_id = chunk_id.split('_')[0]

        chunk_hash = hashlib.sha256(chunk).hexdigest()

        self.chunks_being_distributed[chunk_id] = chunk
        
        while not ack_received:
            self.send_message({
                'type': 'store_chunk',
                'chunk_id': chunk_id,
                'seq_num': seq_num,
                'chunk_data': chunk.hex(),
                'chunk_hash': chunk_hash
            }, (self.peers[peer]['host'], self.peers[peer]['port']))

            await asyncio.sleep(0.2)
            ack_received = chunk_id in self.chunk_distribution[file_id] and len(self.chunk_distribution[file_id][chunk_id]) >= 1

    async def distribute_file(self, file_path):
        file_id, encrypted_key, sequenced_chunks = self.file_manager.prepare_file_for_distribution(file_path)

        self.chunk_distribution[file_id] = {}
        num_chunks = len(sequenced_chunks)
        active_peers = list(self.peers.keys())
        num_peers = len(active_peers)

        tasks = []
        self.chunks_being_distributed = {}

        if num_peers == 1:
            peer = active_peers[0]
            for seq_num, chunk in sequenced_chunks:
                chunk_id = f"{file_id}_{seq_num}"
                self.chunk_distribution[file_id][chunk_id] = set()
                task = asyncio.create_task(self.send_chunk_to_peer(peer, chunk_id, seq_num, chunk))
                tasks.append(task)
        else:
            replicas_per_chunk = max(1, math.ceil(num_peers / 2))

            for seq_num, chunk in sequenced_chunks:
                chunk_id = f"{file_id}_{seq_num}"
                self.chunk_distribution[file_id][chunk_id] = set()

                for j in range(replicas_per_chunk):
                    peer = active_peers[(seq_num + j) % num_peers]
                    task = asyncio.create_task(self.send_chunk_to_peer(peer, chunk_id, seq_num, chunk))
                    tasks.append(task)

        await asyncio.gather(*tasks)

        self.distributed_files[file_id] = encrypted_key

        print(f"File distributed. File ID: {file_id}")
        return file_id

    async def retrieve_file(self, file_id, max_retries=3):
        if file_id not in self.distributed_files or file_id not in self.chunk_distribution:
            print("File ID not found or chunk distribution information missing.")
            return None

        encrypted_key = self.distributed_files[file_id]
        chunk_ids = list(self.chunk_distribution[file_id].keys())
        total_chunks = len(chunk_ids)

        retrieved_chunks = {}
        max_concurrent_tasks = min(total_chunks, 100)
        semaphore = asyncio.Semaphore(max_concurrent_tasks)

        async def retrieve_chunk(chunk_id):
            async with semaphore:
                for retry in range(max_retries):
                    nodes = self.chunk_distribution[file_id][chunk_id]
                    for node in nodes:
                        if node not in self.peers:
                            continue
                        
                        self.send_message({
                            'type': 'request_chunk',
                            'chunk_id': chunk_id
                        }, (self.peers[node]['host'], self.peers[node]['port']))

                        try:
                            async with asyncio.timeout(5):  # 5-second timeout
                                while True:
                                    async with self.chunk_lock:
                                        if chunk_id in self.chunks:
                                            seq_num, chunk_data = self.chunks[chunk_id]
                                            return chunk_id, (seq_num, chunk_data)
                                    await asyncio.sleep(0.1)
                        except asyncio.TimeoutError:
                            continue
                        
                print(f"Failed to retrieve chunk {chunk_id} after {max_retries} retries")
                return chunk_id, None

        tasks = [asyncio.create_task(retrieve_chunk(chunk_id)) for chunk_id in chunk_ids]
        results = await asyncio.gather(*tasks)

        for chunk_id, result in results:
            if result is not None:
                retrieved_chunks[chunk_id] = result

        if len(retrieved_chunks) < total_chunks:
            print("Failed to retrieve all chunks. File is incomplete.")
            return None

        print("All chunks retrieved successfully. Attempting to reconstruct file.")

        try:
            loop = asyncio.get_event_loop()
            decrypted_data = await loop.run_in_executor(
                None, self.file_manager.reconstruct_file_from_chunks, [retrieved_chunks[chunk_id] for chunk_id in chunk_ids], encrypted_key
            )

            async with self.chunk_lock:
                for chunk_id in self.chunk_distribution[file_id]:
                    self.chunks.pop(chunk_id, None)

            return decrypted_data

        except Exception as e:
            print(f"Error during file reconstruction: {e}")
            traceback.print_exc()
            return None

    def update_chunk_distribution(self, left_node=None):        # Update chunk distribution when a node leaves
        for file_id in self.chunk_distribution:
            for chunk_id in self.chunk_distribution[file_id]:
                if left_node:
                    self.chunk_distribution[file_id][chunk_id].discard(left_node)
                self.chunk_distribution[file_id][chunk_id] = {
                    node for node in self.chunk_distribution[file_id][chunk_id] if node in self.peers     
                }
        # print("Updated chunk distribution : ", self.chunk_distribution)

    def delete_file(self, file_id):
        # print(self.chunk_distribution)
        
        for chunk_id in self.chunk_distribution[file_id]:
            for node in self.chunk_distribution[file_id][chunk_id]:
                self.send_message({'type': 'delete_chunk', 'chunk_id': chunk_id}, (self.peers[node]['host'], self.peers[node]['port']))
        self.chunk_distribution.pop(file_id, None)
        self.distributed_files.pop(file_id, None)