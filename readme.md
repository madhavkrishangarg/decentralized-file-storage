# Decentralized File Storage System

A peer-to-peer file storage system that leverages UDP/IP for efficient network communication, asynchronous programming for improved performance, and a custom replication algorithm for enhanced resource availability.

## Features

### 1. UDP/IP Communication

This project utilizes UDP/IP for network communication, significantly reducing latency and network overhead compared to TCP/IP. UDP's connectionless nature allows for faster data transmission, making it ideal for a distributed file storage system where speed is crucial.

Key benefits:
- Lower latency in file transfers
- Reduced network congestion
- Improved performance in high-throughput scenarios

### 2. Asynchronous Programming

The system employs asynchronous programming techniques to handle file storage and retrieval operations. This approach allows for concurrent processing of multiple requests, significantly increasing efficiency.


```24:67:python/node.py
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

```


Key advantages:
- Improved responsiveness of the system
- Better utilization of system resources
- Increased throughput in file operations

### 3. Custom Replication Algorithm

To enhance resource availability across the network, we've implemented a custom replication algorithm. This ensures that files are distributed and replicated efficiently among peers, improving fault tolerance and data accessibility.

Key features:
- Dynamic replication based on network conditions
- Load balancing to prevent hotspots
- Intelligent chunk distribution for optimal storage utilization

### 4. Secure File Storage

Files are encrypted before storage and decrypted upon retrieval, ensuring data confidentiality. The system uses asymmetric encryption for key exchange and symmetric encryption for file content.


```35:40:python/node.py

        self.private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048
        )

```


### 5. Distributed Hash Table (DHT)

The system implements a DHT for efficient file lookup and peer discovery. This allows for scalable and decentralized management of file locations and peer information.

### 6. Chunk-based File Management

Large files are split into smaller chunks, enabling efficient storage and transfer across the network. This approach also facilitates parallel downloads and improved fault tolerance.


```57:62:python/node.py
        
        self.chunks = {}        # Store received chunks
        self.distributed_files = {}
        self.chunk_distribution = {}

        self.chunk_distribution_lock = asyncio.Lock()
```


### 7. Peer Discovery and Network Joining

New nodes can easily join the network by connecting to a known peer. The system then facilitates automatic peer discovery and integration into the network.


```12:36:renderer.js
// Join network function
function joinNetwork() {
    const loadingPopup = document.getElementById('loadingPopup');
    loadingPopup.style.display = 'flex';

    const address = document.getElementById('network-address').value;
    if (address) {
        window.electronAPI.startNode(address)
            .then(result => {
                console.log('Node started:', result);
                window.electronAPI.loadDashboard();
                setTimeout(() => {
                    loadingPopup.style.display = 'none';
                    alert('Unable to connect to network. Please try again.')
                }, 20000);
            })
            .catch(error => console.error('Failed to start node:', error));
        setTimeout(() => {
            loadingPopup.style.display = 'none';
            alert('Unable to connect to network. Please try again.')
        }, 20000);
    } else {
        alert('Please enter a network address');
        loadingPopup.style.display = 'none';
    }
```


### 8. User-friendly Interface

The project includes an Electron-based desktop application with an intuitive user interface for easy interaction with the decentralized storage system.


```0:44:dashboard.html
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Decentralised File Storage System - Dashboard</title>
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600&display=swap" rel="stylesheet">
    <style>
        body,
        html {
            margin: 0;
            padding: 0;
            font-family: 'Montserrat', Arial, sans-serif;
            height: 100%;
        }

        .container {
            display: flex;
            height: 100%;
        }

        .sidebar {
            background-color: #3a3652;
            color: white;
            width: 80px;
            padding: 20px 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
        }

        .sidebar-top {
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .sidebar-icon {
            width: 30px;
            height: 30px;
            margin-bottom: 20px;
            cursor: pointer;
```


### 9. Cross-platform Support

The application is built to run on multiple platforms, including macOS and Windows, ensuring wide accessibility.


```25:39:package.json
    ],
    "mac": {
      "category": "public.app-category.utilities",
      "target": [
        "dmg",
        "zip"
      ],
      "icon": "icon/mac.icns"
    },
    "win": {
      "target": [
        "nsis",
        "portable"
      ],
      "icon": "icon/windows.ico"
```


### 10. Real-time Chat Functionality

Users can communicate with other peers in the network through a built-in chat feature, fostering collaboration and community interaction.


```59:77:renderer.js
// Show chat interface
async function showChat() {
    setElementText('content-title', 'Chat');
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `
        <div class="chat-container">
            <div class="chat-messages" id="chat-messages"></div>
            <div class="chat-input">
                <input type="text" id="chat-input-field" placeholder="Type your message...">
                <button id="send-message-btn">Send</button>
            </div>
        </div>
    `;
    document.getElementById('send-message-btn').addEventListener('click', sendChatMessage);
    document.getElementById('chat-input-field').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') sendChatMessage();
    });
    displayChatMessages();
    startMessagePolling();
```


## Getting Started

[Include instructions on how to set up and run the project]

## Contributing

[Guidelines for contributing to the project]

## License

This project is licensed under the MIT License - see the LICENSE file for details.