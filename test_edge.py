import asyncio
import edge_tts

async def test():
    comunicador = edge_tts.Communicate('Teste', 'pt-BR-FranciscaNeural')
    await comunicador.save('teste.mp3')
    print("Sucesso!")

asyncio.run(test())
