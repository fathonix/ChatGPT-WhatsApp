import { Boom } from "@hapi/boom"
const process = require("process")
import makeWASocket, { AnyMessageContent, delay, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, makeInMemoryStore, useMultiFileAuthState } from "@adiwajshing/baileys"
import { ChatGPTAPI, ChatMessage } from "chatgpt"
import P from "pino"

// Environment variables
require("dotenv").config()

// Initialize the logger
const logger = P({ timestamp: () => `, "time": "${new Date().toJSON()}"` }).child({})
logger.level = process.env.LOGGER_LEVEL ?? "silent"

// Prefix check
const prefixEnabled = process.env.PREFIX_ENABLED == "true"
const prefix = process.env.PREFIX_KEY ?? "!g"

const store = makeInMemoryStore({ logger })
store?.readFromFile("./baileys_store_multi.json")

// ChatGPT Client
const api = new ChatGPTAPI({
    apiKey: process.env.OPENAI_API_KEY
})

// Mapping from number to the last conversation id
const conversations = {}

// external map to store retry counts of messages when decryption/encryption fails
// keep this out of the socket itself, so as to prevent a message decryption/encryption loop across socket restarts
const msgRetryCounterMap = {}

// start a connection
const startSock = async() => {
	const { state, saveCreds } = await useMultiFileAuthState("baileys_auth_info")
	// fetch latest version of WA Web
	const { version, isLatest } = await fetchLatestBaileysVersion()
	console.log(`Using WhatsApp v${version.join(".")}, isLatest: ${isLatest}`)

	const sock = makeWASocket({
		version,
		logger,
		printQRInTerminal: true,
		auth: {
			creds: state.creds,
			/** caching makes the store faster to send/recv messages */
			keys: makeCacheableSignalKeyStore(state.keys, logger),
		},
		msgRetryCounterMap,
		generateHighQualityLinkPreview: true,
		// ignore all broadcast messages -- to receive the same
		// comment the line below out
		// shouldIgnoreJid: jid => isJidBroadcast(jid),
		// implement to handle retries
		getMessage: async key => {
			if(store) {
				const msg = await store.loadMessage(key.remoteJid!, key.id!)
				return msg?.message || undefined
			}
		}
	})

	store?.bind(sock.ev)

	const sendMessageWTyping = async(msg: AnyMessageContent, jid: string) => {
		await sock.presenceSubscribe(jid)
		await delay(500)

		await sock.sendPresenceUpdate("composing", jid)
		await delay(2000)

		await sock.sendPresenceUpdate("paused", jid)

		await sock.sendMessage(jid, msg)
	}

	// the process function lets you process all events that just occurred
	// efficiently in a batch
	sock.ev.process(
		// events is a map for event name => event data
		async(events) => {
			// something about the connection changed
			// maybe it closed, or we received all offline message or connection opened
			if(events["connection.update"]) {
				const update = events["connection.update"]
				const { connection, lastDisconnect } = update
				if(connection === "close") {
					// reconnect if not logged out
					if((lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut) {
						console.log("Connection is lost! Trying to reconnect...")
						startSock()
					} else {
						console.log("Connection closed. You are logged out.")
					}
				}

				console.log("connection update", update)
			}

			// credentials updated -- save them
			if(events["creds.update"]) {
				await saveCreds()
			}

			// received a new message
			if(events["messages.upsert"]) {
				const upsert = events["messages.upsert"]

				if(upsert.type === "notify") {
					for(const msg of upsert.messages) {
						if (msg.key.fromMe || msg.message?.conversation?.length === 0) continue

						if (prefixEnabled) {
							if(msg.message?.conversation?.startsWith(prefix + " ")) {
								const prompt = msg.message?.conversation?.substring(prefix.length + 1)
								const response = await handleMessage(msg.key.remoteJid!, prompt)
								await sock!.readMessages([msg.key])
								await sendMessageWTyping({ text: response }, msg.key.remoteJid!)
							}
						} else {
							const response = await handleMessage(msg.key.remoteJid!, msg.message!.conversation!)
							await sock!.readMessages([msg.key])
							await sendMessageWTyping({ text: response }, msg.key.remoteJid!)
						}
					}
				}
			}
		}
	)

	return sock
}

const handleMessage = async (jid: any, prompt: any) => {
    try {
        const lastConversation = conversations[jid]

        // Add the message to the conversation
        console.log(`Received prompt from ${jid}:`, prompt)

        const start = Date.now()
        let response: ChatMessage = await api.sendMessage(prompt, lastConversation ?? undefined)
        const end = Date.now() - start

        console.log(`Answer to ${jid}:`, response.text)

        // Set the conversation
        conversations[jid] = {
            conversationId: response.conversationId,
            parentMessageId: response.id
        }

        console.log(`ChatGPT took ${end}ms.`)
		
        // Send the response to the chat
        return response.text + "\n\n" + `*ChatGPT took ${end}ms.*`
    } catch (error: any) {
        console.error("An error occured", error)
        return "An error occured, please contact the administrator."
    }
}

startSock()