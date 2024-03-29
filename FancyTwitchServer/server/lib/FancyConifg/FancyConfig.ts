/** @format */

import { configDB } from "../DatabaseRef";
import { Server, Socket } from "socket.io";
import { DataSnapshot } from "acebase";
import { MainLogger } from "../logging";
import { TwitchListener } from "../TwitchHandling/TwitchHandling";
import { BotAccount } from "../../../shared/obj/TwitchObjects";

const logger = MainLogger.child({ file: "FancyConfig" });

/**
 * Listener function which will listen for and provide interface with user configurations
 *
 * @remarks
 * Current configurations available:
 *      Twitch Bot Account (Used for chat command functions)
 *
 * @param socket - the websocket from which we should listen for configuration requests
 * @returns the websocket
 *
 */
export const FancyConfig = (IO: Server, TL?: TwitchListener): Server => {
  IO.on("connection", (socket: Socket): void => {
    // Only bother subscribing to these events for clients which are in the setup-commands room, no other clients care
    socket.on("join-setup-commands", () => {
      // Listen for bot config requests
      socket.on("update-bot-acct", async (acct: BotAccount | null) => {
        logger.debug(
          { acct },
          "Recieved bot account update request from client"
        );
        if (acct === null) {
          configDB.ref("twitch-bot-acct[0]").remove();
          return;
        }

        let oldAcct: any = (await configDB.ref("twitch-bot-acct").get()).val();
        if (acct.client_secret === "*****") {
          if (typeof oldAcct === typeof []) {
            oldAcct = oldAcct[0];
          }
          if (oldAcct) {
            if ("client_secret" in oldAcct) {
              acct.client_secret = oldAcct.client_secret;
            }
          }
        }

        if (oldAcct !== acct) {
          // When making changes to the account, if the details don't match what they used to be, then drop the old token to force the system register a new one
          await configDB.ref("twitch-bot-token").remove();
        }
        await configDB.ref("twitch-bot-acct").set([acct]);
        sendTwitchBotConfig(socket);
        // Refresh the TwitchSayHelper when the account changes
        if (TL) {
          TL.getAndListenForAccounts();
        }
      });

      socket.on("unlink-bot-acct", () => {
        logger.debug("Recieved bot account update request from client");
        configDB.ref("twitch-bot-acct[0]").remove();
        configDB.ref("twitch-bot-acct").set([]);
        if (TL) {
          TL.getAndListenForAccounts();
        }
      });

      // Request the stored data about the bot account details
      socket.on("get-bot-acct", () => {
        logger.debug("Recieved bot account get request from client");
        sendTwitchBotConfig(socket);
      });
    });
  });
  return IO;
};

const sendTwitchBotConfig = (socket: Socket) => {
  configDB.ref("twitch-bot-acct").get((ss: DataSnapshot) => {
    let f_acct = ss.val();
    if (f_acct) {
      if (typeof f_acct === typeof [] && f_acct.length > 0) {
        f_acct = f_acct[0];
      }
      if ("client_secret" in f_acct) {
        if (f_acct["client_secret"].length > 0) {
          f_acct["client_secret"] = "*****";
        }
      }
      if ("auth_code" in f_acct) {
        delete f_acct["auth_code"];
      }
    }
    logger.debug(
      { acct: f_acct },
      "Recieved bot account get request from client"
    );
    socket.emit("get-bot-acct", f_acct);
  });
};
