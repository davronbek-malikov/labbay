/**
 * One-time Telegram login.
 *
 * Run this once on your own machine. It asks for your phone, the code Telegram
 * sends to your app, and your two-step password if you have one, then prints a
 * session string. Put that string in TELEGRAM_SESSION and you never log in
 * again.
 *
 *   npm install
 *   npm run login
 */
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import input from "input";

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;

if (!apiId || !apiHash) {
  console.error(
    "\nTELEGRAM_API_ID and TELEGRAM_API_HASH are required.\n" +
      "Get them from https://my.telegram.org -> API development tools,\n" +
      "then put them in worker/.env and run this again.\n",
  );
  process.exit(1);
}

const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
  connectionRetries: 5,
});

await client.start({
  phoneNumber: async () =>
    await input.text("Phone number (with country code, e.g. +998901234567): "),
  phoneCode: async () => await input.text("Code Telegram just sent you: "),
  password: async () =>
    await input.password("Two-step password (press enter if you have none): "),
  onError: (err) => console.error(err),
});

const me = await client.getMe();

console.log(`\nSigned in as ${me.firstName ?? ""} ${me.lastName ?? ""}`.trim());
console.log("\nPut this in worker/.env as TELEGRAM_SESSION:\n");
console.log(client.session.save());
console.log(
  "\nAnyone holding that string can act as you on Telegram. Never commit it.\n",
);

await client.disconnect();
process.exit(0);
