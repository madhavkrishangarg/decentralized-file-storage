// Global variables
let chatMessages = [];
let currentNodeId = '';
let fileList = [];

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
    document.getElementById('chat-input-field').addEventListener('keypress', function (e) {
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
        <div style="position: sticky; top: 0; background-color: white; padding-bottom: 20px; z-index: 1;">
            <input type="file" id="file-upload" style="display: none;">
            <button id="upload-btn" class="action-button" style="width: 100%; background-color: #3a3652; color: white; border: none; padding: 10px; font-size: 1rem; cursor: pointer; border-radius: 5px; transition: background-color 0.3s; display: flex; align-items: center; justify-content: center;">
                <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ffffff'%3E%3Cpath d='M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z'/%3E%3C/svg%3E" alt="Upload" class="button-icon" style="width: 24px; height: 24px; margin-right: 8px;">
                Upload File
            </button>
        </div>
        <ul id="file-list" class="file-list" style="margin-top: 20px;"></ul>
    `;
    document.getElementById('upload-btn').addEventListener('click', () => document.getElementById('file-upload').click());
    document.getElementById('file-upload').addEventListener('change', uploadFile);
    displayFileList();
}

// Upload a file
async function uploadFile(event) {
    const file = event.target.files[0];
    if (file) {
        try {
            showPopup('uploadingPopup');
            const result = await window.electronAPI.distributeFile(file.path);
            console.log('File distributed successfully:', result.file_id);
            fileList.push({ id: result.file_id, name: file.name });
            displayFileList();
            hidePopup('uploadingPopup');
            alert('File uploaded successfully!');
        } catch (error) {
            console.error('Failed to distribute file:', error);
            hidePopup('uploadingPopup');
            alert('Failed to upload file. Please try again.');
        }
    }
}

// Display the list of files
function displayFileList() {
    const fileListElement = document.getElementById('file-list');
    if (fileListElement) {
        fileListElement.innerHTML = '';
        fileList.forEach(file => {
            const li = document.createElement('li');
            li.classList.add('file-item');
            li.innerHTML = `
                <div class="file-info">
                    <div class="file-name">${file.name}</div>
                    <div class="file-id">${file.id}</div>
                </div>
                <div class="file-actions">
                    <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%233a3652'%3E%3Cpath d='M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z'/%3E%3C/svg%3E" alt="Download" class="action-icon" onclick="downloadFile('${file.id}')">
                    <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ff4757'%3E%3Cpath d='M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z'/%3E%3C/svg%3E" alt="Delete" class="action-icon" onclick="deleteFile('${file.id}')">
                </div>
            `;
            fileListElement.appendChild(li);
        });
    }
}

// Download a file
async function downloadFile(fileId) {
    try {
        showPopup('downloadingPopup');
        const savePath = await window.electronAPI.showSaveDialog({
            title: 'Save File',
            defaultPath: `${fileId}`,
            buttonLabel: 'Save',
            filters: [
                { name: 'All Files', extensions: ['*'] }
            ]
        });

        if (savePath.canceled) {
            console.log('File save canceled by user');
            hidePopup('downloadingPopup');
            return;
        }

        const result = await window.electronAPI.retrieveFile(fileId, savePath.filePath);
        console.log('File retrieved successfully:', result.status);
        hidePopup('downloadingPopup');
        alert('File downloaded successfully!');
    } catch (error) {
        console.error('Failed to retrieve file:', error);
        hidePopup('downloadingPopup');
        alert('Failed to download file. Please try again.');
    }
}

// Delete a file
async function deleteFile(fileId) {
    try {
        const result = await window.electronAPI.deleteFile(fileId);
        console.log('File deleted successfully:', result.status);
        fileList = fileList.filter(file => file.id !== fileId);
        displayFileList();
        alert('File deleted successfully!');
    } catch (error) {
        console.error('Failed to delete file:', error);
        alert('Failed to delete file. Please try again.');
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

function showPopup(popupId) {
    const popup = document.getElementById(popupId);
    if (popup) popup.style.display = 'flex';
}

// Hide popup function
function hidePopup(popupId) {
    const popup = document.getElementById(popupId);
    if (popup) popup.style.display = 'none';
}

function stopNode() {
    window.electronAPI.stopNode();
    window.location.href = 'landing.html';
}

// Make functions available globally
window.joinNetwork = joinNetwork;
window.createNetwork = createNetwork;
window.downloadFile = downloadFile;
window.deleteFile = deleteFile;