import asyncio
import random
import json
from aiohttp import web
from node import Node

node = None

async def start_node(request):
    global node
    data = await request.json()
    known_peer = data.get('known_peer')
    if known_peer:
        parts = known_peer.split()
        if len(parts) == 1:
            known_peer = ('127.0.0.1', int(parts[0]))
        elif len(parts) == 2:
            known_peer = (parts[0], int(parts[1]))
        else:
            known_peer = None
    
    node = Node('0.0.0.0', random.randint(5000, 6000), known_peer)
    print(node.port, node.node_id)
    try:
        port, node_id = await node.start()
        return web.json_response({'status': 'Node started successfully', 'port': port, 'node_id': node_id})
    except Exception as e:
        return web.json_response({'error': str(e)}, status=500)

async def chat_message(request):
    if node:
        data = await request.json()
        node.broadcast(data['message'])
        return web.json_response({'status': 'Message sent'})
    return web.json_response({'error': 'Node not started'}, status=400)

async def distribute_file(request):
    if node:
        data = await request.json()
        file_path = data['file_path']
        try:
            file_id = await node.distribute_file(file_path)
            return web.json_response({'file_id': file_id})
        except FileNotFoundError:
            return web.json_response({'error': 'File not found'}, status=404)
        except Exception as e:
            return web.json_response({'error': str(e)}, status=500)
    return web.json_response({'error': 'Node not started'}, status=400)

async def retrieve_file(request):
    if node:
        data = await request.json()
        file_id = data['file_id']
        output_path = data['output_path']
        try:
            decrypted_data = await node.retrieve_file(file_id)
            if decrypted_data:
                with open(output_path, 'wb') as file:
                    file.write(decrypted_data)
                return web.json_response({'status': 'File retrieved and saved successfully'})
            else:
                return web.json_response({'error': 'Failed to retrieve file'}, status=500)
        except Exception as e:
            return web.json_response({'error': str(e)}, status=500)
    return web.json_response({'error': 'Node not started'}, status=400)

async def delete_file(request):
    if node:
        data = await request.json()
        file_id = data['file_id']
        node.delete_file(file_id)
        return web.json_response({'status': f"File {file_id} deleted"})
    return web.json_response({'error': 'Node not started'}, status=400)

async def get_messages(request):
    if node:
        messages = node.chat_messages
        node.chat_messages = []  # Clear the messages after sending
        return web.json_response({'messages': messages})
    return web.json_response({'error': 'Node not started'}, status=400)

app = web.Application()
app.router.add_post('/start_node', start_node)
app.router.add_post('/chat_message', chat_message)
app.router.add_post('/distribute_file', distribute_file)
app.router.add_post('/retrieve_file', retrieve_file)
app.router.add_post('/delete_file', delete_file)
app.router.add_get('/get_messages', get_messages)

if __name__ == '__main__':
    web.run_app(app, port=8080)