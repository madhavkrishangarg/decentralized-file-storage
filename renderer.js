// Global variables
let chatMessages = [];
let currentNodeId = '';

// Utility function to set element text content
function setElementText(id, text) {
    const element = document.getElementById(id);
    if (element) element.textContent = text;
}

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
                setTimeout(() => {loadingPopup.style.display = 'none';
                    alert('Unable to connect to network. Please try again.')
                }, 15000);
            })
            .catch(error => console.error('Failed to start node:', error));
            setTimeout(() => {loadingPopup.style.display = 'none';
                alert('Unable to connect to network. Please try again.')
            }, 15000);

    } else {
        alert('Please enter a network address');
        loadingPopup.style.display = 'none';
    }

}

// Create network function
function createNetwork() {
    window.electronAPI.startNode(null)
        .then(() => window.electronAPI.loadDashboard())
        .catch(error => alert(`Failed to create network: ${error.message}`));
}

// Initialize dashboard
async function initDashboard() {
    try {
        const nodeId = await window.electronAPI.getNodeId();
        const portNumber = await window.electronAPI.getPortNumber();
        setElementText('node-id', nodeId);
        setElementText('port-no', portNumber);
        currentNodeId = nodeId;
    } catch (error) {
        console.error('Failed to initialize dashboard:', error);
    }
}

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
    document.getElementById('chat-input-field').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') sendChatMessage();
    });
    displayChatMessages();
    startMessagePolling();
}

// Add a chat message
function addChatMessage(message, type, nodeId) {
    chatMessages.push({ message, type, nodeId });
    displayChatMessages();
}

// Display all chat messages
function displayChatMessages() {
    const chatMessagesElement = document.getElementById('chat-messages');
    if (chatMessagesElement) {
        chatMessagesElement.innerHTML = '';
        chatMessages.forEach(msg => {
            const messageElement = document.createElement('div');
            messageElement.classList.add('chat-message', msg.type);
            messageElement.innerHTML = `
                <div class="node-id">${msg.nodeId}</div>
                <div class="message-content">${msg.message}</div>
            `;
            chatMessagesElement.appendChild(messageElement);
        });
        chatMessagesElement.scrollTop = chatMessagesElement.scrollHeight;
    }
}

// Send a chat message
async function sendChatMessage() {
    const messageInput = document.getElementById('chat-input-field');
    const message = messageInput.value.trim();
    if (message) {
        try {
            await window.electronAPI.sendChat(message);
            addChatMessage(message, 'outgoing', currentNodeId);
            messageInput.value = '';
        } catch (error) {
            console.error('Failed to send message:', error);
        }
    }
}

// Start polling for new messages
function startMessagePolling() {
    setInterval(async () => {
        try {
            const result = await window.electronAPI.getMessages();
            result.messages.forEach(message => {
                if (!chatMessages.some(msg => msg.message === message.content && msg.nodeId === message.sender)) {
                    addChatMessage(message.content, 'incoming', message.sender);
                }
            });
        } catch (error) {
            console.error('Failed to get messages:', error);
        }
    }, 1000);
}

// Show files interface
function showFiles() {
    setElementText('content-title', 'My Files');
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `
        <input type="file" id="file-upload" style="display: none;">
        <button id="upload-btn" style="margin-bottom: 20px;">Upload File</button>
        <ul id="file-list" class="file-list"></ul>
    `;
    document.getElementById('upload-btn').addEventListener('click', () => document.getElementById('file-upload').click());
    document.getElementById('file-upload').addEventListener('change', uploadFile);
    loadFileList();
}

// Upload a file
async function uploadFile(event) {
    const file = event.target.files[0];
    if (file) {
        try {
            const result = await window.electronAPI.distributeFile(file.path);
            console.log('File distributed successfully:', result.file_id);
            loadFileList();
        } catch (error) {
            console.error('Failed to distribute file:', error);
        }
    }
}

// Load the list of files
async function loadFileList() {
    // In a real application, you would fetch this list from your node
    // For now, we'll use a placeholder list
    const files = [
        { id: 'file1', name: 'document1.pdf' },
        { id: 'file2', name: 'image1.jpg' },
    ];
    const fileList = document.getElementById('file-list');
    fileList.innerHTML = '';
    files.forEach(file => {
        const li = document.createElement('li');
        li.classList.add('file-item');
        li.innerHTML = `
            <span>${file.name}</span>
            <div class="file-actions">
                <button onclick="downloadFile('${file.id}')">Download</button>
                <button onclick="deleteFile('${file.id}')">Delete</button>
            </div>
        `;
        fileList.appendChild(li);
    });
}

// Download a file
async function downloadFile(fileId) {
    try {
        const result = await window.electronAPI.retrieveFile(fileId, `downloads/${fileId}`);
        console.log('File retrieved successfully:', result.status);
    } catch (error) {
        console.error('Failed to retrieve file:', error);
    }
}

// Delete a file
async function deleteFile(fileId) {
    try {
        const result = await window.electronAPI.deleteFile(fileId);
        console.log('File deleted successfully:', result.status);
        loadFileList();
    } catch (error) {
        console.error('Failed to delete file:', error);
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Check if we're on the landing page or dashboard
    if (document.getElementById('join-network-btn')) {
        // Landing page
        document.getElementById('join-network-btn').addEventListener('click', joinNetwork);
        document.getElementById('create-network-btn').addEventListener('click', createNetwork);
    } else {
        // Dashboard
        initDashboard();
        document.getElementById('chat-btn').addEventListener('click', showChat);
        document.getElementById('files-btn').addEventListener('click', showFiles);
        showChat(); // Show chat by default
    }
});

// Make functions available globally
window.joinNetwork = joinNetwork;
window.createNetwork = createNetwork;
window.downloadFile = downloadFile;
window.deleteFile = deleteFile;