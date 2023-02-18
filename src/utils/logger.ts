const process = require("process")
require("dotenv").config()

const logPrefix = process.env.LOGGER_PREFIX ?? "[WhatsApp ChatGPT]"

export function stdout(...params: any[]) {
    console.log(logPrefix, ...params)
}

export function stderr(...params: any[]) {
    console.error(logPrefix, ...params)
}