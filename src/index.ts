import makeWASocket, { DisconnectReason, useMultiFileAuthState } from 'baileys'
import { Boom } from '@hapi/boom'

async function sleep (ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

async function connectToWhatsApp () {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys')
    const sock = makeWASocket({
        // can provide additional config here
        auth: state,
        printQRInTerminal: true,
    })
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update
        if(connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut
            console.log('connection closed due to ', lastDisconnect?.error, ', reconnecting ', shouldReconnect)
            // reconnect if not logged out
            if(shouldReconnect) {
                connectToWhatsApp()
            }
        } else if(connection === 'open') {
            console.log('opened connection')
        let jid = '555199354299@s.whatsapp.net'
        const result = await sock.onWhatsApp(jid)
        console.log (`${jid} exists on WhatsApp, as jid: ${JSON.stringify(result, undefined, 2)}`)
        await sock.sendMessage('555199354299@s.whatsapp.net'!, { text: 'EAI CARA' })

        }
    })
       
    // sock.ev.on('messages.upsert', async event => {
    //     let i = 0;
    //     for (const m of event.messages) {
    //         console.log(JSON.stringify(m, undefined, 2))
    //         await sock.sendMessage('555199354299@s.whatsapp.net', { text: 'Hello Word' })
    //         i++;
    //         await sleep(1000);
    //         if(i > 3) {
    //             break;
    //         }
    //     }
    // });

    // to storage creds (session info) when it updates
    sock.ev.on('creds.update', saveCreds)
}
// run in main file
connectToWhatsApp()