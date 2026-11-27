# Áudio da narração

Coloque aqui **um MP3 por trecho**, com o nome igual ao `id` do trecho (veja `../pedido-narracao.md`):

`abertura.mp3`, `entrar.mp3`, `cadastro.mp3`, `perfis.mp3`, `painel-visao.mp3`, `painel-lista.mp3`,
`menu-grupos.mp3`, `ajuda.mp3`, `encerramento.mp3`.

Depois rode, na raiz do projeto:

    npm run gerar:manual-video -- primeiros-passos

O gerador mede cada MP3, junta tudo num arquivo só, calcula o início e o fim de cada trecho e grava
`../primeiros-passos.html` com o player. Se faltar qualquer trecho, a página sai só com o texto.
