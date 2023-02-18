# ChatGPT-WhatsApp

**An OpenAI ChatGPT WhatsApp Bot, but uses Baileys.**

This is based on [navopw](https://github.com/navopw/whatsapp-chatgpt)'s,
but because I want to put it on my low-specced VPS so I rewrote it to use
[Baileys](https://github.com/adiwajshing/Baileys) instead of
[whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js)
(which needs full-fledged Chromium installed).

# Installation

- Make sure you have [Node.js](https://nodejs.org/en/download) higher than 18.0
- Clone this repository
- [Get an OpenAI API key](https://platform.openai.com/account/api-keys) and set `OPENAI_API_KEY` in `.env` (See `.env.example`)
- Get the dependencies by running `npm install`
- Run `npm start`
- In WhatsApp, go to the three-dots menu > Linked device and scan the QR code printed in the terminal
- You're good to go!

# Usage

Simply send the message prefixed with `!g`, like this:

`!g What is Linux?`

You can change the prefix by setting `PREFIX_KEY` in the `.env`.

# Thanks

- [navopw](https://github.com/navopw) for the base project.
- Baileys so I don't need to install Chromium on my VPS.
- The rest of the JS and Node.js community.

# License

This project is licensed under MIT. © 2023 Aldo Adirajasa Fathoni