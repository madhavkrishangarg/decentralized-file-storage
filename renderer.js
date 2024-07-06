// Landing page
function joinNetwork() {
  const address = document.getElementById('network-address').value;
  if (address) {
      window.electronAPI.startNode(address)
          .then(() => window.electronAPI.loadDashboard())
          .catch(error => alert(`Failed to join network: ${error.message}`));
  } else {
      alert('Please enter an IP address and port number');
  }
}

function createNetwork() {
  window.electronAPI.startNode('')
      .then(() => window.electronAPI.loadDashboard())
      .catch(error => alert(`Failed to create network: ${error.message}`));
}

// Dashboard
if (window.location.pathname.includes('dashboard.html')) {
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
          try {
              await window.electronAPI.sendChat(message);
              addChatMessage(message, 'outgoing');
              messageInput.value = '';
          } catch (error) {
              console.error('Failed to send message:', error);
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
          try {
              const result = await window.electronAPI.distributeFile(file.path);
              console.log('File distributed successfully:', result.file_id);
              loadFileList();
          } catch (error) {
              console.error('Failed to distribute file:', error);
          }
      }
  }

  async function loadFileList() {
      // In a real application, you would fetch this list from your node
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

  window.electronAPI.onWsStatus((event, status) => {
      const statusElement = document.getElementById('ws-status');
      if (status.connected) {
          statusElement.textContent = 'Connected to server';
          statusElement.style.color = 'green';
      } else {
          statusElement.textContent = status.maxRetryReached 
              ? 'Failed to connect to server. Please restart the application.' 
              : 'Disconnected from server. Retrying...';
          statusElement.style.color = 'red';
      }
  });

  window.electronAPI.onChatMessage((event, message) => {
      addChatMessage(`${message.sender_id}: ${message.content}`, 'incoming');
  });

  // Show chat by default
  showChat();
}

// These functions need to be global to be called from inline event handlers
window.downloadFile = async function(fileId) {
  try {
      const result = await window.electronAPI.retrieveFile(fileId, `downloads/${fileId}`);
      console.log('File retrieved successfully:', result.message);
  } catch (error) {
      console.error('Failed to retrieve file:', error);
  }
}

window.deleteFile = async function(fileId) {
  try {
      const result = await window.electronAPI.deleteFile(fileId);
      console.log('File deleted successfully:', result.message);
      loadFileList();  // Reload the file list after deletion
  } catch (error) {
      console.error('Failed to delete file:', error);
  }
}