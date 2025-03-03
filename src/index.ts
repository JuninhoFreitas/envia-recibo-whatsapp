import makeWASocket, { DisconnectReason, useMultiFileAuthState } from "baileys";
import { Boom } from "@hapi/boom";
import { EventEmitter } from "events";
import Koa from "koa";
import bodyParser from "@koa/bodyparser";

let serverIsRunning = false;
const mainEvent = new EventEmitter();

async function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectToWhatsApp() {
	const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");

	const sock = makeWASocket({
		// can provide additional config here
		auth: state,
		printQRInTerminal: true,
	});
	sock.ev.on("connection.update", async (update) => {
		const { connection, lastDisconnect } = update;
		if (connection === "close") {
			const shouldReconnect =
				(lastDisconnect?.error as Boom)?.output?.statusCode !==
				DisconnectReason.loggedOut;
			console.log(
				"connection closed due to ",
				lastDisconnect?.error,
				", reconnecting ",
				shouldReconnect,
			);
			// reconnect if not logged out
			if (shouldReconnect) {
				connectToWhatsApp();
			}
		} else if (connection === "open") {
			mainEvent.emit("whatsapp-connected");
			console.log("opened connection");
		}
	});

	// to storage creds (session info) when it updates
	sock.ev.on("creds.update", saveCreds);

	mainEvent.on("whatsapp-connected", () => {
		if (serverIsRunning) return;
		//start the http server using koa
		const app = new Koa();
		app.use(bodyParser());

		// POST /send-message
		// receives: {to: string, message: string}
		// sends: {success: boolean}
		app.use(async (ctx) => {
			if (ctx.method === "POST" && ctx.path === "/send-message") {
				console.log("received send-message request", ctx.request.body);
				let { to, message } = ctx.request.body;
				const jid = `${to}@s.whatsapp.net`;
				console.log("jID", jid);
				const isOnWhatsApp = await sock.onWhatsApp(jid);
				console.log("isOnWhatsApp", isOnWhatsApp);
				if (!isOnWhatsApp) {
					ctx.body = { success: false, error: "JID not found on WhatsApp" };
					return;
				}
				//if last line is a new line, remove it
				while (message.endsWith("\n")) {
					message = message.slice(0, -1);
				}
				await sock.sendMessage(jid, { text: `${message}` });

				ctx.body = { success: true };
			} else {
				ctx.body = { success: false };
			}
		});
		app.listen(3000);
		serverIsRunning = true;

		console.log("http server started on port 3000");
	});
}
// run in main file
connectToWhatsApp();
