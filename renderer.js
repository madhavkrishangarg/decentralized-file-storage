const { ipcRenderer } = require('electron');

function joinNetwork() {
    const address = document.getElementById('network-address').value;
    if (address) {
        ipcRenderer.send('start-node', address);
        ipcRenderer.send('load-dashboard');
    } else {
        alert('Please enter an IP address and port number');
    }
}

function createNetwork() {
    ipcRenderer.send('start-node', '');
    ipcRenderer.send('load-dashboard');
}

// Dashboard specific code
if (window.location.href.includes('dashboard.html')) {
    const contentArea = document.getElementById('content-area');
    const contentTitle = document.getElementById('content-title');

    document.getElementById('chat-btn').addEventListener('click', showChat);
    document.getElementById('files-btn').addEventListener('click', showFiles);

    function showChat() {
        contentTitle.textContent = 'Chat';
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
    }

    function showFiles() {
        contentTitle.textContent = 'My Files';
        contentArea.innerHTML = `
            <input type="file" id="file-upload" style="display: none;">
            <button id="upload-btn" style="margin-bottom: 20px;">Upload File</button>
            <ul id="file-list" class="file-list"></ul>
        `;
        document.getElementById('upload-btn').addEventListener('click', () => document.getElementById('file-upload').click());
        document.getElementById('file-upload').addEventListener('change', uploadFile);
        loadFileList();
    }

    async function sendChatMessage() {
        const messageInput = document.getElementById('chat-input-field');
        const message = messageInput.value.trim();
        if (message) {
            const result = await ipcRenderer.invoke('send-chat', message);
            if (result.status === 'success') {
                addChatMessage(message, 'outgoing');
                messageInput.value = '';
            } else {
                console.error('Failed to send message:', result.message);
            }
        }
    }

    function addChatMessage(message, type) {
        const chatMessages = document.getElementById('chat-messages');
        const messageElement = document.createElement('div');
        messageElement.classList.add('chat-message', type);
        messageElement.textContent = message;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    async function uploadFile(event) {
        const file = event.target.files[0];
        if (file) {
            const result = await ipcRenderer.invoke('distribute-file', file.path);
            if (result.status === 'success') {
                console.log('File distributed successfully:', result.file_id);
                loadFileList();
            } else {
                console.error('Failed to distribute file:', result.message);
            }
        }
    }

    async function loadFileList() {
        // In a real application, you would fetch this list from your node
        // For now, we'll use a dummy list
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

    // Handle node info
    ipcRenderer.on('node-info', (event, data) => {
        document.getElementById('node-id').textContent = data.node_id;
        document.getElementById('port-no').textContent = data.port;
    });

    // Handle incoming chat messages
    ipcRenderer.on('chat-message', (event, message) => {
        addChatMessage(`${message.sender_id}: ${message.content}`, 'incoming');
    });

    ipcRenderer.on('node-error', (event, data) => {
        console.error(data);
    });

    // Show chat by default
    showChat();
}

// These functions need to be global to be called from inline event handlers
window.downloadFile = async function(fileId) {
    const result = await ipcRenderer.invoke('retrieve-file', fileId, `downloads/${fileId}`);
    if (result.status === 'success') {
        console.log('File retrieved successfully:', result.message);
    } else {
        console.error('Failed to retrieve file:', result.message);
    }
}

window.deleteFile = async function(fileId) {
    const result = await ipcRenderer.invoke('delete-file', fileId);
    if (result.status === 'success') {
        console.log('File deleted successfully:', result.message);
        loadFileList();  // Reload the file list after deletion
    } else {
        console.error('Failed to delete file:', result.message);
    }
}