const { ipcRenderer } = require('electron');

document.getElementById('startNode').addEventListener('click', () => {
  const knownPeer = document.getElementById('knownPeer').value;
  ipcRenderer.send('start-node', knownPeer);
  document.getElementById('startNode').disabled = true;
});

document.getElementById('chat').addEventListener('click', () => {
  showActionInput('Enter message to broadcast:');
});

document.getElementById('distribute').addEventListener('click', () => {
  showActionInput('Enter file path to distribute:');
});

document.getElementById('retrieve').addEventListener('click', () => {
  showActionInput('Enter file ID to retrieve:');
});

document.getElementById('delete').addEventListener('click', () => {
  showActionInput('Enter file ID to delete:');
});

document.getElementById('submitAction').addEventListener('click', () => {
  const action = document.getElementById('actionInput').dataset.action;
  const input = document.getElementById('actionInputField').value;
  
  let command;
  if (action === 'chat') {
    command = `chat\n${input}`;
  } else if (action === 'distribute') {
    command = `distribute\n${input}`;
  } else if (action === 'retrieve') {
    command = `retrieve\n${input}\noutput.txt`;
  } else if (action === 'delete') {
    command = `delete\n${input}`;
  }

  ipcRenderer.send('send-command', command);
  hideActionInput();
});

function showActionInput(placeholder) {
  const actionInput = document.getElementById('actionInput');
  actionInput.style.display = 'block';
  actionInput.dataset.action = event.target.id;
  document.getElementById('actionInputField').placeholder = placeholder;
}

function hideActionInput() {
  document.getElementById('actionInput').style.display = 'none';
  document.getElementById('actionInputField').value = '';
}

ipcRenderer.on('node-output', (event, data) => {
  const output = document.getElementById('output');
  output.innerHTML += `<p>${data}</p>`;
  output.scrollTop = output.scrollHeight;
});

ipcRenderer.on('node-error', (event, data) => {
  const output = document.getElementById('output');
  output.innerHTML += `<p style="color: red;">${data}</p>`;
  output.scrollTop = output.scrollHeight;
});