import asyncio
from node import Node
import random
import os


async def main():
    known_peer = input("Enter address of known peer (or leave blank if none): ")
    if known_peer:
        parts = known_peer.split()
        if len(parts) == 1:
            known_peer = ('127.0.0.1', int(parts[0]))
        elif len(parts) == 2:
            known_peer = (parts[0], int(parts[1]))
        else:
            print("Invalid input. Starting without a known peer.")
            known_peer = None
    else:
        known_peer = None

    node = Node('0.0.0.0', random.randint(5000, 6000), known_peer)
    await node.start()


    try:
        while True:
            action = input("Enter action (chat/distribute/retrieve/delete/quit): ").lower().strip()
            if action == 'quit':
                break
            elif action == 'chat':
                message = input("Enter message to broadcast: ")
                node.broadcast(message)
            elif action == 'distribute':
                file_path = input("Enter file path to distribute: ")
                if os.path.exists(file_path):
                    file_id = await node.distribute_file(file_path)
                    print("Please save this File ID for later retrieval.")
                    #sleep for some time to allow chunk distribution
                else:
                    print("File not found.")
            elif action == 'retrieve':
                file_id = input("Enter file ID to retrieve: ")
                decrypted_data = await node.retrieve_file(file_id)
                if decrypted_data:
                    output_path = input("Enter output file path: ")
                    with open(output_path, 'wb') as file:
                        file.write(decrypted_data)
                    print(f"File retrieved and saved to {output_path}")
                else:
                    print("Failed to retrieve file.")
            elif action == 'delete':
                file_id = input("Enter file ID to delete: ")
                node.delete_file(file_id)
                print(f"File {file_id} deleted.")

    except KeyboardInterrupt:
        print("\nShutting down...")
    finally:
        node.stop()

if __name__ == "__main__":
    asyncio.run(main())